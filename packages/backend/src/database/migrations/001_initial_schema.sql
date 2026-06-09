-- ============================================================================
-- Uzavita Platform — Initial Database Schema
-- PostgreSQL 16+ with TimescaleDB extension
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'patient', 'doctor', 'hospital_admin', 'analyst', 'system_admin'
);

CREATE TYPE urgency_level AS ENUM (
  'EMERGENCY', 'URGENT', 'SEMI_URGENT', 'NON_URGENT'
);

CREATE TYPE verification_status AS ENUM (
  'PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'
);

CREATE TYPE appointment_status AS ENUM (
  'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS',
  'COMPLETED', 'CANCELLED', 'NO_SHOW'
);

CREATE TYPE institution_type AS ENUM (
  'HOSPITAL', 'CLINIC', 'POLYCLINIC', 'DIAGNOSTIC_CENTER',
  'PHARMACY', 'REHABILITATION_CENTER'
);

CREATE TYPE institution_tier AS ENUM (
  'PRIMARY', 'SECONDARY', 'TERTIARY', 'QUATERNARY'
);

CREATE TYPE alert_level AS ENUM (
  'WATCH', 'WARNING', 'ALERT', 'EMERGENCY'
);

-- ============================================================================
-- PATIENTS
-- ============================================================================

CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aura_id         VARCHAR(32) NOT NULL UNIQUE,
  biometric_hash  VARCHAR(128),
  public_key      TEXT,
  -- Encrypted PII (AES-256-GCM in application layer)
  first_name      VARCHAR(128) NOT NULL,
  last_name       VARCHAR(128) NOT NULL,
  date_of_birth   DATE NOT NULL,
  gender          VARCHAR(16) NOT NULL,
  blood_type      VARCHAR(8),
  -- Demographics
  region          VARCHAR(64) NOT NULL,
  city            VARCHAR(64) NOT NULL,
  language        VARCHAR(16) NOT NULL DEFAULT 'uz',
  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT true,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_aura_id ON patients (aura_id);
CREATE INDEX idx_patients_region ON patients (region);
CREATE INDEX idx_patients_region_city ON patients (region, city);
CREATE INDEX idx_patients_created_at ON patients (created_at DESC);
CREATE INDEX idx_patients_active ON patients (is_active) WHERE is_active = true;

-- Patient contact information (separate table for access control)
CREATE TABLE patient_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  phone       VARCHAR(32),
  email       VARCHAR(128),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_contacts_patient ON patient_contacts (patient_id);

-- ============================================================================
-- DOCTORS
-- ============================================================================

CREATE TABLE doctors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name              VARCHAR(128) NOT NULL,
  last_name               VARCHAR(128) NOT NULL,
  license_number          VARCHAR(64) NOT NULL UNIQUE,
  specialty               VARCHAR(128) NOT NULL,
  subspecialty             VARCHAR(128),
  institution_id          UUID,
  verification_status     verification_status NOT NULL DEFAULT 'PENDING',
  efficacy_score          REAL,
  satisfaction_score      REAL,
  consultation_count      INTEGER NOT NULL DEFAULT 0,
  region                  VARCHAR(64) NOT NULL,
  languages               JSONB NOT NULL DEFAULT '[]',
  -- Blockchain credential attestation
  credential_attestation_tx  VARCHAR(256),
  credential_attestation_at  TIMESTAMPTZ,
  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_specialty ON doctors (specialty);
CREATE INDEX idx_doctors_region ON doctors (region);
CREATE INDEX idx_doctors_verification ON doctors (verification_status);
CREATE INDEX idx_doctors_efficacy ON doctors (efficacy_score DESC NULLS LAST);
CREATE INDEX idx_doctors_institution ON doctors (institution_id) WHERE institution_id IS NOT NULL;

-- Doctor credential documents
CREATE TABLE doctor_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  document_url  TEXT NOT NULL,
  document_hash VARCHAR(128),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctor_credentials_doctor ON doctor_credentials (doctor_id);

