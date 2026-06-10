-- =====================================================================
-- Sri Chaitanya Dental Care — Database Trigger Synchronizations
-- This file lists all active PostgreSQL trigger functions and definitions.
-- =====================================================================

-- ── 1. LOG PORTAL AUDIT HELPER ───────────────────────────────────────────
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


-- ── 2. ALIGN APPOINTMENT TO PATIENT RECORD (BEFORE INSERT/UPDATE) ─────────
CREATE OR REPLACE FUNCTION sync_appointment_to_patient()
RETURNS TRIGGER AS $$
DECLARE
  existing_patient_id bigint;
  new_code text;
  cleaned_phone text;
BEGIN
  -- Normalize phone for cleaner match compatibility
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    cleaned_phone := regexp_replace(NEW.phone, '\D', '', 'g');
  ELSE
    cleaned_phone := '';
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3. UPDATE CLINICAL MILESTONES ON PATIENT (AFTER APPOINTMENT ACTION) ──
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


-- ── 4. ATTACH TRIGGERS TO APPOINTMENTS ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_appointment_to_patient ON appointments;
CREATE TRIGGER trg_sync_appointment_to_patient
  BEFORE INSERT OR UPDATE OF phone, email, patient_id ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_to_patient();

DROP TRIGGER IF EXISTS trg_sync_patient_on_appointment_change ON appointments;
CREATE TRIGGER trg_sync_patient_on_appointment_change
  AFTER INSERT OR UPDATE OF next_visit, status, treatment, patient_id OR DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_on_appointment_change();
