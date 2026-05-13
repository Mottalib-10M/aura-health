// ---------------------------------------------------------------------------
// @aura/shared - Zod Validators
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---- Reusable Primitives ----------------------------------------------------

export const PatientIdSchema = z.string().uuid('Invalid patient ID format');
export const DoctorIdSchema = z.string().uuid('Invalid doctor ID format');
export const InstitutionIdSchema = z.string().uuid('Invalid institution ID format');

export const ISODateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Must be a valid ISO 8601 date (YYYY-MM-DD)',
);

export const ISODateTimeSchema = z.string().datetime({
  message: 'Must be a valid ISO 8601 datetime',
});

export const BiologicalSexSchema = z.enum(['male', 'female', 'other']);

export const SeverityScaleSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const UrgencyLevelSchema = z.enum([
  'low',
  'moderate',
  'high',
  'critical',
  'emergency',
]);

// ---- Pagination -------------------------------------------------------------

export const PaginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ---- Vital Signs ------------------------------------------------------------

export const BloodPressureSchema = z.object({
  systolic: z.number().int().min(60).max(250),
  diastolic: z.number().int().min(30).max(150),
}).refine(
  (bp) => bp.systolic > bp.diastolic,
  { message: 'Systolic pressure must be greater than diastolic pressure' },
);

export const VitalSignsSchema = z.object({
  heart_rate_bpm: z.number().int().min(20).max(300).optional(),
  blood_pressure: BloodPressureSchema.optional(),
  temperature_celsius: z.number().min(30).max(45).optional(),
  spO2_percent: z.number().min(0).max(100).optional(),
  respiratory_rate: z.number().int().min(4).max(80).optional(),
  recorded_at: ISODateTimeSchema.optional(),
});

// ---- Patient Demographic ----------------------------------------------------

export const PatientDemographicSchema = z.object({
  age: z.number().int().min(0).max(150),
  sex: BiologicalSexSchema,
  pregnancy_status: z.boolean().optional(),
  bmi: z.number().min(10).max(80).optional(),
}).refine(
  (d) => !(d.sex === 'male' && d.pregnancy_status === true),
  { message: 'Males cannot have pregnancy_status set to true' },
);

// ---- Patient Location -------------------------------------------------------