-- Doctor weekly schedule
CREATE TABLE doctor_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (doctor_id, day_of_week, start_time)
);

CREATE INDEX idx_doctor_schedules_doctor ON doctor_schedules (doctor_id);

-- Verification audit log
CREATE TABLE verification_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  new_status  verification_status NOT NULL,
  changed_by  UUID NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_audit_doctor ON verification_audit_log (doctor_id);

-- ============================================================================
-- INSTITUTIONS
-- ============================================================================

CREATE TABLE institutions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(256) NOT NULL,
  type              institution_type NOT NULL,
  tier              institution_tier NOT NULL,
  region            VARCHAR(64) NOT NULL,
  city              VARCHAR(64) NOT NULL,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  bed_capacity      INTEGER,
  current_occupancy INTEGER DEFAULT 0,
  specialties       JSONB NOT NULL DEFAULT '[]',
  equipment         JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK now that institutions table exists
ALTER TABLE doctors ADD CONSTRAINT fk_doctors_institution
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX idx_institutions_region ON institutions (region);
CREATE INDEX idx_institutions_type ON institutions (type);
CREATE INDEX idx_institutions_tier ON institutions (tier);
CREATE INDEX idx_institutions_geo ON institutions (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Departments within an institution
CREATE TABLE departments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name              VARCHAR(128) NOT NULL,
  head_doctor_id    UUID REFERENCES doctors(id) ON DELETE SET NULL,
  bed_count         INTEGER NOT NULL DEFAULT 0,
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_institution ON departments (institution_id);

-- Institution resources (equipment, supplies)
CREATE TABLE institution_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  resource_type   VARCHAR(64) NOT NULL,
  total_units     INTEGER NOT NULL DEFAULT 0,
  in_use          INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, resource_type)
);

-- Admissions tracking
CREATE TABLE admissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  institution_id  UUID NOT NULL REFERENCES institutions(id),
  department_id   UUID REFERENCES departments(id),
  admitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharge_at    TIMESTAMPTZ,
  diagnosis_codes TEXT[],
  notes           TEXT
);

CREATE INDEX idx_admissions_patient ON admissions (patient_id);
CREATE INDEX idx_admissions_institution ON admissions (institution_id);
CREATE INDEX idx_admissions_department ON admissions (department_id);
CREATE INDEX idx_admissions_admitted ON admissions (admitted_at DESC);

-- ============================================================================
-- BIOMETRIC TELEMETRY (TimescaleDB hypertable)
-- ============================================================================

CREATE TABLE biometric_telemetry (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL,  -- No FK for hypertable performance; enforced in app
  metric_type VARCHAR(32) NOT NULL,  -- heart_rate, spo2, hrv, temperature, etc.
  value       DOUBLE PRECISION NOT NULL,
  device_id   VARCHAR(64),
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, recorded_at)
);

