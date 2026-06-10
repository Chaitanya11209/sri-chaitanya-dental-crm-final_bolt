-- ============================================================
-- Sri Chaitanya Dental Care — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── PATIENTS ────────────────────────────────────────────────
create table if not exists patients (
  id               bigserial primary key,
  patient_code     text unique,
  name             text not null,
  phone            text,
  email            text,
  location         text,
  age              text,
  gender           text,
  notes            text,
  patient_status   text default 'Registered',
  last_visit_date  date,
  next_visit_date  date,
  treatment_summary text,
  created_at       timestamptz default now()
);

-- ── APPOINTMENTS ─────────────────────────────────────────────
create table if not exists appointments (
  id               bigserial primary key,
  patient_id       bigint references patients(id) on delete set null,
  name             text,
  phone            text,
  email            text,
  treatment        text,
  next_visit       date,
  appointment_time text,
  location         text,
  notes            text,
  status           text default 'Pending',
  visit_count      int  default 1,
  visit_type       text default 'New',
  amount_paid      numeric default 0,
  balance_amount   numeric default 0,
  payment_mode     text default 'Cash',
  payment_notes    text,
  doctor_id        bigint, -- Will reference doctors(id) if exists
  doctor_name      text,
  created_at       timestamptz default now()
);

-- ── DOCTORS ──────────────────────────────────────────────────
create table if not exists doctors (
  id               bigserial primary key,
  name             text not null,
  qualification    text,
  specialization   text,
  phone            text,
  email            text,
  status           text default 'Active', -- 'Active' or 'Inactive'
  created_at       timestamptz default now()
);

-- ── TREATMENTS ───────────────────────────────────────────────
create table if not exists treatments (
  id                 bigserial primary key,
  patient_id         bigint references patients(id) on delete set null,
  patient_name       text,
  phone              text,
  treatment_type     text,
  stage              text default 'Assessment',
  start_date         date,
  expected_end_date  date,
  total_sessions     int,
  sessions_done      int  default 0,
  treatment_notes    text,
  doctor_notes       text,
  status             text default 'In Progress',
  created_at         timestamptz default now()
);

-- ── STAFF ROLES (for Supabase Auth) ──────────────────────────
create table if not exists staff_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  name       text not null,
  status     text default 'Active' check (status in ('Active', 'Inactive')),
  updated_at timestamptz default now(),
  last_login timestamptz,
  created_at timestamptz default now()
);

