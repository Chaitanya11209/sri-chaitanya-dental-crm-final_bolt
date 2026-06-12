-- =============================================================================
-- SECURITY FIX: Comprehensive security hardening
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DROP EXISTING FUNCTIONS THAT NEED SIGNATURE CHANGES
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS rls_auto_enable() CASCADE;
DROP FUNCTION IF EXISTS sync_appointment_to_bills() CASCADE;
DROP FUNCTION IF EXISTS generate_treatment_progress() CASCADE;
DROP FUNCTION IF EXISTS check_appointment_conflict(UUID, BIGINT, DATE, TEXT, INTEGER, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS update_treatment_doctor_name() CASCADE;
DROP FUNCTION IF EXISTS generate_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS update_invoice_totals() CASCADE;
DROP FUNCTION IF EXISTS generate_appointments_summary(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS generate_revenue_collection(DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS generate_outstanding_balances() CASCADE;
DROP FUNCTION IF EXISTS generate_doctor_performance(DATE, DATE) CASCADE;

-- -----------------------------------------------------------------------------
-- 2. RECREATE FUNCTIONS WITH SECURITY INVOKER AND SET search_path = ''
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_treatment_progress()
RETURNS TABLE(
  patient_name TEXT,
  treatment TEXT,
  stage TEXT,
  sessions_done INTEGER,
  total_sessions INTEGER,
  progress_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
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
  FROM public.treatments t
  WHERE t.stage != 'Completed'
  ORDER BY progress_pct ASC;
END;
$$;

CREATE OR REPLACE FUNCTION sync_appointment_to_bills()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.bills (patient_id, appointment_id, amount_paid, balance_amount, payment_mode, payment_notes)
  VALUES (
    NEW.patient_id,
    NEW.id,
    COALESCE(NEW.amount_paid, 0),
    COALESCE(NEW.balance_amount, 0),
    COALESCE(NEW.payment_mode, 'Cash'),
    NEW.notes
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    amount_paid = COALESCE(NEW.amount_paid, 0),
    balance_amount = COALESCE(NEW.balance_amount, 0),
    payment_mode = COALESCE(NEW.payment_mode, 'Cash'),
    payment_notes = NEW.notes,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_appointment_conflict(
  p_doctor_id UUID,
  p_chair_id BIGINT,
  p_appointment_date DATE,
  p_start_time TEXT,
  p_duration_minutes INTEGER DEFAULT 30,
  p_exclude_appointment_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_end_time TIME;
  v_day_of_week SMALLINT;
  v_schedule RECORD;
  v_doctor_available BOOLEAN;
BEGIN
  v_end_time := (p_start_time || ':00')::TIME + (p_duration_minutes || ' minutes')::INTERVAL;
  v_day_of_week := EXTRACT(DOW FROM p_appointment_date);

  SELECT is_available INTO v_doctor_available
  FROM public.doctor_schedules ds
  WHERE ds.doctor_id = p_doctor_id AND ds.day_of_week = v_day_of_week;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_no_schedule', 'conflict_details', jsonb_build_object('day_of_week', v_day_of_week));
  END IF;

  IF NOT v_doctor_available THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_unavailable', 'conflict_details', jsonb_build_object('reason', 'Doctor marked unavailable'));
  END IF;

  SELECT * INTO v_schedule FROM public.doctor_schedules WHERE doctor_id = p_doctor_id AND day_of_week = v_day_of_week;

  IF v_schedule.start_time > (p_start_time || ':00')::TIME OR v_schedule.end_time < v_end_time THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'outside_schedule_hours', 'conflict_details', jsonb_build_object('doctor_start', v_schedule.start_time, 'doctor_end', v_schedule.end_time));
  END IF;

  IF v_schedule.break_start IS NOT NULL AND v_schedule.break_end IS NOT NULL THEN
    IF (p_start_time || ':00')::TIME < v_schedule.break_end AND v_end_time > v_schedule.break_start THEN
      RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'break_time', 'conflict_details', jsonb_build_object('break_start', v_schedule.break_start, 'break_end', v_schedule.break_end));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.doctor_time_off WHERE doctor_id = p_doctor_id AND status = 'Approved' AND start_datetime <= (p_appointment_date || ' ' || p_start_time || ':00')::TIMESTAMPTZ AND end_datetime >= (p_appointment_date || ' ' || v_end_time)::TIMESTAMPTZ) THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_on_leave', 'conflict_details', jsonb_build_object('reason', 'Doctor has approved leave'));
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointments WHERE doctor_id = p_doctor_id AND next_visit::text = p_appointment_date::text AND status NOT IN ('Cancelled', 'Deleted', 'No Show') AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id) AND appointment_time IS NOT NULL AND (appointment_time::TIME < v_end_time AND (appointment_time::TIME + (COALESCE(duration_minutes, 30) || ' minutes')::INTERVAL) > (p_start_time || ':00')::TIME)) THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_double_booked', 'conflict_details', jsonb_build_object('reason', 'Doctor already booked'));
  END IF;

  RETURN '{"has_conflict": false, "conflict_type": null, "conflict_details": {}}'::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION update_treatment_doctor_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.doctor_id IS NOT NULL AND (OLD.doctor_id IS NULL OR OLD.doctor_id != NEW.doctor_id) THEN
    SELECT name INTO NEW.doctor_name FROM public.doctors WHERE id = NEW.doctor_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_seq INTEGER;
BEGIN
  v_year := TO_CHAR(NEW.invoice_date, 'YY');
  v_month := TO_CHAR(NEW.invoice_date, 'MM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 9 FOR 5) AS INTEGER)), 0) + 1 INTO v_seq FROM public.invoices WHERE invoice_date >= DATE_TRUNC('month', NEW.invoice_date) AND invoice_date < DATE_TRUNC('month', NEW.invoice_date) + INTERVAL '1 month';
  NEW.invoice_number := 'INV-' || v_year || v_month || '-' || LPAD(v_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_subtotal FROM public.invoice_items WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices SET
    subtotal = v_subtotal,
    discount_amount = CASE WHEN discount_type = 'Percentage' THEN v_subtotal * (discount_value / 100) ELSE discount_value END,
    total_amount = v_subtotal - CASE WHEN discount_type = 'Percentage' THEN v_subtotal * (discount_value / 100) ELSE discount_value END + (v_subtotal - CASE WHEN discount_type = 'Percentage' THEN v_subtotal * (discount_value / 100) ELSE discount_value END) * (tax_percentage / 100),
    updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION generate_appointments_summary(p_start_date DATE, p_end_date DATE)
RETURNS TABLE(date DATE, total BIGINT, completed BIGINT, pending BIGINT, cancelled BIGINT, no_shows BIGINT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT a.next_visit::DATE as date, COUNT(*) as total, COUNT(*) FILTER (WHERE a.status = 'Completed') as completed, COUNT(*) FILTER (WHERE a.status = 'Pending' OR a.status = 'Confirmed') as pending, COUNT(*) FILTER (WHERE a.status = 'Cancelled') as cancelled, COUNT(*) FILTER (WHERE a.status = 'No Show') as no_shows
  FROM public.appointments a WHERE a.next_visit::DATE >= p_start_date AND a.next_visit::DATE <= p_end_date AND a.status != 'Deleted' GROUP BY a.next_visit::DATE ORDER BY date;
END;
$$;

CREATE OR REPLACE FUNCTION generate_revenue_collection(p_start_date DATE, p_end_date DATE)
RETURNS TABLE(date DATE, cash NUMERIC, card NUMERIC, upi NUMERIC, other NUMERIC, total NUMERIC)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT p.payment_date::DATE as date, COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'Cash'), 0) as cash, COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method IN ('Card', 'Credit Card', 'Debit Card')), 0) as card, COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'UPI'), 0) as upi, COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method NOT IN ('Cash', 'Card', 'Credit Card', 'Debit Card', 'UPI')), 0) as other, COALESCE(SUM(p.amount), 0) as total
  FROM public.payments p WHERE p.payment_date::DATE >= p_start_date AND p.payment_date::DATE <= p_end_date AND p.status = 'Completed' GROUP BY p.payment_date::DATE ORDER BY date;
