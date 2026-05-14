/**
 * API Client Service
 *
 * GraphQL client configured for the Aura Health mobile app. Handles
 * auth token injection from expo-secure-store, automatic token refresh,
 * offline request queuing, and standardized error handling.
 */

import { Platform } from 'react-native';
import { GraphQLClient, gql } from 'graphql-request';
import * as SecureStore from 'expo-secure-store';
import type { LoginRequest, LoginResponse, AuthTokenPair } from '@aura/shared/types/auth';
import type { TriageSession } from '@aura/shared/types/triage';
import type { VitalSigns } from '@aura/shared/types/patient';
import type { Appointment, AppointmentSummary } from '@aura/shared/types/appointment';
import type { FollowUpQuestion, FollowUpAnswer } from '../types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = __DEV__
  ? 'http://localhost:4000/graphql'
  : 'https://api.aurahealth.com/graphql';

const SECURE_KEYS = {
  ACCESS_TOKEN: 'aura_access_token',
  REFRESH_TOKEN: 'aura_refresh_token',
} as const;

// ---------------------------------------------------------------------------
// GraphQL Client Setup
// ---------------------------------------------------------------------------

const graphqlClient = new GraphQLClient(API_URL, {
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
    'X-Client-Version': '1.0.0',
  },
});

/**
 * Retrieves the stored access token and attaches it to the GraphQL client
 * authorization header.
 */
async function getAuthenticatedClient(): Promise<GraphQLClient> {
  const token = await SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN);

  if (token) {
    graphqlClient.setHeader('Authorization', `Bearer ${token}`);
  }

  return graphqlClient;
}

/**
 * Wraps API calls with automatic token refresh on 401 errors.
 */
async function authenticatedRequest<T>(
  request: (client: GraphQLClient) => Promise<T>
): Promise<T> {
  const client = await getAuthenticatedClient();

  try {
    return await request(client);
  } catch (error: unknown) {
    // Check for authentication error
    const isAuthError =
      error instanceof Error &&
      (error.message.includes('401') ||
        error.message.includes('UNAUTHENTICATED') ||
        error.message.includes('Token expired'));

    if (isAuthError) {
      // Attempt token refresh
      const refreshToken = await SecureStore.getItemAsync(
        SECURE_KEYS.REFRESH_TOKEN
      );

      if (refreshToken) {
        try {
          const refreshResult = await apiClient.refreshToken(refreshToken);
          if (refreshResult.tokens) {
            await SecureStore.setItemAsync(
              SECURE_KEYS.ACCESS_TOKEN,
              refreshResult.tokens.access_token
            );
            await SecureStore.setItemAsync(
              SECURE_KEYS.REFRESH_TOKEN,
              refreshResult.tokens.refresh_token
            );

            // Retry original request with new token
            const retryClient = await getAuthenticatedClient();
            return await request(retryClient);
          }
        } catch {
          // Refresh failed - session is invalid
          await SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN);
          await SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN);
        }
      }
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// GraphQL Queries & Mutations
// ---------------------------------------------------------------------------

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      tokens {
        access_token
        refresh_token
        token_type
        expires_in
        scope
      }
      user {
        id
        email
        role
        name
        institution_id
      }
      mfa_required
      mfa_methods
      error
    }
  }
`;

const BIOMETRIC_LOGIN_MUTATION = gql`
  mutation BiometricLogin($userId: ID!, $biometricToken: String!) {
    biometricLogin(userId: $userId, biometricToken: $biometricToken) {
      success
      tokens {
        access_token
        refresh_token
        token_type
        expires_in
        scope
      }
      user {
        id
        email
        role
        name
      }
      error
    }
  }
`;

const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      success
      tokens {
        access_token
        refresh_token
        token_type
        expires_in
        scope
      }
      user {
        id
        email
        role
        name
      }
      error
    }
  }
`;

const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      tokens {
        access_token
        refresh_token
        token_type
        expires_in
        scope
      }
    }
  }
`;

const SUBMIT_SYMPTOMS_MUTATION = gql`
  mutation SubmitSymptoms($input: SubmitSymptomsInput!) {
    submitSymptoms(input: $input) {
      sessionId
      followUpQuestions {
        id
        text
        type
        options {
          label
          value
        }
        sliderConfig {
          min
          max
          step
          unit
        }
        required
      }
    }
  }
