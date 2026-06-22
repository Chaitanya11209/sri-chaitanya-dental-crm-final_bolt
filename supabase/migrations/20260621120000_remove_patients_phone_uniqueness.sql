-- ── DROP UNIQUE CONSTRAINTS & UNIQUE INDEXES ON PATIENTS PHONE ──
-- Removing unique requirements to support family shared phone numbers.

-- 1. Drop the UNIQUE constraint patients_phone_key (if it exists)
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_phone_key;

-- 2. Drop the UNIQUE index idx_patients_phone_unique (if it exists)
DROP INDEX IF EXISTS public.idx_patients_phone_unique;

-- 3. Also drop any other helper unique indexes that might conflict on phone
DROP INDEX IF EXISTS public.patients_phone_key;
DROP INDEX IF EXISTS public.idx_patients_phone_key;

-- 4. Update the "ensure_patient_for_appointment" trigger function to remove ON CONFLICT (phone)
CREATE OR REPLACE FUNCTION public.ensure_patient_for_appointment()
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

  -- Step B: Link or Insert
  IF existing_patient_id IS NOT NULL THEN
    NEW.patient_id := existing_patient_id;
  ELSE
    new_code := 'SDC-' || floor(random() * 900000 + 100000)::text;

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
    ON CONFLICT (patient_code) DO NOTHING
    RETURNING id INTO existing_patient_id;

    IF existing_patient_id IS NULL THEN
      SELECT id INTO existing_patient_id FROM patients WHERE patient_code = new_code;
    END IF;

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


-- 5. Update the "sync_appointment_to_patient" trigger function to remove ON CONFLICT (phone)
CREATE OR REPLACE FUNCTION public.sync_appointment_to_patient()
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
    ON CONFLICT (patient_code) DO NOTHING
    RETURNING id INTO existing_patient_id;

    IF existing_patient_id IS NULL THEN
      SELECT id INTO existing_patient_id FROM patients WHERE patient_code = new_code;
    END IF;

    NEW.patient_id := existing_patient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
