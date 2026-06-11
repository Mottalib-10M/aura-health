-- Add created_by field to track which doctor created a patient
ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES doctors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients(created_by) WHERE created_by IS NOT NULL;
