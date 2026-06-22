-- ── RECALCULATE PATIENT STATUS ON APPOINTMENT STATE UPDATE ──
-- Ensures patient_status stays 100% synchronized with appointment lifecycles.

CREATE OR REPLACE FUNCTION public.sync_patient_on_appointment_change()
RETURNS TRIGGER AS $$
DECLARE
  target_patient_id bigint;
  calculated_last_visit date;
  calculated_next_visit date;
  calculated_treatment text;
  calculated_status text;
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
      AND status IN ('Confirmed', 'Pending', 'Reminder Sent');

    -- Recalculate aggregated treatment summary (latest treatment name)
    SELECT treatment INTO calculated_treatment
    FROM appointments
    WHERE patient_id = target_patient_id
      AND treatment IS NOT NULL AND treatment <> ''
      AND status <> 'Deleted'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- Recalculate patient_status
    IF EXISTS (
      SELECT 1 FROM appointments 
      WHERE patient_id = target_patient_id 
        AND status IN ('Confirmed', 'Pending', 'Reminder Sent')
        AND (next_visit < CURRENT_DATE OR treatment ILIKE '%Follow-up%' OR treatment ILIKE '%Recall%' OR treatment ILIKE '%Review%')
    ) THEN
      calculated_status := 'Follow-up Required';
    ELSIF EXISTS (
      SELECT 1 FROM appointments 
      WHERE patient_id = target_patient_id 
        AND status IN ('Confirmed', 'Pending', 'Reminder Sent', 'In Treatment')
    ) THEN
      calculated_status := 'In Treatment';
    ELSIF EXISTS (
      SELECT 1 FROM appointments 
      WHERE patient_id = target_patient_id 
        AND status = 'Completed'
    ) THEN
      calculated_status := 'Completed';
    ELSE
      calculated_status := 'Registered';
    END IF;

    -- Update parent Patient
    UPDATE patients
    SET 
      last_visit_date = calculated_last_visit,
      next_visit_date = calculated_next_visit,
      treatment_summary = COALESCE(calculated_treatment, treatment_summary),
      patient_status = COALESCE(calculated_status, patient_status)
    WHERE id = target_patient_id;

    -- Log action
    PERFORM log_portal_audit(
      'PATIENT_HISTORY_SYNCHRONIZED', 
      'Recalculated historical data, upcoming schedules, and status ' || COALESCE(calculated_status, 'None') || ' for Patient ID: ' || target_patient_id
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
