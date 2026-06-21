-- ============================================================
-- Sri Chaitanya Dental Care — Row Level Security (RLS) Policies
-- This file lists all active database security statements for reference.
-- ============================================================

-- Enable RLS on core clinic tables
ALTER TABLE patients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs   ENABLE ROW LEVEL SECURITY;

-- ── PUBLIC & ANON POLICIES (Website booking landing page) ──
CREATE POLICY "anon full access - patients"
  ON patients FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon full access - appointments"
  ON appointments FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon full access - treatments"
  ON treatments FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon full access - doctors"
  ON doctors FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── AUTHENTICATED STAFF POLICIES (CRM Dashboard operations) ──
CREATE POLICY "authenticated full access - patients"
  ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access - appointments"
  ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access - treatments"
  ON treatments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access - doctors"
  ON doctors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── STAFF ACCESS CONFIGURATION POLICIES ──────────────────────
CREATE POLICY "auth users read staff_roles"
  ON staff_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth users insert staff_roles"
  ON staff_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_roles sr
      WHERE sr.user_id = auth.uid() AND sr.role IN ('admin', 'doctor') AND sr.status = 'Active'
    )
    OR NOT EXISTS (SELECT 1 FROM staff_roles)
  );

CREATE POLICY "auth users update staff_roles"
  ON staff_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles sr
      WHERE sr.user_id = auth.uid() AND sr.role IN ('admin', 'doctor') AND sr.status = 'Active'
    )
  );

-- ── SYSTEM AUDIT LOGGING POLICIES ─────────────────────────────────
CREATE POLICY "auth users read audit_logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles sr
      WHERE sr.user_id = auth.uid() AND sr.role = 'admin' AND sr.status = 'Active'
    )
  );

CREATE POLICY "auth users insert_audit_logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── SERVICE ROLE ENGINE POLICIES ─────────────────────────────
CREATE POLICY "service_role full access - patients" ON patients TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - appointments" ON appointments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access - treatments" ON treatments TO service_role USING (true) WITH CHECK (true);
