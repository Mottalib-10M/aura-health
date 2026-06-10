-- ============================================================================
-- Demo seed data for Uzavita Platform
-- Run: psql $DATABASE_URL -f demo-data.sql
-- ============================================================================
-- Creates login-ready users (password = "demo123" for all):
--   Doctor:  demo-doctor@uzavita.com  (ID: 00000000-0000-0000-0000-000000000001)
--   Patient: demo-patient@uzavita.com (ID: 00000000-0000-0000-0000-000000000002)
-- ============================================================================

-- bcrypt hash for "demo123" (12 rounds)
-- $2a$12$GB3Lr144.vYI5R3ENGEpHOtFzefdRUMzzhzCiF3/4YT6AnNadPV5e

-- ── Institution ─────────────────────────────────────────────────────────────

INSERT INTO institutions (id, name, type, tier, region, city, latitude, longitude, bed_capacity, current_occupancy, specialties, equipment, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Tashkent City Medical Center',
  'HOSPITAL', 'TERTIARY',
  'Tashkent', 'Tashkent',
  41.2995, 69.2401,
  400, 245,
  '["Cardiology","Endocrinology","General Medicine","Neurology","Pulmonology","Orthopedics"]',
  '["MRI","CT Scanner","X-Ray","Ultrasound","ECG","Ventilator"]',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ── Demo Doctor ─────────────────────────────────────────────────────────────

INSERT INTO doctors (id, first_name, last_name, license_number, specialty, subspecialty, institution_id, verification_status, efficacy_score, satisfaction_score, consultation_count, region, languages, password_hash, email, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Aziz', 'Karimov',
  'MD-TAS-00001',
  'Cardiology', 'Interventional Cardiology',
  '00000000-0000-0000-0000-000000000010',
  'VERIFIED',
  0.87, 0.92, 347,
  'Tashkent',
  '["uz","ru","en"]',
  '$2a$12$GB3Lr144.vYI5R3ENGEpHOtFzefdRUMzzhzCiF3/4YT6AnNadPV5e',
  'demo-doctor@uzavita.com',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ── Demo Patient ────────────────────────────────────────────────────────────

INSERT INTO patients (id, aura_id, first_name, last_name, date_of_birth, gender, blood_type, region, city, language, is_active, password_hash, email, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'AH-TAS-DEMO0001',
  'Gulnora', 'Abdullayeva',
  '1990-05-15', 'female', 'A+',
  'Tashkent', 'Tashkent',
  'uz', true,
  '$2a$12$GB3Lr144.vYI5R3ENGEpHOtFzefdRUMzzhzCiF3/4YT6AnNadPV5e',
  'demo-patient@uzavita.com',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ── Additional Patients (doctor's patient list) ─────────────────────────────

INSERT INTO patients (id, aura_id, first_name, last_name, date_of_birth, gender, blood_type, region, city, language, is_active, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000003', 'AH-TAS-DEMO0002', 'Bobur',    'Tursunov',   '1985-03-22', 'male',   'B+',  'Tashkent',   'Tashkent',   'uz', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'AH-TAS-DEMO0003', 'Madina',   'Rakhimova',  '1978-11-08', 'female', 'O+',  'Tashkent',   'Chirchiq',   'uz', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', 'AH-SAM-DEMO0004', 'Dilshod',  'Ergashev',   '1995-07-14', 'male',   'AB+', 'Samarkand',  'Samarkand',  'uz', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000006', 'AH-FER-DEMO0005', 'Kamola',   'Ismoilova',  '1988-01-30', 'female', 'A-',  'Fergana',    'Fergana',    'uz', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000007', 'AH-TAS-DEMO0006', 'Nodir',    'Hamidov',    '2001-09-05', 'male',   'O-',  'Tashkent',   'Tashkent',   'ru', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000008', 'AH-TAS-DEMO0007', 'Zarina',   'Nazarova',   '1972-06-18', 'female', 'B-',  'Tashkent',   'Tashkent',   'uz', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000009', 'AH-BUK-DEMO0008', 'Rustam',   'Pulatov',    '1998-12-01', 'male',   'A+',  'Bukhara',    'Bukhara',    'uz', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ── Doctor Schedule (Mon-Sat) ───────────────────────────────────────────────

INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, is_available) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 1, '08:00', '12:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 1, '13:00', '17:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 2, '08:00', '12:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 2, '13:00', '17:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 3, '08:00', '12:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 3, '13:00', '17:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 4, '08:00', '12:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 4, '13:00', '17:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 5, '08:00', '12:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 5, '13:00', '16:00', true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 6, '09:00', '13:00', true)
ON CONFLICT (doctor_id, day_of_week, start_time) DO NOTHING;

-- ── Appointments ────────────────────────────────────────────────────────────

INSERT INTO appointments (id, patient_id, doctor_id, institution_id, scheduled_at, duration_minutes, status, check_in_code, reason, notes, created_at, updated_at) VALUES
  -- Upcoming for demo patient
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '2 days' + INTERVAL '9 hours', 30, 'CONFIRMED', '123456', 'Cardiac follow-up', NULL, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '9 days' + INTERVAL '14 hours', 45, 'SCHEDULED', '789012', 'ECG review', NULL, NOW(), NOW()),
  -- Past for demo patient
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() - INTERVAL '7 days' + INTERVAL '10 hours', 30, 'COMPLETED', '345678', 'Initial cardiac assessment', 'BP 130/85, mild LVH noted on echo', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() - INTERVAL '30 days' + INTERVAL '11 hours', 30, 'COMPLETED', '901234', 'Routine checkup', 'All vitals normal', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() - INTERVAL '14 days' + INTERVAL '15 hours', 30, 'CANCELLED', '567890', 'Follow-up visit', 'Cancelled: Patient rescheduled', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),

  -- Other patients with demo doctor (for doctor dashboard)
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '10 hours', 30, 'CONFIRMED', '111111', 'Hypertension follow-up', NULL, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '11 hours', 45, 'SCHEDULED', '222222', 'Chest pain evaluation', NULL, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '13 hours', 30, 'CONFIRMED', '333333', 'Post-operative cardiac rehab', NULL, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '15 hours', 30, 'SCHEDULED', '444444', 'Palpitations workup', NULL, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '1 day' + INTERVAL '9 hours', 30, 'CONFIRMED', '555555', 'Atrial fibrillation management', NULL, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '1 day' + INTERVAL '10 hours', 45, 'SCHEDULED', '666666', 'Valve replacement consultation', NULL, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() + INTERVAL '1 day' + INTERVAL '14 hours', 30, 'CONFIRMED', '777777', 'Stress test review', NULL, NOW(), NOW()),

  -- Past appointments for other patients
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() - INTERVAL '5 days' + INTERVAL '9 hours', 30, 'COMPLETED', '888888', 'Blood pressure review', 'BP well controlled on current meds', NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   NOW() - INTERVAL '3 days' + INTERVAL '11 hours', 30, 'COMPLETED', '999999', 'AF initial workup', 'Started on rate control', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days');

-- ── Prescriptions ───────────────────────────────────────────────────────────

INSERT INTO prescriptions (id, patient_id, doctor_id, diagnosis_codes, medications, outcome_assessment, efficacy_score, side_effects_reported, follow_up_date, created_at, updated_at) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   ARRAY['I10', 'I25.1'], '[{"drugName":"Lisinopril","dosage":"10mg","frequency":"1x daily","durationDays":90,"route":"oral","instructions":"Take in the morning"},{"drugName":"Aspirin","dosage":"81mg","frequency":"1x daily","durationDays":90,"route":"oral","instructions":"Take with food"}]',
   'Good response, BP well controlled', 0.85, '[]', NOW() + INTERVAL '60 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '7 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   ARRAY['E11.9'], '[{"drugName":"Metformin","dosage":"850mg","frequency":"2x daily","durationDays":90,"route":"oral","instructions":"Take with meals"}]',
   NULL, NULL, '[]', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   ARRAY['I10'], '[{"drugName":"Amlodipine","dosage":"5mg","frequency":"1x daily","durationDays":30,"route":"oral","instructions":"Take in the evening"}]',
   'BP reduced to target', 0.92, '["mild ankle edema"]', NOW() + INTERVAL '30 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001',
   ARRAY['I48.0'], '[{"drugName":"Metoprolol","dosage":"50mg","frequency":"2x daily","durationDays":30,"route":"oral","instructions":"Do not stop abruptly"},{"drugName":"Warfarin","dosage":"5mg","frequency":"1x daily","durationDays":30,"route":"oral","instructions":"Monitor INR weekly"}]',
   NULL, NULL, '[]', NOW() + INTERVAL '14 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- ── Triage Events ───────────────────────────────────────────────────────────

INSERT INTO triage_events (id, patient_id, symptoms, symptom_description, urgency_level, confidence_score, recommended_specializations, red_flags, suggested_diagnostics, differential_diagnoses, model_used, response_latency_ms, follow_up_scheduled, created_at) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002',
   '["chest pain","shortness of breath","fatigue"]',
   'Patient reports intermittent chest tightness and shortness of breath during physical activity for the past 2 weeks. Associated fatigue.',
   'URGENT', 0.89,
   '["Cardiology","Pulmonology"]',
   '["chest pain with exertion","progressive dyspnea"]',
   '["ECG","Cardiac enzymes","Chest X-ray","Echocardiogram"]',
   '[{"code":"I25.1","name":"Atherosclerotic heart disease","probability":0.45},{"code":"I50.9","name":"Heart failure","probability":0.25},{"code":"J44.1","name":"COPD exacerbation","probability":0.15}]',
   'triage-v2.1', 342, true, NOW() - INTERVAL '7 days'),

  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003',
   '["headache","dizziness","blurred vision"]',
   'Severe headache with dizziness and occasional blurred vision. BP measured at 180/110 at home.',
   'EMERGENCY', 0.95,
   '["Cardiology","Neurology"]',
   '["hypertensive crisis","visual disturbance with hypertension","sudden severe headache"]',
   '["Stat BP measurement","CT head","Renal function panel","Urinalysis"]',
   '[{"code":"I10","name":"Essential hypertension - crisis","probability":0.65},{"code":"I67.4","name":"Hypertensive encephalopathy","probability":0.2},{"code":"G43.9","name":"Migraine","probability":0.1}]',
   'triage-v2.1', 289, true, NOW() - INTERVAL '5 days'),

  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005',
   '["palpitations","anxiety","sweating"]',
   'Episodes of rapid heartbeat lasting 5-10 minutes, occurring 2-3 times per week. Associated anxiety and sweating.',
   'SEMI_URGENT', 0.82,
   '["Cardiology","Endocrinology"]',
   '[]',
   '["ECG","Holter monitor","Thyroid function tests","Electrolytes"]',
   '[{"code":"R00.0","name":"Tachycardia","probability":0.4},{"code":"I49.9","name":"Cardiac arrhythmia","probability":0.3},{"code":"E05.9","name":"Thyrotoxicosis","probability":0.15}]',
   'triage-v2.1', 298, false, NOW() - INTERVAL '2 days'),

  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006',
   '["leg pain","swelling","redness"]',
   'Left leg pain and swelling for 3 days. The calf is red and warm to touch. Patient recently had a long flight.',
   'URGENT', 0.91,
   '["Vascular Surgery","General Medicine"]',
   '["unilateral leg swelling","recent immobilization","calf tenderness"]',
   '["D-dimer","Doppler ultrasound of lower extremity","CBC"]',
   '[{"code":"I80.2","name":"Deep vein thrombosis","probability":0.55},{"code":"I83.0","name":"Varicose veins with inflammation","probability":0.2},{"code":"M79.3","name":"Panniculitis","probability":0.1}]',
   'triage-v2.1', 315, true, NOW() - INTERVAL '1 day'),

  (gen_random_uuid(), '00000000-0000-0000-0000-000000000009',
   '["cough","fever","body aches"]',
   'Dry cough and low-grade fever (37.8°C) for 4 days. Generalized body aches and mild fatigue.',
   'NON_URGENT', 0.87,
   '["General Medicine","Pulmonology"]',
   '[]',
   '["Chest X-ray if persistent","CBC","CRP"]',
   '[{"code":"J06.9","name":"Acute upper respiratory infection","probability":0.6},{"code":"J11.1","name":"Influenza","probability":0.25},{"code":"J18.9","name":"Community-acquired pneumonia","probability":0.1}]',
   'triage-v2.1', 267, false, NOW() - INTERVAL '12 hours');

