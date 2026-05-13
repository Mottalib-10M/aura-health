// ---------------------------------------------------------------------------
// Doctor / Clinician Domain Types
// ---------------------------------------------------------------------------

export type DoctorId = string;

/**
 * Medical specialty codes. A non-exhaustive list covering the primary
 * specializations available in Central Asian healthcare facilities.
 */
export type MedicalSpecialty =
  | 'general_practice'
  | 'cardiology'
  | 'neurology'
  | 'pulmonology'
  | 'gastroenterology'
  | 'endocrinology'
  | 'nephrology'
  | 'oncology'
  | 'pediatrics'
  | 'obstetrics_gynecology'
  | 'orthopedics'
  | 'dermatology'
  | 'ophthalmology'
  | 'otolaryngology'
  | 'psychiatry'
  | 'urology'
  | 'emergency_medicine'
  | 'surgery_general'
  | 'surgery_cardiac'
  | 'surgery_neuro'
  | 'radiology'
  | 'pathology'
  | 'anesthesiology'
  | 'infectious_disease'
  | 'rheumatology'
  | 'hematology'
  | 'allergy_immunology'
  | 'physical_rehabilitation'
  | 'palliative_care';

/**
 * Doctor availability status.
 */
export type DoctorAvailabilityStatus =
  | 'available'
  | 'busy'
  | 'on_call'
  | 'off_duty'
  | 'on_leave'
  | 'unavailable';

/**
 * Working schedule for a single day.
 */
export interface DailySchedule {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  is_available: boolean;
}

/**
 * Professional certification / license record.
 */
export interface MedicalLicense {
  license_number: string;
  issuing_authority: string;
  country: string;
  issued_date: string; // ISO 8601 date
  expiry_date: string; // ISO 8601 date
  status: 'active' | 'suspended' | 'expired' | 'revoked';
}

/**
 * Clinical performance metrics tracked over a rolling window.
 */
export interface DoctorPerformanceMetrics {
  patient_satisfaction_score: number; // 0-5
  average_consultation_minutes: number;
  triage_accuracy_rate: number; // 0-1
  follow_up_compliance_rate: number; // 0-1
  total_consultations_30d: number;
  total_consultations_lifetime: number;
  peer_review_score?: number; // 0-10
  last_evaluated: string; // ISO 8601 datetime
}

/**
 * Doctor / clinician record.
 */
export interface Doctor {
  id: DoctorId;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  specialties: MedicalSpecialty[];
  primary_specialty: MedicalSpecialty;
  licenses: MedicalLicense[];
  institution_id: string;
  department?: string;
  title: string; // e.g. "Senior Cardiologist"
  years_of_experience: number;
  languages: string[];
  schedule: DailySchedule[];
  availability_status: DoctorAvailabilityStatus;
  max_daily_patients: number;
  current_patient_load: number;
  telemedicine_enabled: boolean;
  performance_metrics?: DoctorPerformanceMetrics;
  profile_image_url?: string;
  bio?: string;
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
  is_active: boolean;
}

/**
 * Lightweight doctor summary for lists and routing displays.
 */
export interface DoctorSummary {
  id: DoctorId;
  first_name: string;
  last_name: string;
  primary_specialty: MedicalSpecialty;
  institution_id: string;
  availability_status: DoctorAvailabilityStatus;
  telemedicine_enabled: boolean;
  patient_satisfaction_score?: number;
  estimated_wait_time_minutes?: number;
}

/**
 * Parameters for searching / filtering doctors.
 */
export interface DoctorSearchParams {
  query?: string;
  specialty?: MedicalSpecialty;
  institution_id?: string;
  availability_status?: DoctorAvailabilityStatus;
  telemedicine_only?: boolean;
  language?: string;
  min_experience_years?: number;
  page?: number;
  page_size?: number;
  sort_by?: 'name' | 'experience' | 'satisfaction' | 'wait_time';
  sort_order?: 'asc' | 'desc';
}
