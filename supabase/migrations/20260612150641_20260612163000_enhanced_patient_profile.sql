-- ============================================================
-- ENHANCED PATIENT PROFILE - Clinical History & Medical Data
-- ============================================================

-- Add new columns to patients table for comprehensive clinical profile
ALTER TABLE patients ADD COLUMN IF NOT EXISTS alternate_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Clinical History columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '[]';
-- Format: ["diabetes", "hypertension", "heart_disease", "kidney_disease", "thyroid", "asthma", " epilepsy", "other"]

ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies JSONB DEFAULT '[]';
-- Format: ["penicillin", "latex", "aspirin", "other_drugs"]

ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_medications TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_dental_treatments TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS treatment_plan TEXT;

-- Dental chart data - stores tooth conditions
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dental_chart JSONB DEFAULT '{}';
-- Format: { "1": "missing", "2": "caries", "3": "filled", "4": "RCT", "5": "crown", ... }

-- UHID (Unique Health ID)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS uhid TEXT UNIQUE;

-- Create index for UHID
CREATE INDEX IF NOT EXISTS idx_patients_uhid ON patients(uhid);

-- Function to auto-generate UHID
CREATE OR REPLACE FUNCTION generate_uhid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.uhid IS NULL THEN
    NEW.uhid := 'UHID-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('patients_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS trg_generate_uhid ON patients;
CREATE TRIGGER trg_generate_uhid
  BEFORE INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION generate_uhid();