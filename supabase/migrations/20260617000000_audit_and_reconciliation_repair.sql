-- ============================================================
-- SRI CHAITANYA DENTAL CRM — SCHEMA REPAIR & DECOUPLED TABLES
-- ============================================================

-- 1. Create EXPENSES table (to persist operational costs)
CREATE TABLE IF NOT EXISTS public.expenses (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  category    TEXT NOT NULL DEFAULT 'Dental Materials',
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- Enable RLS & access control for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access - expenses" ON public.expenses;
DROP POLICY IF EXISTS "authenticated full access - expenses" ON public.expenses;
DROP POLICY IF EXISTS "service_role full access - expenses" ON public.expenses;

CREATE POLICY "anon full access - expenses" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access - expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - expenses" ON public.expenses FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 2. Create INVENTORY table (to persist medicine & dental materials stock)
CREATE TABLE IF NOT EXISTS public.inventory (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'Medicine',
  stock       INTEGER NOT NULL DEFAULT 0,
  min_stock   INTEGER NOT NULL DEFAULT 0,
  unit        TEXT,
  expiry_date DATE,
  supplier    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON public.inventory(expiry_date);

-- Enable RLS & access control for inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access - inventory" ON public.inventory;
DROP POLICY IF EXISTS "authenticated full access - inventory" ON public.inventory;
DROP POLICY IF EXISTS "service_role full access - inventory" ON public.inventory;

CREATE POLICY "anon full access - inventory" ON public.inventory FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access - inventory" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - inventory" ON public.inventory FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 3. Create LAB_REQUESTS table (to track dental prosthesis & pathology lab tests)
CREATE TABLE IF NOT EXISTS public.lab_requests (
  id           BIGSERIAL PRIMARY KEY,
  patient_name TEXT NOT NULL,
  test_name    TEXT NOT NULL,
  doctor_name  TEXT,
  status       TEXT NOT NULL DEFAULT 'Pending Collection',
  priority     TEXT NOT NULL DEFAULT 'Routine',
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  test_result  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_requests_patient_name ON public.lab_requests(patient_name);
CREATE INDEX IF NOT EXISTS idx_lab_requests_status ON public.lab_requests(status);

-- Enable RLS & access control for lab_requests
ALTER TABLE public.lab_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access - lab_requests" ON public.lab_requests;
DROP POLICY IF EXISTS "authenticated full access - lab_requests" ON public.lab_requests;
DROP POLICY IF EXISTS "service_role full access - lab_requests" ON public.lab_requests;

CREATE POLICY "anon full access - lab_requests" ON public.lab_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access - lab_requests" ON public.lab_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - lab_requests" ON public.lab_requests FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 4. Create FEEDBACKS table (to persist surveys, NPS score and clinical ratings)
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id               BIGSERIAL PRIMARY KEY,
  patient_name     TEXT NOT NULL,
  rating           INTEGER NOT NULL DEFAULT 5,
  recommend_rating INTEGER NOT NULL DEFAULT 10,
  comments         TEXT,
  category         TEXT NOT NULL DEFAULT 'Doctor Care',
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'Pending Actions',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_rating ON public.feedbacks(rating);
CREATE INDEX IF NOT EXISTS idx_feedbacks_date ON public.feedbacks(date);

-- Enable RLS & access control for feedbacks
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access - feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "authenticated full access - feedbacks" ON public.feedbacks;
DROP POLICY IF EXISTS "service_role full access - feedbacks" ON public.feedbacks;

CREATE POLICY "anon full access - feedbacks" ON public.feedbacks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access - feedbacks" ON public.feedbacks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - feedbacks" ON public.feedbacks FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 5. Create WHATSAPP_MESSAGES table (to persist communication, campaigns and SMS alerts logs)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id            BIGSERIAL PRIMARY KEY,
  patient_id    BIGINT REFERENCES public.patients(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Sent',
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_patient_id ON public.whatsapp_messages(patient_id);

-- Enable RLS & access control for whatsapp_messages
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon full access - whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "authenticated full access - whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "service_role full access - whatsapp_messages" ON public.whatsapp_messages;

CREATE POLICY "anon full access - whatsapp_messages" ON public.whatsapp_messages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access - whatsapp_messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - whatsapp_messages" ON public.whatsapp_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