-- ── Telemetry (7 days for demo patient) ─────────────────────────────────────

DO $$
DECLARE
  i INT;
  ts TIMESTAMPTZ;
  hr_base FLOAT := 72;
  spo2_base FLOAT := 97;
  hrv_base FLOAT := 42;
BEGIN
  FOR i IN 0..167 LOOP  -- 168 hours = 7 days
    ts := NOW() - (i || ' hours')::INTERVAL;

    -- Heart rate
    INSERT INTO biometric_telemetry (id, patient_id, metric_type, value, device_id, recorded_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'heart_rate',
      hr_base + (random() * 20 - 10) + (CASE WHEN EXTRACT(HOUR FROM ts) BETWEEN 6 AND 22 THEN 5 ELSE -5 END),
      'apple-watch-demo', ts);

    -- SpO2
    INSERT INTO biometric_telemetry (id, patient_id, metric_type, value, device_id, recorded_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'spo2',
      spo2_base + (random() * 3 - 1.5),
      'apple-watch-demo', ts);

    -- HRV
    INSERT INTO biometric_telemetry (id, patient_id, metric_type, value, device_id, recorded_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'hrv',
      hrv_base + (random() * 20 - 10),
      'apple-watch-demo', ts);

    -- Temperature (every 4 hours)
    IF i % 4 = 0 THEN
      INSERT INTO biometric_telemetry (id, patient_id, metric_type, value, device_id, recorded_at)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'temperature',
        36.4 + (random() * 0.8),
        'withings-thermo-demo', ts);
    END IF;
  END LOOP;