END;
$$;

CREATE OR REPLACE FUNCTION generate_outstanding_balances()
RETURNS TABLE(patient_name TEXT, phone TEXT, total_billed NUMERIC, amount_paid NUMERIC, balance NUMERIC, last_visit DATE)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT a.name as patient_name, a.phone, COALESCE(SUM(a.amount_paid + a.balance_amount), 0) as total_billed, COALESCE(SUM(a.amount_paid), 0) as amount_paid, COALESCE(SUM(a.balance_amount), 0) as balance, MAX(a.next_visit::DATE) as last_visit
  FROM public.appointments a WHERE a.balance_amount > 0 AND a.status NOT IN ('Cancelled', 'Deleted') GROUP BY a.name, a.phone HAVING SUM(a.balance_amount) > 0 ORDER BY balance DESC;
END;
$$;

CREATE OR REPLACE FUNCTION generate_doctor_performance(p_start_date DATE, p_end_date DATE)
RETURNS TABLE(doctor_name TEXT, appointments BIGINT, completed BIGINT, treatments BIGINT, revenue NUMERIC)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(a.doctor_name, 'Unassigned') as doctor_name, COUNT(*) as appointments, COUNT(*) FILTER (WHERE a.status = 'Completed') as completed, COUNT(DISTINCT t.id) as treatments, COALESCE(SUM(a.amount_paid), 0) as revenue
  FROM public.appointments a LEFT JOIN public.treatments t ON t.doctor_id = a.doctor_id WHERE a.next_visit::DATE >= p_start_date AND a.next_visit::DATE <= p_end_date AND a.status != 'Deleted' GROUP BY a.doctor_name ORDER BY revenue DESC;
