-- =============================================================================
-- PHASE 10: REPORTING SYSTEM
-- Report templates, scheduled reports, report history
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. REPORT TEMPLATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('Financial', 'Clinical', 'Operational', 'Patient', 'Staff', 'Custom')),
  description TEXT,
  query_template TEXT,
  columns JSONB DEFAULT '[]'::JSONB,
  filters JSONB DEFAULT '[]'::JSONB,
  default_date_range TEXT DEFAULT 'month' CHECK (default_date_range IN ('today', 'week', 'month', 'quarter', 'year', 'custom', 'all')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default report templates
INSERT INTO report_templates (name, category, description, columns, default_date_range) VALUES
  ('Appointments Summary', 'Operational', 'Daily/period appointment summary with status breakdown', 
   '[{"key": "date", "label": "Date"}, {"key": "total", "label": "Total"}, {"key": "completed", "label": "Completed"}, {"key": "pending", "label": "Pending"}, {"key": "cancelled", "label": "Cancelled"}, {"key": "no_shows", "label": "No Shows"}]'::jsonb, 'month'),
  ('Revenue Collection', 'Financial', 'Payments received with breakdown by method', 
   '[{"key": "date", "label": "Date"}, {"key": "cash", "label": "Cash"}, {"key": "card", "label": "Card"}, {"key": "upi", "label": "UPI"}, {"key": "total", "label": "Total"}]'::jsonb, 'month'),
  ('Outstanding Balances', 'Financial', 'Patients with pending payment balances', 
   '[{"key": "patient_name", "label": "Patient"}, {"key": "phone", "label": "Phone"}, {"key": "total_billed", "label": "Total Billed"}, {"key": "amount_paid", "label": "Paid"}, {"key": "balance", "label": "Balance"}, {"key": "last_visit", "label": "Last Visit"}]'::jsonb, 'all'),
  ('Treatment Progress', 'Clinical', 'Active treatment plans and their progress', 
   '[{"key": "patient_name", "label": "Patient"}, {"key": "treatment", "label": "Treatment"}, {"key": "stage", "label": "Stage"}, {"key": "sessions_done", "label": "Sessions Done"}, {"key": "total_sessions", "label": "Total Sessions"}, {"key": "progress_pct", "label": "Progress %"}]'::jsonb, 'all'),
  ('Patient Registration Trend', 'Patient', 'New patient registrations over time', 
   '[{"key": "date", "label": "Date"}, {"key": "new_patients", "label": "New Patients"}, {"key": "cumulative", "label": "Cumulative Total"}]'::jsonb, 'month'),
  ('Doctor Performance', 'Staff', 'Appointment and treatment stats by doctor', 
   '[{"key": "doctor_name", "label": "Doctor"}, {"key": "appointments", "label": "Appointments"}, {"key": "completed", "label": "Completed"}, {"key": "treatments", "label": "Treatments"}, {"key": "revenue", "label": "Revenue"}]'::jsonb, 'month'),
  ('Treatment Categories', 'Clinical', 'Distribution of treatments by category', 
   '[{"key": "treatment_type", "label": "Treatment"}, {"key": "count", "label": "Count"}, {"key": "revenue", "label": "Revenue"}, {"key": "avg_duration", "label": "Avg Duration"}]'::jsonb, 'month'),
  ('Follow-up Due', 'Patient', 'Patients due or overdue for follow-up', 
   '[{"key": "patient_name", "label": "Patient"}, {"key": "phone", "label": "Phone"}, {"key": "last_visit", "label": "Last Visit"}, {"key": "due_date", "label": "Due Date"}, {"key": "overdue_days", "label": "Days Overdue"}]'::jsonb, 'all'),
  ('Daily Cash Flow', 'Financial', 'Day-wise cash and digital payment summary', 
   '[{"key": "date", "label": "Date"}, {"key": "cash_payments", "label": "Cash"}, {"key": "digital_payments", "label": "Digital"}, {"key": "total_received", "label": "Total"}]'::jsonb, 'month'),
  ('Lab Work Status', 'Operational', 'Pending and completed lab work items', 
   '[{"key": "patient_name", "label": "Patient"}, {"key": "treatment", "label": "Treatment"}, {"key": "lab_status", "label": "Lab Status"}, {"key": "sent_date", "label": "Sent Date"}, {"key": "expected_date", "label": "Expected Date"}]'::jsonb, 'all')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. SAVED REPORTS / REPORT HISTORY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_reports (
  id BIGSERIAL PRIMARY KEY,
  report_name TEXT NOT NULL,
  template_id BIGINT REFERENCES report_templates(id) ON DELETE SET NULL,
  date_range_start DATE,
  date_range_end DATE,
  filters JSONB DEFAULT '[]'::JSONB,
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  summary JSONB DEFAULT '{}'::JSONB,
  row_count INTEGER DEFAULT 0,
  format TEXT DEFAULT 'json' CHECK (format IN ('json', 'csv', 'pdf')),
  file_url TEXT,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_scheduled BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_generated ON saved_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_saved_reports_template ON saved_reports(template_id);

-- -----------------------------------------------------------------------------
-- 3. SCHEDULED REPORTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  template_id BIGINT NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  day_of_week SMALLINT CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month SMALLINT CHECK (day_of_month >= 1 AND day_of_month <= 28),
  time_of_day TIME DEFAULT '06:00:00',
  recipients JSONB DEFAULT '[]'::JSONB,
  format TEXT DEFAULT 'csv' CHECK (format IN ('json', 'csv', 'pdf')),
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. REPORT FUNCTIONS
-- -----------------------------------------------------------------------------

-- Function to generate appointments summary
CREATE OR REPLACE FUNCTION generate_appointments_summary(p_start_date DATE, p_end_date DATE)
RETURNS TABLE(
  date DATE,
  total BIGINT,
  completed BIGINT,
  pending BIGINT,
  cancelled BIGINT,
  no_shows BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.next_visit::DATE as date,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE a.status = 'Completed') as completed,
    COUNT(*) FILTER (WHERE a.status = 'Pending' OR a.status = 'Confirmed') as pending,
    COUNT(*) FILTER (WHERE a.status = 'Cancelled') as cancelled,
    COUNT(*) FILTER (WHERE a.status = 'No Show') as no_shows
  FROM appointments a
  WHERE a.next_visit::DATE >= p_start_date
    AND a.next_visit::DATE <= p_end_date
    AND a.status != 'Deleted'
  GROUP BY a.next_visit::DATE
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- Function to generate revenue collection report
CREATE OR REPLACE FUNCTION generate_revenue_collection(p_start_date DATE, p_end_date DATE)
RETURNS TABLE(
  date DATE,
  cash NUMERIC,
  card NUMERIC,
  upi NUMERIC,
  other NUMERIC,
  total NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.payment_date::DATE as date,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'Cash'), 0) as cash,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method IN ('Card', 'Credit Card', 'Debit Card')), 0) as card,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'UPI'), 0) as upi,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method NOT IN ('Cash', 'Card', 'Credit Card', 'Debit Card', 'UPI')), 0) as other,
    COALESCE(SUM(p.amount), 0) as total
  FROM payments p
  WHERE p.payment_date::DATE >= p_start_date
    AND p.payment_date::DATE <= p_end_date
    AND p.status = 'Completed'
  GROUP BY p.payment_date::DATE
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- Function to generate outstanding balances report
CREATE OR REPLACE FUNCTION generate_outstanding_balances()
RETURNS TABLE(
  patient_name TEXT,
  phone TEXT,
  total_billed NUMERIC,
  amount_paid NUMERIC,
  balance NUMERIC,
  last_visit DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.name as patient_name,
    a.phone,
    COALESCE(SUM(a.amount_paid + a.balance_amount), 0) as total_billed,
    COALESCE(SUM(a.amount_paid), 0) as amount_paid,
    COALESCE(SUM(a.balance_amount), 0) as balance,
    MAX(a.next_visit::DATE) as last_visit
  FROM appointments a
  WHERE a.balance_amount > 0
    AND a.status NOT IN ('Cancelled', 'Deleted')
  GROUP BY a.name, a.phone
  HAVING SUM(a.balance_amount) > 0
  ORDER BY balance DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to generate doctor performance report
CREATE OR REPLACE FUNCTION generate_doctor_performance(p_start_date DATE, p_end_date DATE)
RETURNS TABLE(
  doctor_name TEXT,
  appointments BIGINT,
  completed BIGINT,
  treatments BIGINT,
  revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(a.doctor_name, 'Unassigned') as doctor_name,
    COUNT(*) as appointments,
    COUNT(*) FILTER (WHERE a.status = 'Completed') as completed,
    COUNT(DISTINCT t.id) as treatments,
    COALESCE(SUM(a.amount_paid), 0) as revenue
  FROM appointments a
  LEFT JOIN treatments t ON t.doctor_id = a.doctor_id
  WHERE a.next_visit::DATE >= p_start_date
    AND a.next_visit::DATE <= p_end_date
    AND a.status != 'Deleted'
  GROUP BY a.doctor_name
  ORDER BY revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to generate treatment progress report
CREATE OR REPLACE FUNCTION generate_treatment_progress()
RETURNS TABLE(
  patient_name TEXT,
  treatment TEXT,
  stage TEXT,
  sessions_done INTEGER,
  total_sessions INTEGER,
  progress_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.patient_name,
    t.treatment_type as treatment,
    t.stage,
    t.sessions_done,
    COALESCE(t.total_sessions, t.estimated_sessions, 1) as total_sessions,
    CASE
      WHEN t.stage = 'Completed' THEN 100
      WHEN COALESCE(t.total_sessions, t.estimated_sessions, 1) > 0 
        THEN LEAST(100, (t.sessions_done::NUMERIC / COALESCE(t.total_sessions, t.estimated_sessions, 1)) * 100)
      ELSE 0
    END as progress_pct
  FROM treatments t
  WHERE t.stage != 'Completed'
  ORDER BY progress_pct ASC;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 5. RLS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_report_templates" ON report_templates;
CREATE POLICY "view_report_templates" ON report_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_report_templates" ON report_templates;
CREATE POLICY "manage_report_templates" ON report_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "view_saved_reports" ON saved_reports;
CREATE POLICY "view_saved_reports" ON saved_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_saved_reports" ON saved_reports;
CREATE POLICY "manage_saved_reports" ON saved_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist', 'doctor')));

DROP POLICY IF EXISTS "view_scheduled_reports" ON scheduled_reports;
CREATE POLICY "view_scheduled_reports" ON scheduled_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_scheduled_reports" ON scheduled_reports;
CREATE POLICY "manage_scheduled_reports" ON scheduled_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));
