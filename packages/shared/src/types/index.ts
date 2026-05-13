// ---------------------------------------------------------------------------
// @aura/shared - Type Exports
// ---------------------------------------------------------------------------

// Patient domain
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
  PatientSearchParams,
} from './patient';

// Doctor domain
export type {
  DoctorId,
  MedicalSpecialty,
  DoctorAvailabilityStatus,
  DailySchedule,
  MedicalLicense,
  DoctorPerformanceMetrics,
  Doctor,
  DoctorSummary,
  DoctorSearchParams,
} from './doctor';

// Triage domain
export type {
  UrgencyLevel,
  SeverityScale,
  TriageInput,
  SpecialtyRecommendation,
  FollowUpProtocol,
  TriageOutput,
  TriageSessionStatus,
  TriageSession,
  TriageHistoryParams,
  TriageStatistics,
} from './triage';

// Telemetry / biometric domain
export type {
  TimeSeriesDataPoint,
  DeviceSource,
  LifestyleFactors,
  BiometricMetrics,
  LongitudinalInput,
  BiometricTrend,
  BiometricAnomaly,
  HealthRiskAssessment,
  LongitudinalOutput,
  LongitudinalReport,
  DeviceRegistration,
} from './telemetry';

// Appointment domain
export type {
  AppointmentId,
  AppointmentType,
  AppointmentStatus,
  AppointmentPriority,
  TimeSlot,
  CancellationRecord,
  AppointmentNotes,
  Appointment,
  AppointmentSummary,
  CreateAppointmentRequest,
  RescheduleAppointmentRequest,
  AppointmentSearchParams,
} from './appointment';

// Institution domain
export type {
  InstitutionId,
  InstitutionType,
  InstitutionStatus,
  BedCapacity,
  Department,
  InstitutionCapability,
  InstitutionAddress,
  InstitutionMetrics,
  Institution,
  InstitutionSummary,
  InstitutionSearchParams,
} from './institution';

// Surveillance domain
export type {
  OutbreakAlertLevel,
  OutbreakStatus,
  OutbreakCluster,
  OutbreakRecord,
  OutbreakSummary,
  DiseaseCase,
  ForecastModel,
  DemandPrediction,
  SupplyForecast,
  RegionalSupplyStatus,
  OutbreakSearchParams,
  SupplyForecastParams,
} from './surveillance';

// Auth domain
export type {
  UserRole,
  AuthMethod,
  MfaMethod,
  AccountStatus,
  WebAuthnRegistrationOptions,
  WebAuthnRegistrationResponse,
  WebAuthnAuthenticationOptions,
  WebAuthnAuthenticationResponse,
  WebAuthnCredential,
  BiometricEnrollmentRequest,
  BiometricVerificationRequest,
  BiometricVerificationResult,
  UserSession,
  AuraTokenPayload,
  AuthTokenPair,
  LoginRequest,
  LoginResponse,
  AuthAuditEntry,
} from './auth';

// AI Router domain
export type {
  AITask,
  TaskComplexity,
  ModelProvider,
  ModelTier,
  RoutingDecision,
  RoutingMatrixEntry,
  RoutingMatrix,
  ModelHealthStatus,
  RegisteredModel,
  AIRouterRequest,
  AIRouterResponse,
  RouterMetrics,
  CircuitBreakerState,
} from './ai-router';

// Prescription domain
export type {
  PrescriptionId,
  PrescriptionStatus,
  AdministrationRoute,
  PrescriptionItem,
  DrugInteraction,
  Prescription,
  PrescriptionSummary,
  OutcomeMetrics,
  ComparativeEffectiveness,
  EfficacyMetric,
  RegionalEfficacySummary,
  PrescriptionSearchParams,
  EfficacySearchParams,
} from './prescription';
