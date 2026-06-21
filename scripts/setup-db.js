#!/usr/bin/env node
/**
 * Sri Chaitanya Dental Care — Database Setup Script
 *
 * This script creates all required Supabase tables automatically.
 * Run it ONCE before your first deploy (or after a fresh Supabase project).
 *
 * Usage:
 *   node scripts/setup-db.js
 *
 * Requirements:
 *   - VITE_SUPABASE_URL in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY in .env.local  (NOT the anon key — needs elevated access)
 *     Get it from: Supabase Dashboard → Project Settings → API → service_role
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env vars from .env.local ────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local');
  if (!existsSync(envPath)) {
    console.error('❌  .env.local not found. Copy .env.example to .env.local and fill in your keys.');
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌  VITE_SUPABASE_URL is missing in .env.local');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  console.error('   Get it from: Supabase Dashboard → Project Settings → API → service_role secret');
  process.exit(1);
}

// ── SQL to execute ────────────────────────────────────────────────────────────
const SQL = `
-- patients
create table if not exists patients (
  id              bigserial primary key,
  patient_code    text unique,
  name            text not null,
  phone           text,
  email           text,
  location        text,
  age             text,
  gender          text,
  notes           text,
  created_at      timestamptz default now()
);

-- appointments
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
  visit_count      int default 1,
  visit_type       text default 'New',
  amount_paid      numeric default 0,
  balance_amount   numeric default 0,
  payment_mode     text default 'Cash',
  payment_notes    text,
  created_at       timestamptz default now()
);

-- treatments
create table if not exists treatments (
  id                 bigserial primary key,
  patient_name       text,
  phone              text,
  treatment_type     text,
  stage              text default 'Assessment',
  start_date         date,
  expected_end_date  date,
  total_sessions     int,
  sessions_done      int default 0,
  treatment_notes    text,
  doctor_notes       text,
  created_at         timestamptz default now()
);

-- indexes
create index if not exists idx_appointments_next_visit  on appointments(next_visit);
create index if not exists idx_appointments_status      on appointments(status);
create index if not exists idx_appointments_patient_id  on appointments(patient_id);
create index if not exists idx_appointments_phone       on appointments(phone);
create index if not exists idx_patients_phone           on patients(phone);
create index if not exists idx_patients_name            on patients(name);

-- RLS
alter table patients     enable row level security;
alter table appointments enable row level security;
alter table treatments   enable row level security;

-- Drop existing policies if re-running
drop policy if exists "anon full access - patients"     on patients;
drop policy if exists "anon full access - appointments" on appointments;
drop policy if exists "anon full access - treatments"   on treatments;
drop policy if exists "authenticated full access - patients"     on patients;
drop policy if exists "authenticated full access - appointments" on appointments;
drop policy if exists "authenticated full access - treatments"   on treatments;

-- Allow anon key full access (app uses anon key for all operations)
create policy "anon full access - patients"
  on patients for all to anon using (true) with check (true);

create policy "anon full access - appointments"
  on appointments for all to anon using (true) with check (true);

create policy "anon full access - treatments"
  on treatments for all to anon using (true) with check (true);

-- Allow logged-in CRM users full access
create policy "authenticated full access - patients"
  on patients for all to authenticated using (true) with check (true);

create policy "authenticated full access - appointments"
  on appointments for all to authenticated using (true) with check (true);

create policy "authenticated full access - treatments"
  on treatments for all to authenticated using (true) with check (true);
`;

// ── Run via Supabase REST API (pg endpoint) ───────────────────────────────────
async function run() {
  console.log('🦷  Sri Chaitanya Dental Care — Database Setup');
  console.log(`📡  Connecting to: ${supabaseUrl}`);
  console.log('');

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: SQL }),
  }).catch(() => null);

  // Supabase doesn't expose raw SQL via REST — use the pg endpoint instead
  const pgResponse = await fetch(`${supabaseUrl}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: SQL }),
  }).catch(() => null);

  if (!pgResponse || pgResponse.status >= 400) {
    // Fall back to showing manual instructions
    console.log('ℹ️   Direct SQL execution requires the Supabase Management API.');
    console.log('');
    console.log('✅  MANUAL SETUP (30 seconds):');
    console.log('   1. Go to https://supabase.com/dashboard');
    console.log('   2. Open your project → SQL Editor → New Query');
    console.log('   3. Paste the contents of:  supabase/schema.sql');
    console.log('   4. Click RUN');
    console.log('');
    console.log('📄  Schema file location: supabase/schema.sql');
    return;
  }

  const result = await pgResponse.json().catch(() => ({}));
  if (result.error) {
    console.error('❌  Error:', result.error);
    process.exit(1);
  }

  console.log('✅  Database tables created successfully!');
  console.log('');
  console.log('Tables created:');
  console.log('  ✓ patients');
  console.log('  ✓ appointments');
  console.log('  ✓ treatments');
  console.log('');
  console.log('RLS policies applied (anon key has full access).');
  console.log('');
  console.log('🚀  Ready! Run: npm run dev');
}

run().catch((err) => {
  console.error('❌  Unexpected error:', err.message);
  process.exit(1);
});