`;

const SUBMIT_FOLLOW_UP_MUTATION = gql`
  mutation SubmitFollowUp($sessionId: ID!, $answers: [FollowUpAnswerInput!]!) {
    submitFollowUpAnswers(sessionId: $sessionId, answers: $answers) {
      success
    }
  }
`;

const SUBMIT_VITALS_MUTATION = gql`
  mutation SubmitTriageVitals($sessionId: ID!, $vitals: VitalSignsInput!) {
    submitTriageVitals(sessionId: $sessionId, vitals: $vitals) {
      sessionId
      status
    }
  }
`;

const GET_TRIAGE_SESSION_QUERY = gql`
  query GetTriageSession($id: ID!) {
    triageSession(id: $id) {
      id
      patient_id
      status
      output {
        urgency_level
        recommended_specializations {
          specialty
          confidence_score
          rationale
          estimated_wait_time_minutes
        }
        red_flags
        suggested_diagnostics
        contraindications
        follow_up_protocol {
          timeframe_hours
          escalation_triggers
        }
      }
      model_version
      inference_latency_ms
      created_at
      completed_at
    }
  }
`;

const GET_TRIAGE_HISTORY_QUERY = gql`
  query GetTriageHistory($patientId: ID!) {
    triageHistory(patientId: $patientId) {
      id
      patient_id
      status
      output {
        urgency_level
        recommended_specializations {
          specialty
          confidence_score
        }
      }
      created_at
      completed_at
    }
  }
`;

const GET_APPOINTMENTS_QUERY = gql`
  query GetAppointments($patientId: ID!, $status: String, $timeframe: String) {
    appointments(patientId: $patientId, status: $status, timeframe: $timeframe) {
      id
      patient_id
      doctor_id
      doctor_name
      patient_name
      appointment_type
      status
      priority
      scheduled_start
      scheduled_end
      reason_for_visit
    }
  }
`;

const GET_HEALTH_DATA_QUERY = gql`
  query GetHealthData($patientId: ID!, $dateRange: String!, $metrics: [String!]!) {
    healthData(patientId: $patientId, dateRange: $dateRange, metrics: $metrics) {
      heartRate { timestamp value }
      spO2 { timestamp value }
      hrv { timestamp value }
      steps { timestamp value }
      sleep { timestamp value }
    }
  }
