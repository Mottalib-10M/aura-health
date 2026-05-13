// ---------------------------------------------------------------------------
// Prescription & Efficacy Domain Types
// ---------------------------------------------------------------------------

export type PrescriptionId = string;

/**
 * Prescription lifecycle status.
 */
export type PrescriptionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'dispensed'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'on_hold';

/**
 * Route of drug administration.
 */
export type AdministrationRoute =
  | 'oral'
  | 'intravenous'
  | 'intramuscular'
  | 'subcutaneous'
  | 'topical'
  | 'inhaled'
  | 'rectal'
  | 'sublingual'
  | 'transdermal'
  | 'ophthalmic'
  | 'otic'
  | 'nasal'
  | 'other';

/**
 * A single drug/medication entry within a prescription.
 */
export interface PrescriptionItem {
  drug_name: string;
  drug_code?: string; // ATC code or national formulary code
  generic_name?: string;
  dosage: string; // e.g. "500mg"
  dosage_value?: number;
  dosage_unit?: string;
  frequency: string; // e.g. "twice daily"
  route: AdministrationRoute;
  duration_days: number;
  quantity: number;
  refills_allowed: number;
  refills_used: number;
  instructions?: string; // patient-facing instructions
  is_controlled_substance: boolean;
  requires_prior_auth: boolean;
}

/**
 * Drug interaction warning.
 */
export interface DrugInteraction {
  drug_a: string;
  drug_b: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  recommendation: string;
  evidence_level: 'established' | 'probable' | 'suspected' | 'theoretical';
}

/**
 * Full prescription record.
 */
export interface Prescription {
  id: PrescriptionId;
  patient_id: string;
  prescribing_doctor_id: string;
  institution_id: string;
  appointment_id?: string;
  triage_session_id?: string;
  status: PrescriptionStatus;
  items: PrescriptionItem[];
  diagnosis_codes: string[]; // ICD-10
  interactions_checked: boolean;
  interactions_found: DrugInteraction[];
  clinical_notes?: string;
  pharmacy_notes?: string;
  dispensing_pharmacy_id?: string;
  dispensed_at?: string; // ISO 8601 datetime
  valid_from: string; // ISO 8601 date
  valid_until: string; // ISO 8601 date
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
}

/**
 * Lightweight prescription summary.
 */
export interface PrescriptionSummary {
  id: PrescriptionId;
  patient_id: string;
  doctor_name: string;
  status: PrescriptionStatus;
  item_count: number;
  primary_drug: string;
  valid_from: string;
  valid_until: string;
  has_interactions: boolean;
}

// ---- Efficacy Metrics -------------------------------------------------------

/**
 * Treatment outcome measurements.
 */
export interface OutcomeMetrics {
  symptom_resolution_rate: number; // 0-1
  time_to_improvement_days: number;
  adverse_event_rate: number; // 0-1
  discontinuation_rate: number; // 0-1
}

/**
 * Comparative effectiveness data against alternatives.
 */
export interface ComparativeEffectiveness {
  vs_first_line_alternative: number; // odds ratio
  vs_regional_average: number; // percentile 0-100
}

/**
 * Drug efficacy metric for a specific prescription or drug cohort.
 */
export interface EfficacyMetric {
  prescription_id: string;
  drug_name: string;
  dosage: string;
  cohort_size: number;
  outcome_metrics: OutcomeMetrics;
  comparative_effectiveness: ComparativeEffectiveness;
  confidence_interval: { lower: number; upper: number };
  last_updated: string; // ISO 8601 datetime
}

/**
 * Regional drug efficacy summary for population health dashboards.
 */
export interface RegionalEfficacySummary {
  region: string;
  drug_name: string;
  drug_code?: string;
  total_prescriptions: number;
  average_outcome: OutcomeMetrics;
  efficacy_trend: 'improving' | 'stable' | 'declining';
  period_start: string; // ISO 8601 date
  period_end: string; // ISO 8601 date
}

/**
 * Parameters for querying prescriptions.
 */
export interface PrescriptionSearchParams {
  patient_id?: string;
  doctor_id?: string;
  institution_id?: string;
  status?: PrescriptionStatus;
  drug_name?: string;
  date_from?: string;
  date_to?: string;
  has_interactions?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: 'created_at' | 'valid_from' | 'status';
  sort_order?: 'asc' | 'desc';
}

/**
 * Parameters for querying efficacy data.
 */
export interface EfficacySearchParams {
  drug_name?: string;
  region?: string;
  min_cohort_size?: number;
  min_resolution_rate?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}