-- Convert to TimescaleDB hypertable (partitioned by recorded_at)
SELECT create_hypertable('biometric_telemetry', 'recorded_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

CREATE INDEX idx_telemetry_patient_time ON biometric_telemetry (patient_id, recorded_at DESC);
CREATE INDEX idx_telemetry_metric ON biometric_telemetry (patient_id, metric_type, recorded_at DESC);

-- ============================================================================
-- TRIAGE EVENTS
-- ============================================================================

CREATE TABLE triage_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                  UUID NOT NULL REFERENCES patients(id),
  symptoms                    JSONB NOT NULL DEFAULT '[]',
  symptom_description         TEXT NOT NULL,
  urgency_level               urgency_level NOT NULL,
  confidence_score            REAL NOT NULL,
  recommended_specializations JSONB NOT NULL DEFAULT '[]',
  red_flags                   JSONB NOT NULL DEFAULT '[]',
  suggested_diagnostics       JSONB NOT NULL DEFAULT '[]',
  differential_diagnoses      JSONB NOT NULL DEFAULT '[]',
  model_used                  VARCHAR(64) NOT NULL,
  response_latency_ms         INTEGER NOT NULL,
  follow_up_scheduled         BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_triage_patient ON triage_events (patient_id, created_at DESC);
CREATE INDEX idx_triage_urgency ON triage_events (urgency_level, created_at DESC);

-- ============================================================================
-- PRESCRIPTIONS
-- ============================================================================

CREATE TABLE prescriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID NOT NULL REFERENCES patients(id),
  doctor_id             UUID NOT NULL REFERENCES doctors(id),
  diagnosis_codes       TEXT[] NOT NULL DEFAULT '{}',  -- ICD-11 codes
  medications           JSONB NOT NULL DEFAULT '[]',   -- Array of {drugName, dosage, frequency, durationDays, route, instructions}
  outcome_assessment    TEXT,
  efficacy_score        REAL,
  side_effects_reported JSONB DEFAULT '[]',
  follow_up_date        DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_patient ON prescriptions (patient_id, created_at DESC);
CREATE INDEX idx_prescriptions_doctor ON prescriptions (doctor_id, created_at DESC);
CREATE INDEX idx_prescriptions_efficacy ON prescriptions (efficacy_score) WHERE efficacy_score IS NOT NULL;
CREATE INDEX idx_prescriptions_diagnosis ON prescriptions USING GIN (diagnosis_codes);

-- ============================================================================
-- SURVEILLANCE DATA (TimescaleDB hypertable)
-- ============================================================================

CREATE TABLE surveillance_data (
  id                  UUID NOT NULL DEFAULT gen_random_uuid(),
  region              VARCHAR(64) NOT NULL,
  city                VARCHAR(64) NOT NULL,
  disease_code        VARCHAR(32) NOT NULL,
  disease_name        VARCHAR(128),
  case_count          INTEGER NOT NULL DEFAULT 0,
  death_count         INTEGER NOT NULL DEFAULT 0,
  recovered_count     INTEGER NOT NULL DEFAULT 0,
  test_positivity_rate REAL NOT NULL DEFAULT 0,
  alert_level         alert_level NOT NULL DEFAULT 'WATCH',
  report_date         TIMESTAMPTZ NOT NULL,
  data_source         VARCHAR(64),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, report_date)
);

