// ---------------------------------------------------------------------------
// Patient Domain Types
// ---------------------------------------------------------------------------

/**
 * Core patient identifier. Typically a UUIDv4 conforming to FHIR R4 patient
 * resource semantics.
 */
export type PatientId = string;

/**
 * Biological sex used for clinical decision-making contexts (e.g. drug
 * interactions, reference ranges).
 */
export type BiologicalSex = 'male' | 'female' | 'other';

/**
 * Blood type classifications following the ABO/Rh system.
 */
export type BloodType =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-'
  | 'unknown';

/**
 * Patient demographic information used across triage, longitudinal analysis,
 * and epidemiological modules.
 */
export interface PatientDemographic {
  age: number;
  sex: BiologicalSex;
  pregnancy_status?: boolean;
  bmi?: number;
}

/**
 * Geographic location for a patient, used for regional triage routing and
 * epidemiological surveillance.
 */
export interface PatientLocation {
  region: string;
  city: string;
  district?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Emergency contact record.
 */
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

/**
 * Insurance / coverage information.
 */
export interface InsuranceCoverage {
  provider: string;
  policy_number: string;
  coverage_type: 'public' | 'private' | 'mixed' | 'self-pay';
  valid_until: string; // ISO 8601 date
}

/**
 * Known allergy entry.
 */
export interface Allergy {
  substance: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction_description?: string;
  verified: boolean;
  reported_date?: string; // ISO 8601 date
}

/**
 * Chronic or historical condition entry.
 */
export interface MedicalCondition {
  icd10_code: string;
  name: string;
  diagnosed_date?: string; // ISO 8601 date
  status: 'active' | 'resolved' | 'in-remission' | 'chronic';
  severity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
}

/**
 * Current medication entry.
 */
export interface CurrentMedication {
  drug_name: string;
  dosage: string;
  frequency: string;
  route: 'oral' | 'intravenous' | 'intramuscular' | 'topical' | 'subcutaneous' | 'inhaled' | 'other';
  prescribed_date?: string; // ISO 8601 date
  prescribing_doctor_id?: string;
}

/**
 * Vital sign snapshot.
 */
export interface VitalSigns {
  heart_rate_bpm?: number;
  blood_pressure?: {
    systolic: number;
    diastolic: number;
  };
  temperature_celsius?: number;
  spO2_percent?: number;
  respiratory_rate?: number;
  recorded_at?: string; // ISO 8601 datetime
}

/**
 * Full patient record. This is the canonical representation stored in the
 * backend and transmitted across service boundaries. PHI fields are marked
 * for encryption-at-rest.
 */
export interface Patient {
  id: PatientId;
  external_id?: string; // National health ID or MRN
  first_name: string; // PHI
  last_name: string; // PHI
  date_of_birth: string; // ISO 8601 date, PHI
  demographic: PatientDemographic;
  location: PatientLocation;
  blood_type: BloodType;
  allergies: Allergy[];
  medical_conditions: MedicalCondition[];
  current_medications: CurrentMedication[];
  emergency_contacts: EmergencyContact[];
  insurance?: InsuranceCoverage;
  preferred_language: string;
  consent_signed: boolean;
  consent_date?: string; // ISO 8601 date
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
  is_active: boolean;
}

/**
 * Minimal patient summary returned in list views and search results to
 * reduce PHI exposure.
 */
export interface PatientSummary {
  id: PatientId;
  first_name: string;
  last_name: string;
  age: number;
  sex: BiologicalSex;
  location: PatientLocation;
  active_conditions_count: number;
  last_visit_date?: string;
  risk_score?: number; // 0-100 composite risk
}

/**
 * Parameters for searching / filtering patients.
 */
export interface PatientSearchParams {
  query?: string;
  region?: string;
  city?: string;
  age_min?: number;
  age_max?: number;
  sex?: BiologicalSex;
  condition_icd10?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: 'name' | 'age' | 'last_visit' | 'risk_score';
  sort_order?: 'asc' | 'desc';
}
