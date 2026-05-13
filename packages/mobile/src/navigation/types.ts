/**
 * Navigation Type Definitions
 *
 * Strongly-typed navigation params for every screen in the Aura Health
 * mobile app. Using declaration merging with React Navigation's
 * RootParamList for end-to-end type safety on navigation.navigate() calls.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { UrgencyLevel } from '@aura/shared/types/triage';

// ---------------------------------------------------------------------------
// Root-level stacks
// ---------------------------------------------------------------------------

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ---------------------------------------------------------------------------
// Auth Stack
// ---------------------------------------------------------------------------

export type AuthStackParamList = {
  Login: undefined;
  Register: { step?: number } | undefined;
  BiometricSetup: { userId: string; isOnboarding: boolean };
  ForgotPassword: undefined;
  OtpVerification: { phone: string; purpose: 'registration' | 'login' | 'password_reset' };
};

// ---------------------------------------------------------------------------
// Main Tab Navigator
// ---------------------------------------------------------------------------

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  TriageTab: NavigatorScreenParams<TriageStackParamList>;
  AppointmentsTab: NavigatorScreenParams<AppointmentsStackParamList>;
  HealthTab: NavigatorScreenParams<HealthStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// ---------------------------------------------------------------------------
// Home Stack
// ---------------------------------------------------------------------------

export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
  AlertDetail: { alertId: string };
};

// ---------------------------------------------------------------------------
// Triage Stack
// ---------------------------------------------------------------------------

export type TriageStackParamList = {
  Triage: undefined;
  TriageFollowUp: { sessionId: string };
  TriageVitals: { sessionId: string };
  TriageAnalyzing: { sessionId: string };
  TriageResults: { sessionId: string };
  BookFromTriage: {
    sessionId: string;
    specialty: string;
    urgencyLevel: UrgencyLevel;
  };
};

// ---------------------------------------------------------------------------
// Appointments Stack
// ---------------------------------------------------------------------------

export type AppointmentsStackParamList = {
  Appointments: undefined;
  AppointmentDetail: { appointmentId: string };
  BookAppointment: {
    specialty?: string;
    doctorId?: string;
    triageSessionId?: string;
    urgencyLevel?: UrgencyLevel;
  };
  DoctorProfile: { doctorId: string };
  CheckIn: { appointmentId: string };
  RateExperience: { appointmentId: string };
  PrescriptionDetail: { prescriptionId: string };
};

// ---------------------------------------------------------------------------
// Health Stack
// ---------------------------------------------------------------------------

export type HealthStackParamList = {
  Health: undefined;
  MetricDetail: { metricType: VitalMetricType };
  ConnectWearable: undefined;
  DeviceDetail: { deviceId: string };
};

export type VitalMetricType =
  | 'heart_rate'
  | 'spo2'
  | 'hrv'
  | 'sleep'
  | 'steps'
  | 'blood_pressure'
  | 'temperature'
  | 'blood_glucose'
  | 'weight';

// ---------------------------------------------------------------------------
// Profile Stack
// ---------------------------------------------------------------------------

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  MedicalHistory: undefined;
  ConnectedDevices: undefined;
  PrescriptionHistory: undefined;
  Settings: undefined;
  LanguageSettings: undefined;
  NotificationSettings: undefined;
  DataSharingSettings: undefined;
  About: undefined;
};

// ---------------------------------------------------------------------------
// Screen Props Helper Types
// ---------------------------------------------------------------------------

/** Props for any screen in the Auth stack */
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

/** Props for any tab in the Main tab navigator */
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

/** Props for any screen in the Home stack */
export type HomeScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HomeStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

/** Props for any screen in the Triage stack */
export type TriageScreenProps<T extends keyof TriageStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<TriageStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

/** Props for any screen in the Appointments stack */
export type AppointmentsScreenProps<T extends keyof AppointmentsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AppointmentsStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

/** Props for any screen in the Health stack */
export type HealthScreenProps<T extends keyof HealthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HealthStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

/** Props for any screen in the Profile stack */
export type ProfileScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

// ---------------------------------------------------------------------------
// Declaration merging for global type inference
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
