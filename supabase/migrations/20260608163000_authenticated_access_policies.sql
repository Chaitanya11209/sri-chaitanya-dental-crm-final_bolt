-- ============================================================
-- Add policies to allow authenticated CRM staff/admins full access
-- ============================================================

-- 1. Patients Policies
DROP POLICY IF EXISTS "authenticated full access - patients" ON patients;
CREATE POLICY "authenticated full access - patients"
  ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Appointments Policies
DROP POLICY IF EXISTS "authenticated full access - appointments" ON appointments;
CREATE POLICY "authenticated full access - appointments"
  ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Treatments Policies
DROP POLICY IF EXISTS "authenticated full access - treatments" ON treatments;
CREATE POLICY "authenticated full access - treatments"
  ON treatments FOR ALL TO authenticated USING (true) WITH CHECK (true);
