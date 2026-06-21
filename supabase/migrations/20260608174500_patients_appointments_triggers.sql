-- ── PATIENT & APPOINTMENT COALESCE SYNCHRONIZATION ENGINE ──
-- Permanent synchronization triggers for Sri Chaitanya Dental CRM

-- 1. Deduplicate pre-existing patients with duplicate phone numbers by keeping the oldest record
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT phone, COUNT(*) 
    FROM patients 
    WHERE phone IS NOT NULL AND phone <> '' 
    GROUP BY phone 
    HAVING COUNT(*) > 1
  LOOP
    -- Point appointments to the first patient ID
    UPDATE appointments 
    SET patient_id = (SELECT id FROM patients WHERE phone = r.phone ORDER BY id ASC LIMIT 1)
    WHERE patient_id IN (SELECT id FROM patients WHERE phone = r.phone ORDER BY id ASC OFFSET 1);

    -- Point treatments to the first patient ID
    UPDATE treatments
    SET patient_id = (SELECT id FROM patients WHERE phone = r.phone ORDER BY id ASC LIMIT 1)
    WHERE patient_id IN (SELECT id FROM patients WHERE phone = r.phone ORDER BY id ASC OFFSET 1);

    -- Delete the duplicate newer patients
    DELETE FROM patients 
    WHERE phone = r.phone 
      AND id IN (SELECT id FROM patients WHERE phone = r.phone ORDER BY id ASC OFFSET 1);
  END LOOP;
END $$;

-- 2. Deduplicate pre-existing appointments on the same slot (phone, next_visit, appointment_time)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT phone, next_visit, appointment_time, COUNT(*)
    FROM appointments
    WHERE phone IS NOT NULL AND next_visit IS NOT NULL AND appointment_time IS NOT NULL AND appointment_time <> ''
    GROUP BY phone, next_visit, appointment_time
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the oldest appointment and delete others on the same slot
    DELETE FROM appointments
    WHERE id IN (
      SELECT id 
      FROM appointments 
      WHERE phone = r.phone 
        AND next_visit = r.next_visit 
        AND appointment_time = r.appointment_time 
      ORDER BY id ASC 
      OFFSET 1
    );
  END LOOP;
END $$;

-- 3. Add unique constraints to prevent duplicates on database level
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_phone_key;
ALTER TABLE patients ADD CONSTRAINT patients_phone_key UNIQUE (phone);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_slot_key;
ALTER TABLE appointments ADD CONSTRAINT appointments_slot_key UNIQUE (phone, next_visit, appointment_time);


-- 4. Audit Log entry helper function
CREATE OR REPLACE FUNCTION log_portal_audit(the_action text, log_details text)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    performed_by_id,
    performed_by_name,
    details
  ) VALUES (
    the_action,
    auth.uid(),
    'SYSTEM_SYNCHRONIZATION_ENGINE',
    log_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Trigger to run BEFORE inserting/updating appointments to align Parent Patient
CREATE OR REPLACE FUNCTION ensure_patient_for_appointment()
RETURNS TRIGGER AS $$
DECLARE
  existing_patient_id bigint;
  new_code text;
  cleaned_phone text;
BEGIN
  -- Normalize phone for cleaner match compatibility
  cleaned_phone := regexp_replace(NEW.phone, '\D', '', 'g');

  -- Step A: Lookup existing patient
  IF NEW.patient_id IS NOT NULL THEN
    SELECT id INTO existing_patient_id FROM patients WHERE id = NEW.patient_id;
  END IF;

  IF existing_patient_id IS NULL AND NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    SELECT id INTO existing_patient_id 
    FROM patients 
    WHERE phone = NEW.phone 
       OR regexp_replace(phone, '\D', '', 'g') = cleaned_phone
    ORDER BY id ASC 
    LIMIT 1;
  END IF;

  IF existing_patient_id IS NULL AND NEW.email IS NOT NULL AND NEW.email <> '' THEN
    SELECT id INTO existing_patient_id 
    FROM patients 
    WHERE email = NEW.email 
    ORDER BY id ASC 
    LIMIT 1;
  END IF;

  -- Step B: If patient exists, link and sync details
  IF existing_patient_id IS NOT NULL THEN
    NEW.patient_id := existing_patient_id;
    
    UPDATE patients
    SET 
      name = COALESCE(NULLIF(NEW.name, ''), name),
      phone = COALESCE(NULLIF(NEW.phone, ''), phone),
      email = COALESCE(NULLIF(NEW.email, ''), email),
      location = COALESCE(NULLIF(NEW.location, ''), location)
    WHERE id = existing_patient_id;

    -- Log action
    PERFORM log_portal_audit(
      'PATIENT_LINKED', 
      'Linked appointment details for ' || NEW.name || ' (Phone: ' || NEW.phone || ') to Patient ID: ' || existing_patient_id
    );

  ELSE
    -- Step C: Create brand new patient record
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

    -- Log action
    PERFORM log_portal_audit(
      'PATIENT_CREATED', 
      'Automatically generated patient record ' || new_code || ' during appointment scheduling for ' || NEW.name
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 6. Trigger to run AFTER any appointment state updates to update Patient's clinical milestones
CREATE OR REPLACE FUNCTION sync_patient_on_appointment_change()
RETURNS TRIGGER AS $$
DECLARE
  target_patient_id bigint;
  calculated_last_visit date;
  calculated_next_visit date;
  calculated_treatment text;
BEGIN
  -- Deduce active patient target
  IF TG_OP = 'DELETE' THEN
    target_patient_id := OLD.patient_id;
  ELSE
    target_patient_id := NEW.patient_id;
  END IF;

  IF target_patient_id IS NOT NULL THEN
    -- Recalculate last_visit_date
    SELECT MAX(next_visit) INTO calculated_last_visit
    FROM appointments
    WHERE patient_id = target_patient_id
      AND next_visit IS NOT NULL
      AND (next_visit < CURRENT_DATE OR status = 'Completed');

    -- Recalculate next_visit_date
    SELECT MIN(next_visit) INTO calculated_next_visit
    FROM appointments
    WHERE patient_id = target_patient_id
      AND next_visit IS NOT NULL
      AND next_visit >= CURRENT_DATE
      AND status IN ('Confirmed', 'Pending');

    -- Recalculate aggregated treatment summary (latest treatment name)
    SELECT treatment INTO calculated_treatment
    FROM appointments
    WHERE patient_id = target_patient_id
      AND treatment IS NOT NULL AND treatment <> ''
      AND status <> 'Deleted'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- Update parent Patient
    UPDATE patients
    SET 
      last_visit_date = calculated_last_visit,
      next_visit_date = calculated_next_visit,
      treatment_summary = COALESCE(calculated_treatment, treatment_summary)
    WHERE id = target_patient_id;

    -- Log action
    PERFORM log_portal_audit(
      'PATIENT_HISTORY_SYNCHRONIZED', 
      'Recalculated historical data and upcoming schedules for Patient ID: ' || target_patient_id
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;


-- 7. Bind Triggers to Appointments table
DROP TRIGGER IF EXISTS trg_ensure_patient_for_appointment ON appointments;
CREATE TRIGGER trg_ensure_patient_for_appointment
  BEFORE INSERT OR UPDATE OF phone, email, patient_id ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION ensure_patient_for_appointment();

DROP TRIGGER IF EXISTS trg_sync_patient_on_appointment_change ON appointments;
CREATE TRIGGER trg_sync_patient_on_appointment_change
  AFTER INSERT OR UPDATE OF next_visit, status, treatment, patient_id OR DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_on_appointment_change();
