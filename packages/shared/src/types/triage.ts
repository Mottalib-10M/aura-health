// ---------------------------------------------------------------------------
// Triage Domain Types
// ---------------------------------------------------------------------------

import type { PatientDemographic, PatientLocation, VitalSigns } from './patient';

/**
 * Urgency classification levels aligned with the Manchester Triage System
 * adapted for the Central Asian context.
 */
export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'critical' | 'emergency';

/**
 * Severity scale reported by the patient (1 = minimal, 5 = worst imaginable).
 */
export type SeverityScale = 1 | 2 | 3 | 4 | 5;

// ---- Triage Input -----------------------------------------------------------

/**
 * Input payload for the AI triage pipeline. This is the primary contract
 * between the frontend symptom-checker and the ML triage service.
 */
export interface TriageInput {
  patient_id: string;
  symptom_description: string;
  symptom_duration_hours: number;
  severity_scale: SeverityScale;
  historical_conditions: string[];
  current_medications: string[];
  vital_signs?: VitalSigns;
  demographic: PatientDemographic;
  location: PatientLocation;
}

// ---- Triage Output ----------------------------------------------------------

/**
 * A single specialty recommendation returned by the triage model.
 */
export interface SpecialtyRecommendation {
  specialty: string;
  confidence_score: number; // 0-1
  rationale: string;
  estimated_wait_time_minutes: number;
}

/**
 * Follow-up protocol attached to every triage result.
 */
export interface FollowUpProtocol {
  timeframe_hours: number;
  escalation_triggers: string[];
}

/**
 * Output payload produced by the AI triage pipeline.
 */
export interface TriageOutput {
  urgency_level: UrgencyLevel;
  recommended_specializations: SpecialtyRecommendation[];
  red_flags: string[];
  suggested_diagnostics: string[];
  contraindications: string[];
  epidemiological_context?: string;
  follow_up_protocol: FollowUpProtocol;
}

// ---- Triage Session ---------------------------------------------------------

/**
 * Status of a triage session through its lifecycle.
 */
export type TriageSessionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'escalated'
  | 'cancelled'
  | 'expired';

/**
 * Full triage session record persisted in the database. Includes both the
 * request, the AI result, and audit metadata.
 */
export interface TriageSession {
  id: string;
  patient_id: string;
  input: TriageInput;
  output?: TriageOutput;
  status: TriageSessionStatus;
  model_version: string;
  inference_latency_ms?: number;
  reviewed_by_doctor_id?: string;
  doctor_override?: Partial<TriageOutput>;
  override_reason?: string;
  feedback_score?: number; // 1-5 from the reviewing clinician
  feedback_notes?: string;
  created_at: string; // ISO 8601 datetime
  completed_at?: string; // ISO 8601 datetime
  expires_at: string; // ISO 8601 datetime
}

/**
 * Parameters for querying triage history.
 */
export interface TriageHistoryParams {
  patient_id?: string;
  urgency_level?: UrgencyLevel;
  status?: TriageSessionStatus;
  date_from?: string; // ISO 8601 date
  date_to?: string; // ISO 8601 date
  reviewed_only?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: 'created_at' | 'urgency_level' | 'status';
  sort_order?: 'asc' | 'desc';
}

/**
 * Aggregated triage statistics for dashboards.
 */
export interface TriageStatistics {
  total_sessions: number;
  by_urgency: Record<UrgencyLevel, number>;
  by_status: Record<TriageSessionStatus, number>;
  average_inference_latency_ms: number;
  average_feedback_score: number;
  override_rate: number; // 0-1
  period_start: string; // ISO 8601 date
  period_end: string; // ISO 8601 date
}