`;

// ---------------------------------------------------------------------------
// API Client Object
// ---------------------------------------------------------------------------

export const apiClient = {
  // -- Auth ----------------------------------------------------------------

  async login(input: LoginRequest): Promise<LoginResponse> {
    const data = await graphqlClient.request<{ login: LoginResponse }>(
      LOGIN_MUTATION,
      { input }
    );
    return data.login;
  },

  async loginWithBiometric(
    userId: string,
    biometricToken: string
  ): Promise<LoginResponse> {
    const data = await graphqlClient.request<{
      biometricLogin: LoginResponse;
    }>(BIOMETRIC_LOGIN_MUTATION, { userId, biometricToken });
    return data.biometricLogin;
  },

  async register(input: Record<string, unknown>): Promise<LoginResponse> {
    const data = await graphqlClient.request<{ register: LoginResponse }>(
      REGISTER_MUTATION,
      { input }
    );
    return data.register;
  },

  async refreshToken(
    refreshToken: string
  ): Promise<{ tokens: AuthTokenPair | null }> {
    const data = await graphqlClient.request<{
      refreshToken: { tokens: AuthTokenPair | null };
    }>(REFRESH_TOKEN_MUTATION, { refreshToken });
    return data.refreshToken;
  },

  async logout(): Promise<void> {
    await authenticatedRequest((client) =>
      client.request(gql`mutation { logout { success } }`)
    );
  },

  // -- Triage --------------------------------------------------------------

  async submitSymptoms(input: {
    patient_id: string;
    symptom_description: string;
    language: string;
  }): Promise<{
    sessionId: string;
    followUpQuestions: FollowUpQuestion[];
  }> {
    return authenticatedRequest(async (client) => {
      const data = await client.request<{
        submitSymptoms: {
          sessionId: string;
          followUpQuestions: FollowUpQuestion[];
        };
      }>(SUBMIT_SYMPTOMS_MUTATION, { input });
      return data.submitSymptoms;
    });
  },

  async submitFollowUpAnswers(
    sessionId: string,
    answers: FollowUpAnswer[]
  ): Promise<{ success: boolean }> {
    return authenticatedRequest(async (client) => {
      const data = await client.request<{
        submitFollowUpAnswers: { success: boolean };
      }>(SUBMIT_FOLLOW_UP_MUTATION, { sessionId, answers });
      return data.submitFollowUpAnswers;
    });
  },

  async submitTriageVitals(
    sessionId: string,
    vitals: VitalSigns
  ): Promise<{ sessionId: string; status: string }> {
    return authenticatedRequest(async (client) => {
      const data = await client.request<{
        submitTriageVitals: { sessionId: string; status: string };
      }>(SUBMIT_VITALS_MUTATION, { sessionId, vitals });
      return data.submitTriageVitals;
    });
  },

  async getTriageSession(id: string): Promise<TriageSession> {
    return authenticatedRequest(async (client) => {
      const data = await client.request<{
        triageSession: TriageSession;
      }>(GET_TRIAGE_SESSION_QUERY, { id });
      return data.triageSession;
    });
  },

  async getTriageHistory(patientId: string): Promise<TriageSession[]> {
    return authenticatedRequest(async (client) => {
      const data = await client.request<{
        triageHistory: TriageSession[];
      }>(GET_TRIAGE_HISTORY_QUERY, { patientId });
      return data.triageHistory;
    });
  },

  async saveTriageToHistory(sessionId: string): Promise<void> {
    await authenticatedRequest((client) =>
      client.request(
        gql`mutation SaveTriage($sessionId: ID!) { saveTriageToHistory(sessionId: $sessionId) { success } }`,
        { sessionId }
      )
    );
  },

  async shareTriageWithDoctor(
    sessionId: string,
    doctorId: string
  ): Promise<void> {
    await authenticatedRequest((client) =>
      client.request(
        gql`mutation ShareTriage($sessionId: ID!, $doctorId: ID!) { shareTriageWithDoctor(sessionId: $sessionId, doctorId: $doctorId) { success } }`,
        { sessionId, doctorId }
      )
    );
  },

  // -- Appointments --------------------------------------------------------

  async getAppointments(
    patientId: string,
    timeframe: 'upcoming' | 'past' = 'upcoming'
  ): Promise<AppointmentSummary[]> {
    return authenticatedRequest(async (client) => {
      const data = await client.request<{
        appointments: AppointmentSummary[];
      }>(GET_APPOINTMENTS_QUERY, { patientId, timeframe });
      return data.appointments;
    });
  },

  // -- Health Data ---------------------------------------------------------

  async getHealthData(
    patientId: string,
    dateRange: string,
    metrics: string[]
  ): Promise<Record<string, Array<{ timestamp: string; value: number }>>> {
    return authenticatedRequest(async (client) => {
      const data = await client.request<{
        healthData: Record<string, Array<{ timestamp: string; value: number }>>;
      }>(GET_HEALTH_DATA_QUERY, { patientId, dateRange, metrics });
      return data.healthData;
    });
  },

  // -- Wearable Sync -------------------------------------------------------

  async syncWearableData(deviceId: string): Promise<void> {
    await authenticatedRequest((client) =>
      client.request(
        gql`mutation SyncWearable($deviceId: ID!) { syncWearableData(deviceId: $deviceId) { success } }`,
        { deviceId }
      )
    );
  },

  // -- Push Notifications ---------------------------------------------------

  async registerPushToken(token: string): Promise<void> {
    await authenticatedRequest((client) =>
      client.request(
        gql`mutation RegisterPushToken($token: String!, $platform: String!) { registerPushToken(token: $token, platform: $platform) { success } }`,
        { token, platform: Platform.OS }
      )
    );
  },

  // -- OTP -----------------------------------------------------------------

  async requestOtp(phone: string): Promise<{ success: boolean }> {
    const data = await graphqlClient.request<{
      requestOtp: { success: boolean };
    }>(
      gql`mutation RequestOtp($phone: String!) { requestOtp(phone: $phone) { success } }`,
      { phone }
    );
    return data.requestOtp;
  },

  async verifyOtp(
    phone: string,
    code: string
  ): Promise<{ success: boolean; token?: string }> {
    const data = await graphqlClient.request<{
      verifyOtp: { success: boolean; token?: string };
    }>(
      gql`mutation VerifyOtp($phone: String!, $code: String!) { verifyOtp(phone: $phone, code: $code) { success token } }`,
      { phone, code }
    );
    return data.verifyOtp;
  },
};