-- ── AUDIT LOGS ───────────────────────────────────────────────
create table if not exists audit_logs (
  id bigserial primary key,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_user_name text,
  performed_by_id uuid references auth.users(id) on delete set null,
  performed_by_name text,
  details text,
  created_at timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_appointments_next_visit  on appointments(next_visit);
create index if not exists idx_appointments_status      on appointments(status);
create index if not exists idx_appointments_patient_id  on appointments(patient_id);
create index if not exists idx_appointments_phone       on appointments(phone);
create index if not exists idx_patients_phone           on patients(phone);
create index if not exists idx_patients_name            on patients(name);
create index if not exists idx_patients_status          on patients(patient_status);
create index if not exists idx_patients_created_at      on patients(created_at DESC);
create index if not exists idx_patients_patient_code     on patients(patient_code);
create index if not exists idx_treatments_patient_id     on treatments(patient_id);
create index if not exists idx_treatments_status        on treatments(status);
create index if not exists idx_staff_roles_status       on staff_roles(status);
create index if not exists idx_audit_logs_target_user   on audit_logs(target_user_id);
create index if not exists idx_audit_logs_performed_by on audit_logs(performed_by_id);
create index if not exists idx_audit_logs_created_at    on audit_logs(created_at DESC);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table patients     enable row level security;
alter table appointments enable row level security;
alter table treatments   enable row level security;
alter table doctors      enable row level security;
alter table staff_roles  enable row level security;
alter table audit_logs   enable row level security;

-- Drop all old policies
drop policy if exists "anon full access - patients"     on patients;
drop policy if exists "anon full access - appointments" on appointments;
drop policy if exists "anon full access - treatments"   on treatments;
drop policy if exists "auth users read staff_roles"     on staff_roles;
drop policy if exists "auth users insert staff_roles"   on staff_roles;
drop policy if exists "auth users update staff_roles"   on staff_roles;
drop policy if exists "auth users read audit_logs"      on audit_logs;
drop policy if exists "auth users insert_audit_logs"    on audit_logs;

drop policy if exists "authenticated full access - patients"     on patients;
drop policy if exists "authenticated full access - appointments" on appointments;
drop policy if exists "authenticated full access - treatments"   on treatments;

-- Public and Anon access (Website functionality)
create policy "anon full access - patients"
  on patients for all to anon using (true) with check (true);

create policy "anon full access - appointments"
  on appointments for all to anon using (true) with check (true);

create policy "anon full access - treatments"
  on treatments for all to anon using (true) with check (true);

create policy "anon full access - doctors"
  on doctors for all to anon using (true) with check (true);

-- Authenticated CRM staff/admin access (Fixes 0 Patients dashboard / pages issue)
create policy "authenticated full access - patients"
  on patients for all to authenticated using (true) with check (true);

create policy "authenticated full access - appointments"
  on appointments for all to authenticated using (true) with check (true);

create policy "authenticated full access - treatments"
  on treatments for all to authenticated using (true) with check (true);

create policy "authenticated full access - doctors"
  on doctors for all to authenticated using (true) with check (true);

-- Staff roles policies
create policy "auth users read staff_roles"
  on staff_roles for select to authenticated using (true);

create policy "auth users insert staff_roles"
  ON staff_roles FOR INSERT TO authenticated
  WITH CHECK (
    exists (
      select 1 from staff_roles sr
      where sr.user_id = auth.uid() and sr.role = 'admin' and sr.status = 'Active'
    )
    or not exists (select 1 from staff_roles)
  );

create policy "auth users update staff_roles"
  ON staff_roles FOR UPDATE TO authenticated
  USING (
    exists (
      select 1 from staff_roles sr
      where sr.user_id = auth.uid() and sr.role = 'admin' and sr.status = 'Active'
    )
  );

-- Audit logs policies
create policy "auth users read audit_logs"
  on audit_logs for select to authenticated
  using (
    exists (
      select 1 from staff_roles sr
      where sr.user_id = auth.uid() and sr.role = 'admin' and sr.status = 'Active'
    )
  );

create policy "auth users insert_audit_logs"
  on audit_logs for insert to authenticated
  with check (true);


-- ── PATIENT & APPOINTMENT COALESCE SYNCHRONIZATION ENGINE ──
-- Permanent synchronization triggers for Sri Chaitanya Dental CRM

-- Add unique constraints & indexes to prevent duplicates on database level
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_phone_key;
ALTER TABLE patients ADD CONSTRAINT patients_phone_key UNIQUE (phone);

ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_email_key;
ALTER TABLE patients ADD CONSTRAINT patients_email_key UNIQUE (email);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_slot_key;
ALTER TABLE appointments ADD CONSTRAINT appointments_slot_key UNIQUE (phone, next_visit, appointment_time);

-- Add service role access policies to ensure background system triggers bypass RLS cleanly
DROP POLICY IF EXISTS "service_role full access - patients" ON patients;
DROP POLICY IF EXISTS "service_role full access - appointments" ON appointments;
DROP POLICY IF EXISTS "service_role full access - treatments" ON treatments;

CREATE POLICY "service_role full access - patients" ON patients TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - appointments" ON appointments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - treatments" ON treatments TO service_role USING (true) WITH CHECK (true);

-- Audit Log entry helper function
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


-- Trigger override to run BEFORE inserting/updating appointments to align Parent Patient
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


-- Trigger to run AFTER any appointment state updates to update Patient's clinical milestones
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


-- Bind Triggers to Appointments table
DROP TRIGGER IF EXISTS trg_ensure_patient_for_appointment ON appointments;
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
