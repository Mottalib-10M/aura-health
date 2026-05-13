// ---------------------------------------------------------------------------
// Telemetry / Biometric Domain Types
// ---------------------------------------------------------------------------

/**
 * A single timestamped metric data point from a wearable or clinical device.
 */
export interface TimeSeriesDataPoint {
  timestamp: string; // ISO 8601 datetime
  value: number;
}

/**
 * Device source metadata for biometric data provenance.
 */
export interface DeviceSource {
  device_id: string;
  device_type: 'smartwatch' | 'fitness_band' | 'cgm' | 'pulse_oximeter' | 'bp_monitor' | 'scale' | 'clinical_monitor' | 'other';
  manufacturer?: string;
  model?: string;
  firmware_version?: string;
  last_synced_at: string; // ISO 8601 datetime
}

/**
 * Lifestyle factors reported by or inferred for the patient.
 */
export interface LifestyleFactors {
  smoking: boolean;
  alcohol_units_weekly: number;
  exercise_minutes_weekly: number;
  diet_quality_score: number; // 1-10
  stress_level: number; // 1-10
}

/**
 * Collection of biometric time-series metrics.
 */
export interface BiometricMetrics {
  heart_rate: TimeSeriesDataPoint[];
  hrv_ms: TimeSeriesDataPoint[];
  spO2: TimeSeriesDataPoint[];
  sleep_hours: TimeSeriesDataPoint[];
  steps: TimeSeriesDataPoint[];
  blood_glucose?: TimeSeriesDataPoint[];
  weight_kg?: TimeSeriesDataPoint[];
}

// ---- Longitudinal Input -----------------------------------------------------

/**
 * Input payload for the longitudinal health analysis pipeline. Aggregates
 * wearable telemetry and lifestyle data over a configurable time window.
 */
export interface LongitudinalInput {
  patient_id: string;
  time_window_days: number;
  metrics: BiometricMetrics;
  lifestyle_factors: LifestyleFactors;
  previous_summaries: string[];
}

// ---- Longitudinal Output ----------------------------------------------------

/**
 * A detected trend in biometric data.
 */
export interface BiometricTrend {
  metric_name: string;
  direction: 'improving' | 'stable' | 'declining' | 'volatile';
  magnitude: number; // percentage change
  clinical_significance: 'none' | 'low' | 'moderate' | 'high';
  description: string;
}

/**
 * An anomaly detected in the biometric stream.
 */
export interface BiometricAnomaly {
  metric_name: string;
  timestamp: string;
  observed_value: number;
  expected_range: { min: number; max: number };
  severity: 'info' | 'warning' | 'alert' | 'critical';
  possible_causes: string[];
}

/**
 * Risk assessment produced by the longitudinal model.
 */
export interface HealthRiskAssessment {
  category: string; // e.g. "cardiovascular", "metabolic"
  risk_level: 'low' | 'moderate' | 'elevated' | 'high';
  score: number; // 0-100
  contributing_factors: string[];
  recommended_actions: string[];
}

/**
 * Output payload from the longitudinal health analysis pipeline.
 */
export interface LongitudinalOutput {
  patient_id: string;
  analysis_period: {
    start: string; // ISO 8601 date
    end: string; // ISO 8601 date
  };
  summary: string; // Human-readable narrative summary
  trends: BiometricTrend[];
  anomalies: BiometricAnomaly[];
  risk_assessments: HealthRiskAssessment[];
  recommendations: string[];
  next_review_date: string; // ISO 8601 date
  model_version: string;
  confidence_score: number; // 0-1
}

/**
 * A stored longitudinal report with audit metadata.
 */
export interface LongitudinalReport {
  id: string;
  patient_id: string;
  input: LongitudinalInput;
  output: LongitudinalOutput;
  reviewed_by_doctor_id?: string;
  review_notes?: string;
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
}

/**
 * Device registration payload for linking a patient to a wearable.
 */
export interface DeviceRegistration {
  patient_id: string;
  device: DeviceSource;
  consent_granted: boolean;
  consent_date: string; // ISO 8601 date
  data_sharing_preferences: {
    share_with_doctor: boolean;
    share_with_institution: boolean;
    share_for_research: boolean;
  };
}
