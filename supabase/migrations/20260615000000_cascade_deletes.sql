-- ============================================================
-- SRI CHAITANYA DENTAL CRM — FOREIGN KEY & CASCADE SECURITY UPGRADE
-- Ensures deleting Doctors or Patients does not trigger foreign key lockups
-- ============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop existing patient_id foreign keys on appointments
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'appointments'
          AND kcu.column_name = 'patient_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- 2. Drop existing doctor_id foreign keys on appointments
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'appointments'
          AND kcu.column_name = 'doctor_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- 3. Drop existing patient_id foreign keys on treatments
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'treatments'
          AND kcu.column_name = 'patient_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- 4. Drop existing patient_id foreign keys on bills
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'bills'
          AND kcu.column_name = 'patient_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- 5. Drop existing appointment_id foreign keys on bills
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'bills'
          AND kcu.column_name = 'appointment_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Align foreign keys with correct cascading delete actions
-- When a Patient is deleted: delete appointments, bills, and treatments (ON DELETE CASCADE)
-- When a Doctor is deleted: retain appointments, but set doctor_id references to NULL (ON DELETE SET NULL)

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_patient_id_fkey
  FOREIGN KEY (patient_id)
  REFERENCES public.patients(id)
  ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_doctor_id_fkey
  FOREIGN KEY (doctor_id)
  REFERENCES public.doctors(id)
  ON DELETE SET NULL;

ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_patient_id_fkey
  FOREIGN KEY (patient_id)
  REFERENCES public.patients(id)
  ON DELETE CASCADE;

ALTER TABLE public.bills
  ADD CONSTRAINT bills_patient_id_fkey
  FOREIGN KEY (patient_id)
  REFERENCES public.patients(id)
  ON DELETE CASCADE;

ALTER TABLE public.bills
  ADD CONSTRAINT bills_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;
