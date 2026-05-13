// ---------------------------------------------------------------------------
// GraphQL Mutation Definitions
// ---------------------------------------------------------------------------

// ---- Authentication -------------------------------------------------------

export const LOGIN = /* GraphQL */ `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user {
        id
        email
        firstName
        lastName
        role
        avatarUrl
        preferredLanguage
        institutionId
      }
      token
      refreshToken
      expiresAt
    }
  }
`;

export const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      user {
        id
        email
        firstName
        lastName
        role
        preferredLanguage
      }
      token
      refreshToken
      expiresAt
    }
  }
`;

export const REFRESH_TOKEN = /* GraphQL */ `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
      expiresAt
    }
  }
`;

export const LOGOUT = /* GraphQL */ `
  mutation Logout {
    logout {
      success
    }
  }
`;

// ---- Triage ---------------------------------------------------------------

export const SUBMIT_TRIAGE = /* GraphQL */ `
  mutation SubmitTriage($input: TriageInput!) {
    submitTriage(input: $input) {
      sessionId
      status
    }
  }
`;

export const GET_CLARIFYING_QUESTIONS = /* GraphQL */ `
  mutation GetClarifyingQuestions($symptomDescription: String!, $patientId: ID!) {
    generateClarifyingQuestions(symptomDescription: $symptomDescription, patientId: $patientId) {
      questions {
        id
        question
        type
        options
      }
    }
  }
`;

export const SUBMIT_TRIAGE_COMPLETE = /* GraphQL */ `
  mutation SubmitTriageComplete($input: TriageCompleteInput!) {
    submitTriageComplete(input: $input) {
      sessionId
      output {
        urgencyLevel
        recommendedSpecializations {
          specialty
          confidenceScore
          rationale
          estimatedWaitTimeMinutes
        }
        redFlags
        suggestedDiagnostics
        contraindications
        epidemiologicalContext
        followUpProtocol {
          timeframeHours
          escalationTriggers
        }
      }
      modelVersion
      inferenceLatencyMs
    }
  }
`;

// ---- Appointments ---------------------------------------------------------

export const CREATE_APPOINTMENT = /* GraphQL */ `
  mutation CreateAppointment($input: CreateAppointmentInput!) {
    createAppointment(input: $input) {
      id
      patientId
      doctorId
      appointmentType
      status
      priority
      scheduledStart
      scheduledEnd
      reasonForVisit
    }
  }
`;

export const CANCEL_APPOINTMENT = /* GraphQL */ `
  mutation CancelAppointment($appointmentId: ID!, $reason: String!) {
    cancelAppointment(appointmentId: $appointmentId, reason: $reason) {
      id
      status
    }
  }
`;

export const RESCHEDULE_APPOINTMENT = /* GraphQL */ `
  mutation RescheduleAppointment($input: RescheduleAppointmentInput!) {
    rescheduleAppointment(input: $input) {
      id
      scheduledStart
      scheduledEnd
      status
    }
  }
`;

// ---- Telemetry ------------------------------------------------------------

export const REGISTER_DEVICE = /* GraphQL */ `
  mutation RegisterDevice($input: DeviceRegistrationInput!) {
    registerDevice(input: $input) {
      deviceId
      deviceType
      status
    }
  }
`;

export const SYNC_WEARABLE_DATA = /* GraphQL */ `
  mutation SyncWearableData($patientId: ID!, $deviceId: String!) {
    syncWearableData(patientId: $patientId, deviceId: $deviceId) {
      syncedMetrics
      lastSyncedAt
      dataPointsCount
    }
  }
`;

// ---- Doctor Actions -------------------------------------------------------

export const UPDATE_APPOINTMENT_NOTES = /* GraphQL */ `
  mutation UpdateAppointmentNotes($appointmentId: ID!, $notes: AppointmentNotesInput!) {
    updateAppointmentNotes(appointmentId: $appointmentId, notes: $notes) {
      id
      notes {
        chiefComplaint
        clinicalNotes
        diagnosisCodes
        followUpRequired
      }
    }
  }
`;

export const OVERRIDE_TRIAGE = /* GraphQL */ `
  mutation OverrideTriage($sessionId: ID!, $override: TriageOverrideInput!, $reason: String!) {
    overrideTriage(sessionId: $sessionId, override: $override, reason: $reason) {
      id
      status
      doctorOverride {
        urgencyLevel
        recommendedSpecializations {
          specialty
          confidenceScore
        }
      }
    }
  }
`;

// ---- Hospital Actions -----------------------------------------------------

export const UPDATE_BED_AVAILABILITY = /* GraphQL */ `
  mutation UpdateBedAvailability($institutionId: ID!, $wardType: String!, $updates: BedUpdateInput!) {
    updateBedAvailability(institutionId: $institutionId, wardType: $wardType, updates: $updates) {
      wardType
      totalBeds
      occupiedBeds
      availableBeds
    }
  }
`;

// ---- Surveillance Actions -------------------------------------------------

export const REPORT_DISEASE_CASE = /* GraphQL */ `
  mutation ReportDiseaseCase($input: DiseaseCaseInput!) {
    reportDiseaseCase(input: $input) {
      id
      outbreakId
      diseaseName
      reportedAt
    }
  }
`;

export const UPDATE_OUTBREAK_STATUS = /* GraphQL */ `
  mutation UpdateOutbreakStatus($outbreakId: ID!, $status: OutbreakStatus!, $notes: String) {
    updateOutbreakStatus(outbreakId: $outbreakId, status: $status, notes: $notes) {
      id
      status
      lastUpdated
    }
  }
`;
