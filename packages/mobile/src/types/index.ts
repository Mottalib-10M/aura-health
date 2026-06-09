/**
 * Mobile Type Definitions
 *
 * Re-exports all shared types from @uzavita/shared and defines
 * mobile-specific types for navigation, device interactions,
 * and local storage schemas.
 */

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type {
  UserRole,
  AuthMethod,
  MfaMethod,
  AccountStatus,
  BiometricEnrollmentRequest,
  BiometricVerificationRequest,
  BiometricVerificationResult,
  UserSession,
  UzavitaTokenPayload,
  AuthTokenPair,
  LoginRequest,
  LoginResponse,
} from '@uzavita/shared/types/auth';

export type {
  PatientId,
  BiologicalSex,
  BloodType,
  PatientDemographic,
  PatientLocation,
  EmergencyContact,
  InsuranceCoverage,
  Allergy,
  MedicalCondition,
  CurrentMedication,
  VitalSigns,
  Patient,
  PatientSummary,
} from '@uzavita/shared/types/patient';

export type {
  UrgencyLevel,
  SeverityScale,
  TriageInput,
  TriageOutput,
  SpecialtyRecommendation,
  FollowUpProtocol,
  TriageSession,
  TriageSessionStatus,
} from '@uzavita/shared/types/triage';

export type {
  TimeSeriesDataPoint,
  DeviceSource,
  BiometricMetrics,
  BiometricTrend,
  BiometricAnomaly,
  HealthRiskAssessment,
  LongitudinalOutput,
  DeviceRegistration,
} from '@uzavita/shared/types/telemetry';

export type {
  AppointmentId,
  AppointmentType,
  AppointmentStatus,
  AppointmentPriority,
  Appointment,
  AppointmentSummary,
  CreateAppointmentRequest,
  TimeSlot,
} from '@uzavita/shared/types/appointment';

export type {
  DoctorId,
  MedicalSpecialty,
  DoctorAvailabilityStatus,
  Doctor,
  DoctorSummary,
} from '@uzavita/shared/types/doctor';

export type {
  PrescriptionId,
  PrescriptionStatus,
  Prescription,
  PrescriptionSummary,
  PrescriptionItem,
  DrugInteraction,
} from '@uzavita/shared/types/prescription';

// ---------------------------------------------------------------------------
// Mobile-Specific Types
// ---------------------------------------------------------------------------

/**
 * App-wide theme mode (follows system or explicit user choice).
 */
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Supported biometric authentication type on the current device.
 */
export type DeviceBiometricType = 'fingerprint' | 'face' | 'iris' | 'none';

/**
 * BLE device connection state lifecycle.
 */
export type BleConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'discovering_services'
  | 'connected'
  | 'syncing'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

/**
 * Local notification configuration for user preferences.
 */
export interface NotificationPreferences {
  appointmentReminders: boolean;
  appointmentReminderMinutesBefore: number;
  medicationReminders: boolean;
  healthAlerts: boolean;
  triageResults: boolean;
  weeklyHealthSummary: boolean;
  marketingMessages: boolean;
}

/**
 * Data sharing preferences stored per-patient.
 */
export interface DataSharingPreferences {
  shareWithDoctor: boolean;
  shareWithInstitution: boolean;
  shareForResearch: boolean;
  shareAnonymizedData: boolean;
}

/**
 * Offline mutation queue entry schema.
 */
export interface OfflineQueueEntry {
  id: number;
  operation: string;
  variables: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  errorMessage?: string;
}

/**
 * App analytics event (privacy-respecting, no PHI).
 */
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: string;
}

/**
 * AI follow-up question returned by the triage API.
 */
export interface FollowUpQuestion {
  id: string;
  text: string;
  type: 'radio' | 'checkbox' | 'slider' | 'text';
  options?: { label: string; value: string }[];
  sliderConfig?: { min: number; max: number; step: number; unit: string };
  required: boolean;
}

/**
 * Answer to a follow-up question submitted during triage.
 */
export interface FollowUpAnswer {
  questionId: string;
  value: string | string[] | number;
}

/**
 * Deep link route parameters.
 */
export interface DeepLinkParams {
  screen: string;
  params?: Record<string, string>;
}

/**
 * Cached health data entry for offline access.
 */
export interface CachedHealthData {
  key: string;
  data: unknown;
  expiresAt: string;
  updatedAt: string;
}
