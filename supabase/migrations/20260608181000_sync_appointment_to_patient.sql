-- ── APPOINTMENT TO PATIENT SYNCHRONIZATION ENGINE (MIGRATION) ──
-- Ensures real-time creation and matching of client records from appointments.

-- 1. Ensure foreign key exists on appointments
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;
ALTER TABLE appointments 
  ADD CONSTRAINT appointments_patient_id_fkey 
  FOREIGN KEY (patient_id) 
  REFERENCES patients(id) 
  ON DELETE SET NULL;

-- 2. Verify unique indexes on phone and email to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_phone_unique 
  ON patients(phone) 
  WHERE phone IS NOT NULL AND phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_email_unique 
  ON patients(email) 
  WHERE email IS NOT NULL AND email <> '';

-- 3. Set up indexes for fast lookup performance
CREATE INDEX IF NOT EXISTS idx_appointments_lookup_phone ON appointments(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_lookup_email ON appointments(email);
CREATE INDEX IF NOT EXISTS idx_patients_lookup_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_lookup_email ON patients(email);

-- 4. Create the custom triggered function running with SECURITY DEFINER
CREATE OR REPLACE FUNCTION sync_appointment_to_patient()
RETURNS TRIGGER AS $$
DECLARE
  existing_patient_id bigint;
  new_code text;
  cleaned_phone text;
BEGIN
  -- Normalize phone characters if provided
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    cleaned_phone := regexp_replace(NEW.phone, '\D', '', 'g');
  ELSE
    cleaned_phone := '';
  END IF;

  -- A. Match with exact ID if given
  IF NEW.patient_id IS NOT NULL THEN
    SELECT id INTO existing_patient_id FROM patients WHERE id = NEW.patient_id;
  END IF;

  -- B. Match with Phone Number
  IF existing_patient_id IS NULL AND NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    SELECT id INTO existing_patient_id 
    FROM patients 
    WHERE phone = NEW.phone 
       OR regexp_replace(phone, '\D', '', 'g') = cleaned_phone
    ORDER BY id ASC 
    LIMIT 1;
  END IF;

  -- C. Match with Email Address
  IF existing_patient_id IS NULL AND NEW.email IS NOT NULL AND NEW.email <> '' THEN
    SELECT id INTO existing_patient_id 
    FROM patients 
    WHERE email = NEW.email 
    ORDER BY id ASC 
    LIMIT 1;
  END IF;

  -- D. If patient is identified, link and perform an update of basic contact details
  IF existing_patient_id IS NOT NULL THEN
    NEW.patient_id := existing_patient_id;
    
    UPDATE patients
    SET 
      name = COALESCE(NULLIF(NEW.name, ''), name),
      phone = COALESCE(NULLIF(NEW.phone, ''), phone),
      email = COALESCE(NULLIF(NEW.email, ''), email),
      location = COALESCE(NULLIF(NEW.location, ''), location)
    WHERE id = existing_patient_id;

  ELSE
    -- E. Generate a new patient code and insert record
    new_code := 'SDC-P-' || COALESCE((SELECT COALESCE(MAX(id), 0) + 101 FROM patients), 101);

    INSERT INTO patients (
      patient_code,
      name,
      phone,
      email,
      location,
      notes,
      patient_status
    ) VALUES (
      new_code,
      COALESCE(NEW.name, 'New Patient'),
      NEW.phone,
      NEW.email,
      NEW.location,
      COALESCE(NEW.notes, 'Registered automatically from appointment booking'),
      'Registered'
    )
    ON CONFLICT (phone) DO UPDATE 
    SET 
      email = COALESCE(NULLIF(EXCLUDED.email, ''), patients.email),
      location = COALESCE(NULLIF(EXCLUDED.location, ''), patients.location)
    RETURNING id INTO existing_patient_id;

    NEW.patient_id := existing_patient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach trigger to appointments with highest priority
DROP TRIGGER IF EXISTS trg_ensure_patient_for_appointment ON appointments;
DROP TRIGGER IF EXISTS trg_sync_appointment_to_patient ON appointments;

CREATE TRIGGER trg_sync_appointment_to_patient
  BEFORE INSERT OR UPDATE OF phone, email, patient_id ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_to_patient();

-- 6. Add policy support for service role to guarantee cross-table capability
DROP POLICY IF EXISTS "service_role full access - patients" ON patients;
DROP POLICY IF EXISTS "service_role full access - appointments" ON appointments;
DROP POLICY IF EXISTS "service_role full access - treatments" ON treatments;

CREATE POLICY "service_role full access - patients" ON patients TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - appointments" ON appointments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - treatments" ON treatments TO service_role USING (true) WITH CHECK (true);