END;
$$;

CREATE OR REPLACE FUNCTION rls_auto_enable()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
END;
$$;

-- Revoke execute from anon and authenticated
REVOKE EXECUTE ON FUNCTION rls_auto_enable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION sync_appointment_to_bills() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION check_appointment_conflict(UUID, BIGINT, DATE, TEXT, INTEGER, BIGINT) FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. FIX RLS POLICIES
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow appointment inserts" ON appointments;
DROP POLICY IF EXISTS "Allow delete" ON appointments;
DROP POLICY IF EXISTS "Allow update" ON appointments;
DROP POLICY IF EXISTS "anon_insert_appointments_only" ON appointments;
DROP POLICY IF EXISTS "authenticated full access" ON appointments;

CREATE POLICY "appointments_select" ON appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "appointments_insert" ON appointments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid()));
CREATE POLICY "appointments_update" ON appointments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid()));
CREATE POLICY "appointments_delete" ON appointments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Allow authenticated users to delete doctors" ON doctors;
DROP POLICY IF EXISTS "Allow authenticated users to insert doctors" ON doctors;
DROP POLICY IF EXISTS "Allow authenticated users to update doctors" ON doctors;
DROP POLICY IF EXISTS "authenticated full access - doctors" ON doctors;
DROP POLICY IF EXISTS "authenticated full access" ON doctors;

CREATE POLICY "doctors_select" ON doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "doctors_insert" ON doctors FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "doctors_update" ON doctors FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "doctors_delete" ON doctors FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Bills policies
CREATE POLICY "bills_select" ON bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "bills_insert" ON bills FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));
CREATE POLICY "bills_update" ON bills FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist'))) WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));
CREATE POLICY "bills_delete" ON bills FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Payment plans policies
CREATE POLICY "payment_plans_select" ON payment_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_plans_insert" ON payment_plans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));
CREATE POLICY "payment_plans_update" ON payment_plans FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist'))) WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));
CREATE POLICY "payment_plans_delete" ON payment_plans FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Payment plan instalments policies
CREATE POLICY "payment_plan_instalments_select" ON payment_plan_instalments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_plan_instalments_insert" ON payment_plan_instalments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));
CREATE POLICY "payment_plan_instalments_update" ON payment_plan_instalments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist'))) WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));
CREATE POLICY "payment_plan_instalments_delete" ON payment_plan_instalments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Treatments policies
CREATE POLICY "treatments_select" ON treatments FOR SELECT TO authenticated USING (true);
CREATE POLICY "treatments_insert" ON treatments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')));
CREATE POLICY "treatments_update" ON treatments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'doctor'))) WITH CHECK (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')));
CREATE POLICY "treatments_delete" ON treatments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id = auth.uid() AND role = 'admin'));
