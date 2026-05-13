// ---------------------------------------------------------------------------
// Re-export shared domain types
// ---------------------------------------------------------------------------

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
} from '@aura/shared/types/patient';

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
} from '@aura/shared/types/doctor';

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
} from '@aura/shared/types/triage';

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
} from '@aura/shared/types/telemetry';

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
} from '@aura/shared/types/appointment';

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
} from '@aura/shared/types/institution';

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
} from '@aura/shared/types/surveillance';

// ---------------------------------------------------------------------------
// Web-specific UI types
// ---------------------------------------------------------------------------

export type { UserRole, AuthUser } from '@/stores/authStore';
export type { TriageStep, ClarifyingQuestion } from '@/stores/triageStore';

/** Route definition for building navigation dynamically */
export interface RouteDefinition {
  path: string;
  label: string;
  icon?: string;
  roles: string[];
  children?: RouteDefinition[];
}

/** Toast notification */
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

/** Pagination metadata */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Date range filter */
export interface DateRange {
  from: string;
  to: string;
}

/** Sort configuration */
export interface SortConfig<T extends string = string> {
  field: T;
  direction: 'asc' | 'desc';
}
