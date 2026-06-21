-- ============================================================
-- SRI CHAITANYA DENTAL CRM — SCHEMA & SYNCHRONIZATION RECONCILIATION
-- ============================================================

-- 1. Complete Canonical Doctors Schema Update
-- Add any missing helper elements to meet the requested fields
alter table public.doctors add column if not exists is_active boolean default true;
alter table public.doctors add column if not exists updated_at timestamptz default now();

-- Ensure doctor indexing exists
create index if not exists idx_doctors_is_active on public.doctors(is_active);

-- Ensure doctor constraint on appointments
do $$ 
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'appointments_doctor_id_fkey'
  ) then
    alter table public.appointments 
      add constraint appointments_doctor_id_fkey 
      foreign key (doctor_id) references public.doctors(id) on delete set null;
  end if;
end $$;

-- 2. Build Profiles Table (for user roles verification)
create table if not exists public.profiles (
  id uuid primary key,
  name text,
  email text,
  role text default 'staff',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- Drop prior policies if exist
drop policy if exists "anon full access - profiles" on public.profiles;
drop policy if exists "authenticated full access - profiles" on public.profiles;

-- Create simple policies for sandbox integrity
create policy "anon full access - profiles"
  on public.profiles for all to anon using (true) with check (true);

create policy "authenticated full access - profiles"
  on public.profiles for all to authenticated using (true) with check (true);

-- 3. Build Synced Bills Table
create table if not exists public.bills (
  id bigserial primary key,
  patient_id bigint references public.patients(id) on delete cascade,
  appointment_id bigint references public.appointments(id) on delete cascade,
  amount_paid numeric default 0,
  balance_amount numeric default 0,
  payment_mode text default 'Cash',
  payment_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add unique constraint on bills.appointment_id for UPSERT operations
alter table public.bills drop constraint if exists uq_bills_appointment_id;
alter table public.bills add constraint uq_bills_appointment_id unique (appointment_id);

-- Enable RLS for bills
alter table public.bills enable row level security;

-- Setup full access policies for bills table
drop policy if exists "anon full access - bills" on public.bills;
drop policy if exists "authenticated full access - bills" on public.bills;
drop policy if exists "service_role full access - bills" on public.bills;

create policy "anon full access - bills"
  on public.bills for all to anon using (true) with check (true);

create policy "authenticated full access - bills"
  on public.bills for all to authenticated using (true) with check (true);

create policy "service_role full access - bills"
  on public.bills for all to service_role using (true) with check (true);

-- 4. Establish Single Source of Truth Billing Realtime Synced Triggers
-- Function to automatically sync insert/update actions to the bills table
create or replace function public.sync_appointment_to_bills()
returns trigger as $$
begin
  if (new.amount_paid is not null or new.balance_amount is not null or new.payment_mode is not null) then
    insert into public.bills (patient_id, appointment_id, amount_paid, balance_amount, payment_mode, payment_notes, created_at, updated_at)
    values (
      new.patient_id,
      new.id,
      coalesce(new.amount_paid, 0),
      coalesce(new.balance_amount, 0),
      coalesce(new.payment_mode, 'Cash'),
      new.payment_notes,
      coalesce(new.created_at, now()),
      now()
    )
    on conflict (appointment_id) do update set
      patient_id = excluded.patient_id,
      amount_paid = excluded.amount_paid,
      balance_amount = excluded.balance_amount,
      payment_mode = excluded.payment_mode,
      payment_notes = excluded.payment_notes,
      updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for insertion or modification
drop trigger if exists trg_sync_appointment_to_bills on public.appointments;
create trigger trg_sync_appointment_to_bills
  after insert or update on public.appointments
  for each row execute function public.sync_appointment_to_bills();

-- Function to handle deleted appointments
create or replace function public.sync_delete_appointment_bill()
returns trigger as $$
begin
  delete from public.bills where appointment_id = old.id;
  return old;
end;
$$ language plpgsql security definer;

-- Trigger to delete bills when appointment is deleted
drop trigger if exists trg_sync_delete_appointment_bill on public.appointments;
create trigger trg_sync_delete_appointment_bill
  after delete on public.appointments
  for each row execute function public.sync_delete_appointment_bill();

-- Populate existing bills from historical appointments
insert into public.bills (patient_id, appointment_id, amount_paid, balance_amount, payment_mode, payment_notes, created_at, updated_at)
select 
  patient_id, 
  id, 
  coalesce(amount_paid, 0), 
  coalesce(balance_amount, 0), 
  coalesce(payment_mode, 'Cash'), 
  payment_notes, 
  coalesce(created_at, now()), 
  now()
from public.appointments
where (amount_paid is not null or balance_amount is not null or payment_mode is not null)
on conflict (appointment_id) do nothing;