export const PatientLocationSchema = z.object({
  region: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  district: z.string().max(100).optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

// ---- Triage Input -----------------------------------------------------------

export const TriageInputSchema = z.object({
  patient_id: PatientIdSchema,
  symptom_description: z.string()
    .min(10, 'Symptom description must be at least 10 characters')
    .max(5000, 'Symptom description must not exceed 5000 characters'),
  symptom_duration_hours: z.number()
    .min(0, 'Duration cannot be negative')
    .max(8760, 'Duration cannot exceed one year in hours'),
  severity_scale: SeverityScaleSchema,
  historical_conditions: z.array(z.string().min(1).max(200)).max(50),
  current_medications: z.array(z.string().min(1).max(200)).max(50),
  vital_signs: VitalSignsSchema.optional(),
  demographic: PatientDemographicSchema,
  location: PatientLocationSchema,
});

// ---- Triage Output ----------------------------------------------------------

export const SpecialtyRecommendationSchema = z.object({
  specialty: z.string().min(1).max(100),
  confidence_score: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  estimated_wait_time_minutes: z.number().int().min(0),
});

export const FollowUpProtocolSchema = z.object({
  timeframe_hours: z.number().min(1).max(8760),
  escalation_triggers: z.array(z.string().min(1).max(500)).min(1),
});

export const TriageOutputSchema = z.object({
  urgency_level: UrgencyLevelSchema,
  recommended_specializations: z.array(SpecialtyRecommendationSchema).min(1).max(10),
  red_flags: z.array(z.string().min(1).max(500)),
  suggested_diagnostics: z.array(z.string().min(1).max(500)),
  contraindications: z.array(z.string().min(1).max(500)),
  epidemiological_context: z.string().max(2000).optional(),
  follow_up_protocol: FollowUpProtocolSchema,
});

// ---- Time Series Data Point -------------------------------------------------

export const TimeSeriesDataPointSchema = z.object({
  timestamp: ISODateTimeSchema,
  value: z.number(),
});

// ---- Lifestyle Factors ------------------------------------------------------

export const LifestyleFactorsSchema = z.object({
  smoking: z.boolean(),
  alcohol_units_weekly: z.number().min(0).max(200),
  exercise_minutes_weekly: z.number().min(0).max(5000),
  diet_quality_score: z.number().min(1).max(10),
  stress_level: z.number().min(1).max(10),
});

// ---- Biometric Metrics ------------------------------------------------------

export const BiometricMetricsSchema = z.object({
  heart_rate: z.array(TimeSeriesDataPointSchema),
  hrv_ms: z.array(TimeSeriesDataPointSchema),
  spO2: z.array(TimeSeriesDataPointSchema),
  sleep_hours: z.array(TimeSeriesDataPointSchema),
  steps: z.array(TimeSeriesDataPointSchema),
  blood_glucose: z.array(TimeSeriesDataPointSchema).optional(),
  weight_kg: z.array(TimeSeriesDataPointSchema).optional(),
});

// ---- Longitudinal Input -----------------------------------------------------

export const LongitudinalInputSchema = z.object({
  patient_id: PatientIdSchema,
  time_window_days: z.number().int().min(1).max(365),
  metrics: BiometricMetricsSchema,
  lifestyle_factors: LifestyleFactorsSchema,
  previous_summaries: z.array(z.string().max(10000)).max(20),
});

// ---- Routing Decision -------------------------------------------------------

export const AITaskSchema = z.enum(['triage', 'longitudinal', 'vision_ocr', 'forecasting']);

export const TaskComplexitySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const RoutingDecisionSchema = z.object({
  task: AITaskSchema,
  complexity: TaskComplexitySchema,
  phi_exposure: z.boolean(),
  latency_requirement_ms: z.number().int().min(100).max(120000),
});

// ---- Efficacy Metric --------------------------------------------------------

export const OutcomeMetricsSchema = z.object({
  symptom_resolution_rate: z.number().min(0).max(1),
  time_to_improvement_days: z.number().min(0),
  adverse_event_rate: z.number().min(0).max(1),
  discontinuation_rate: z.number().min(0).max(1),
});

export const ComparativeEffectivenessSchema = z.object({
  vs_first_line_alternative: z.number().min(0),
  vs_regional_average: z.number().min(0).max(100),
});

export const EfficacyMetricSchema = z.object({
  prescription_id: z.string().min(1),
  drug_name: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  cohort_size: z.number().int().min(1),
  outcome_metrics: OutcomeMetricsSchema,
  comparative_effectiveness: ComparativeEffectivenessSchema,
  confidence_interval: z.object({
    lower: z.number(),
    upper: z.number(),
  }).refine(
    (ci) => ci.upper >= ci.lower,
    { message: 'Upper bound must be greater than or equal to lower bound' },
  ),
  last_updated: ISODateTimeSchema,
});

// ---- Supply Forecast --------------------------------------------------------

export const ForecastModelSchema = z.enum(['arima', 'prophet', 'lstm']);

export const DemandPredictionSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Must be in YYYY-MM format'),
  units: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

export const SupplyForecastSchema = z.object({
  pharmaceutical_id: z.string().min(1),
  current_stock: z.object({
    units: z.number().int().min(0),
    days_of_supply_remaining: z.number().min(0),
    warehouse_distribution: z.record(z.string(), z.number().int().min(0)),
  }),
  demand_forecast: z.object({
    model: ForecastModelSchema,
    horizon_months: z.number().int().min(1).max(36),
    predictions: z.array(DemandPredictionSchema).min(1),
  }),
  risk_assessment: z.object({
    stockout_probability: z.number().min(0).max(1),
    criticality_score: z.number().min(0).max(10),
    alternative_availability: z.boolean(),
  }),
  recommended_orders: z.array(z.object({
    supplier: z.string().min(1).max(200),
    quantity: z.number().int().min(1),
    order_date: ISODateSchema,
    estimated_delivery: ISODateSchema,
  })),
});

// ---- Login Request ----------------------------------------------------------

export const LoginRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(12).max(128).optional(),
  otp_code: z.string().length(6).optional(),
  mfa_code: z.string().length(6).optional(),
  device_fingerprint: z.string().max(256).optional(),
}).refine(
  (data) => data.email || data.phone,
  { message: 'Either email or phone must be provided' },
);

// ---- Appointment Creation ---------------------------------------------------

export const CreateAppointmentRequestSchema = z.object({
  patient_id: PatientIdSchema,
  doctor_id: DoctorIdSchema,
  institution_id: InstitutionIdSchema,
  triage_session_id: z.string().uuid().optional(),
  appointment_type: z.enum(['in_person', 'telemedicine', 'home_visit']),
  priority: z.enum(['routine', 'urgent', 'emergency']),
  scheduled_start: ISODateTimeSchema,
  scheduled_end: ISODateTimeSchema,
  reason_for_visit: z.string().min(5).max(1000),
  telemedicine_link: z.string().url().optional(),
  room_number: z.string().max(50).optional(),
}).refine(
  (data) => new Date(data.scheduled_end) > new Date(data.scheduled_start),
  { message: 'Scheduled end must be after scheduled start' },
);

// ---- Inferred Types from Schemas --------------------------------------------

export type ValidatedTriageInput = z.infer<typeof TriageInputSchema>;
export type ValidatedTriageOutput = z.infer<typeof TriageOutputSchema>;
export type ValidatedLongitudinalInput = z.infer<typeof LongitudinalInputSchema>;
export type ValidatedRoutingDecision = z.infer<typeof RoutingDecisionSchema>;
export type ValidatedEfficacyMetric = z.infer<typeof EfficacyMetricSchema>;
export type ValidatedSupplyForecast = z.infer<typeof SupplyForecastSchema>;
export type ValidatedLoginRequest = z.infer<typeof LoginRequestSchema>;
export type ValidatedCreateAppointment = z.infer<typeof CreateAppointmentRequestSchema>;