SELECT create_hypertable('surveillance_data', 'report_date',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_surveillance_region ON surveillance_data (region, report_date DESC);
CREATE INDEX idx_surveillance_disease ON surveillance_data (disease_code, report_date DESC);
CREATE INDEX idx_surveillance_alert ON surveillance_data (alert_level, report_date DESC);

-- ============================================================================
-- OUTBREAK ALERTS
-- ============================================================================

CREATE TABLE outbreak_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region            VARCHAR(64) NOT NULL,
  city              VARCHAR(64),
  disease_code      VARCHAR(32) NOT NULL,
  disease_name      VARCHAR(128),
  alert_level       alert_level NOT NULL,
  case_count        INTEGER NOT NULL,
  growth_rate       REAL NOT NULL DEFAULT 0,
  detection_method  VARCHAR(32) NOT NULL,
  message           TEXT NOT NULL,
  recommendations   JSONB NOT NULL DEFAULT '[]',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  declared_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbreak_active ON outbreak_alerts (is_active, declared_at DESC);
CREATE INDEX idx_outbreak_region ON outbreak_alerts (region, is_active);

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================

CREATE TABLE appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(id),
  doctor_id         UUID NOT NULL REFERENCES doctors(id),
  institution_id    UUID REFERENCES institutions(id),
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER NOT NULL DEFAULT 30,
  status            appointment_status NOT NULL DEFAULT 'SCHEDULED',
  check_in_code     VARCHAR(16),
  estimated_wait    INTEGER,  -- minutes
  reason            TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient ON appointments (patient_id, scheduled_at DESC);
CREATE INDEX idx_appointments_doctor ON appointments (doctor_id, scheduled_at);
CREATE INDEX idx_appointments_status ON appointments (status, scheduled_at);
CREATE INDEX idx_appointments_date ON appointments (DATE(scheduled_at), doctor_id);

-- Appointment reminders (for background worker)
CREATE TABLE appointment_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE UNIQUE,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  sent            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_pending ON appointment_reminders (scheduled_for)
  WHERE sent = false;

-- ============================================================================
-- EFFICACY METRICS (materialized / computed)
-- ============================================================================

CREATE TABLE efficacy_metrics (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name                   VARCHAR(128) NOT NULL,
  dosage                      VARCHAR(64),
  diagnosis_code              VARCHAR(32) NOT NULL,
  cohort_size                 INTEGER NOT NULL DEFAULT 0,
  outcome_metrics             JSONB NOT NULL DEFAULT '{}',
  comparative_effectiveness   REAL,
  region                      VARCHAR(64),
  timeframe_months            INTEGER NOT NULL DEFAULT 12,
  last_updated                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_efficacy_drug ON efficacy_metrics (drug_name);
CREATE INDEX idx_efficacy_diagnosis ON efficacy_metrics (diagnosis_code);

-- ============================================================================
-- SUPPLY FORECASTS
-- ============================================================================

CREATE TABLE supply_forecasts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmaceutical_id         VARCHAR(64) NOT NULL,
  pharmaceutical_name       VARCHAR(256) NOT NULL,
  region                    VARCHAR(64) NOT NULL,
  current_stock             INTEGER NOT NULL DEFAULT 0,
  daily_consumption_rate    REAL NOT NULL DEFAULT 0,
  forecasted_demand         INTEGER NOT NULL DEFAULT 0,
  days_until_stockout       INTEGER NOT NULL DEFAULT 0,
  reorder_point             INTEGER NOT NULL DEFAULT 0,
  suggested_order_quantity  INTEGER NOT NULL DEFAULT 0,
  confidence                REAL NOT NULL DEFAULT 0,
  forecast_date             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supply_pharmaceutical ON supply_forecasts (pharmaceutical_id);
CREATE INDEX idx_supply_region ON supply_forecasts (region);

-- ============================================================================
-- AUDIT LOG (local blockchain fallback)
-- ============================================================================

CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    VARCHAR(32) NOT NULL,
  entity_id     VARCHAR(128) NOT NULL,
  actor_id      VARCHAR(128),
  payload_hash  VARCHAR(128) NOT NULL,
  chain_hash    VARCHAR(128),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_id, created_at DESC);
CREATE INDEX idx_audit_type ON audit_log (event_type, created_at DESC);

-- ============================================================================
-- TRIGGERS — auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_patients
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_doctors
  BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_institutions
  BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_prescriptions
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_outbreak_alerts
  BEFORE UPDATE ON outbreak_alerts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- TimescaleDB retention policies (optional, for production)
-- ============================================================================

-- Keep telemetry data for 2 years
-- SELECT add_retention_policy('biometric_telemetry', INTERVAL '2 years', if_not_exists => TRUE);

-- Keep surveillance data for 5 years
-- SELECT add_retention_policy('surveillance_data', INTERVAL '5 years', if_not_exists => TRUE);

-- ============================================================================
-- Continuous aggregates for analytics (optional)
-- ============================================================================

-- Hourly telemetry aggregates
-- CREATE MATERIALIZED VIEW telemetry_hourly
-- WITH (timescaledb.continuous) AS
-- SELECT
--   patient_id,
--   metric_type,
--   time_bucket('1 hour', recorded_at) AS bucket,
--   AVG(value) AS avg_value,
--   MIN(value) AS min_value,
--   MAX(value) AS max_value,
--   COUNT(*) AS sample_count
-- FROM biometric_telemetry
-- GROUP BY patient_id, metric_type, bucket;

-- Daily surveillance aggregates
-- CREATE MATERIALIZED VIEW surveillance_daily
-- WITH (timescaledb.continuous) AS
-- SELECT
--   region,
--   disease_code,
--   time_bucket('1 day', report_date) AS bucket,
--   SUM(case_count) AS total_cases,
--   SUM(death_count) AS total_deaths,
--   AVG(test_positivity_rate) AS avg_positivity
-- FROM surveillance_data
-- GROUP BY region, disease_code, bucket;
