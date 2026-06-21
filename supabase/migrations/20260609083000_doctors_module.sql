-- ============================================================
-- SRI CHAITANYA DENTAL CARE — DOCTORS MODULE MIGRATION
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Create doctors table if not exists
create table if not exists doctors (
  id               bigserial primary key,
  name             text not null,
  qualification    text,
  specialization   text,
  phone            text,
  email            text,
  status           text default 'Active' check (status in ('Active', 'Inactive')),
  created_at       timestamptz default now()
);

-- Index the doctors table
create index if not exists idx_doctors_status on doctors(status);
create index if not exists idx_doctors_name on doctors(name);

-- Add doctor relation columns to appointments table
alter table appointments add column if not exists doctor_id bigint references doctors(id) on delete set null;
alter table appointments add column if not exists doctor_name text;

-- Add indexes for doctors on appointments
create index if not exists idx_appointments_doctor_id on appointments(doctor_id);

-- Enable RLS for doctors table
alter table doctors enable row level security;

-- Setup default policies
drop policy if exists "anon full access - doctors" on doctors;
drop policy if exists "authenticated full access - doctors" on doctors;
drop policy if exists "service_role full access - doctors" on doctors;

create policy "anon full access - doctors"
  on doctors for all to anon using (true) with check (true);

create policy "authenticated full access - doctors"
  on doctors for all to authenticated using (true) with check (true);

create policy "service_role full access - doctors"
  on doctors for all to service_role using (true) with check (true);

-- Insert original practitioner to populate initial doctors list
insert into doctors (name, qualification, specialization, phone, email, status)
values ('Dr. Bhavani', 'BDS, MDS', 'Chief Implantologist & Prosthodontist', '918317575165', 'chaitubolla09@gmail.com', 'Active')
on conflict do nothing;