END $$;

-- ── Efficacy Metrics ────────────────────────────────────────────────────────

INSERT INTO efficacy_metrics (id, drug_name, dosage, diagnosis_code, cohort_size, outcome_metrics, comparative_effectiveness, region, timeframe_months, last_updated) VALUES
  (gen_random_uuid(), 'Lisinopril', '10mg', 'I10', 312,
   '{"remissionRate":0.78,"averageDaysToImprovement":14,"sideEffectRate":0.12,"readmissionRate":0.05,"patientSatisfaction":0.85}',
   0.82, 'Tashkent', 12, NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), 'Amlodipine', '5mg', 'I10', 287,
   '{"remissionRate":0.75,"averageDaysToImprovement":10,"sideEffectRate":0.18,"readmissionRate":0.07,"patientSatisfaction":0.79}',
   0.76, 'Tashkent', 12, NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), 'Metformin', '850mg', 'E11.9', 445,
   '{"remissionRate":0.65,"averageDaysToImprovement":30,"sideEffectRate":0.22,"readmissionRate":0.08,"patientSatisfaction":0.72}',
   0.71, 'Tashkent', 12, NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'Metoprolol', '50mg', 'I48.0', 178,
   '{"remissionRate":0.82,"averageDaysToImprovement":7,"sideEffectRate":0.15,"readmissionRate":0.04,"patientSatisfaction":0.88}',
   0.85, 'Tashkent', 12, NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'Amoxicillin', '500mg', 'J06.9', 523,
   '{"remissionRate":0.91,"averageDaysToImprovement":5,"sideEffectRate":0.08,"readmissionRate":0.02,"patientSatisfaction":0.90}',
   0.89, 'Tashkent', 6, NOW() - INTERVAL '2 days');
