-- =============================================================================
-- PHASE 6: CLINICAL TREATMENT WORKFLOW
-- Session logs, prescriptions, procedure templates, attachments
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add clinical workflow columns to treatments table
-- -----------------------------------------------------------------------------
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC DEFAULT 0;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS tooth_number TEXT;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS tooth_notation TEXT DEFAULT 'FDI';
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS anesthesia_type TEXT DEFAULT 'Local';
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS anesthesia_notes TEXT;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS prescription TEXT;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent'));
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS consent_signed BOOLEAN DEFAULT false;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS consent_date TIMESTAMPTZ;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS estimated_sessions INTEGER DEFAULT 1;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS xray_required BOOLEAN DEFAULT false;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS xray_taken BOOLEAN DEFAULT false;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS lab_work_required BOOLEAN DEFAULT false;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS lab_work_status TEXT DEFAULT 'Not Started' CHECK (lab_work_status IN ('Not Started', 'Sent to Lab', 'In Progress', 'Received', 'Completed'));

-- -----------------------------------------------------------------------------
-- 2. TREATMENT SESSION LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment_sessions (
  id BIGSERIAL PRIMARY KEY,
  treatment_id BIGINT NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER DEFAULT 30,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  doctor_name TEXT,
  chair_id BIGINT REFERENCES dental_chairs(id) ON DELETE SET NULL,
  procedure_performed TEXT,
  notes TEXT,
  observations TEXT,
  medications_given TEXT,
  next_session_plan TEXT,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  healing_status TEXT CHECK (healing_status IN ('Excellent', 'Good', 'Fair', 'Poor', 'Concerning')),
  attachments JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (treatment_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_treatment_sessions_treatment ON treatment_sessions(treatment_id);
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_date ON treatment_sessions(session_date);

-- -----------------------------------------------------------------------------
-- 3. PRESCRIPTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGSERIAL PRIMARY KEY,
  treatment_id BIGINT REFERENCES treatments(id) ON DELETE SET NULL,
  patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  doctor_name TEXT,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_treatment ON prescriptions(treatment_id);

-- -----------------------------------------------------------------------------
-- 4. PRESCRIPTION ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescription_items (
  id BIGSERIAL PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration_days INTEGER,
  instructions TEXT,
  quantity INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);

-- -----------------------------------------------------------------------------
-- 5. PROCEDURE TEMPLATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procedure_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  default_sessions INTEGER DEFAULT 1,
  default_duration_minutes INTEGER DEFAULT 30,
  estimated_cost_range_low NUMERIC DEFAULT 0,
  estimated_cost_range_high NUMERIC DEFAULT 0,
  anesthesia_required BOOLEAN DEFAULT false,
  xray_required BOOLEAN DEFAULT false,
  lab_work_required BOOLEAN DEFAULT false,
  default_medications TEXT,
  pre_procedure_notes TEXT,
  post_procedure_notes TEXT,
  consent_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO procedure_templates (name, category, default_sessions, default_duration_minutes, estimated_cost_range_low, estimated_cost_range_high, anesthesia_required, xray_required, lab_work_required) VALUES
  ('Consultation', 'General', 1, 15, 300, 500, false, false, false),
  ('Scaling & Polishing', 'Preventive', 1, 30, 800, 1500, false, false, false),
  ('Composite Filling', 'Restorative', 1, 30, 1000, 2500, true, false, false),
  ('Root Canal Treatment (Single Visit)', 'Endodontics', 1, 60, 3000, 5000, true, true, false),
  ('Root Canal Treatment (Multi-Visit)', 'Endodontics', 3, 45, 4000, 7000, true, true, false),
  ('Tooth Extraction (Simple)', 'Surgery', 1, 20, 500, 1500, true, false, false),
  ('Surgical Extraction', 'Surgery', 1, 45, 2000, 4000, true, true, false),
  ('Wisdom Tooth Extraction', 'Surgery', 1, 60, 3000, 6000, true, true, false),
  ('Dental Crown (Metal-Ceramic)', 'Prosthodontics', 2, 30, 4000, 8000, false, true, true),
  ('Dental Crown (Zirconia)', 'Prosthodontics', 2, 30, 6000, 12000, false, true, true),
  ('Dental Bridge (3-Unit)', 'Prosthodontics', 3, 45, 12000, 25000, false, true, true),
  ('Dental Implant', 'Implantology', 4, 60, 25000, 50000, true, true, true),
  ('Teeth Whitening', 'Cosmetic', 1, 60, 5000, 10000, false, false, false),
  ('Orthodontic Braces (Metal)', 'Orthodontics', 24, 30, 25000, 50000, false, true, false),
  ('Clear Aligners', 'Orthodontics', 12, 30, 50000, 100000, false, true, false),
  ('Denture (Partial)', 'Prosthodontics', 3, 30, 5000, 15000, false, false, true),
  ('Denture (Complete)', 'Prosthodontics', 4, 45, 15000, 35000, false, false, true)
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. TREATMENT ATTACHMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment_attachments (
  id BIGSERIAL PRIMARY KEY,
  treatment_id BIGINT REFERENCES treatments(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES treatment_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_url TEXT NOT NULL,
  category TEXT DEFAULT 'Other' CHECK (category IN ('X-Ray', 'Photo', 'Document', 'Consent Form', 'Lab Report', 'Referral', 'Prescription', 'Other')),
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatment_attachments_treatment ON treatment_attachments(treatment_id);

-- -----------------------------------------------------------------------------
-- 7. TRIGGER: Auto-populate doctor_name from doctor_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_treatment_doctor_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.doctor_id IS NOT NULL AND (OLD.doctor_id IS NULL OR OLD.doctor_id != NEW.doctor_id) THEN
    SELECT name INTO NEW.doctor_name FROM doctors WHERE id = NEW.doctor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_treatment_doctor_name_trigger ON treatments;
CREATE TRIGGER update_treatment_doctor_name_trigger
  BEFORE INSERT OR UPDATE ON treatments
  FOR EACH ROW
  EXECUTE FUNCTION update_treatment_doctor_name();

-- -----------------------------------------------------------------------------
-- 8. RLS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_treatment_sessions" ON treatment_sessions;
CREATE POLICY "view_treatment_sessions" ON treatment_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_treatment_sessions" ON treatment_sessions;
CREATE POLICY "manage_treatment_sessions" ON treatment_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')));

DROP POLICY IF EXISTS "view_prescriptions" ON prescriptions;
CREATE POLICY "view_prescriptions" ON prescriptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_prescriptions" ON prescriptions;
CREATE POLICY "manage_prescriptions" ON prescriptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')));

DROP POLICY IF EXISTS "view_prescription_items" ON prescription_items;
CREATE POLICY "view_prescription_items" ON prescription_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_prescription_items" ON prescription_items;
CREATE POLICY "manage_prescription_items" ON prescription_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')));

DROP POLICY IF EXISTS "view_procedure_templates" ON procedure_templates;
CREATE POLICY "view_procedure_templates" ON procedure_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_procedure_templates" ON procedure_templates;
CREATE POLICY "manage_procedure_templates" ON procedure_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "view_treatment_attachments" ON treatment_attachments;
CREATE POLICY "view_treatment_attachments" ON treatment_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_treatment_attachments" ON treatment_attachments;
CREATE POLICY "manage_treatment_attachments" ON treatment_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')));
