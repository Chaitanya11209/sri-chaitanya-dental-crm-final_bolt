-- ============================================================
-- CRITICAL SECURITY FIX - Apply to existing database
-- ============================================================

-- STEP 1: Fix staff_roles role check constraint
ALTER TABLE staff_roles DROP CONSTRAINT IF EXISTS staff_roles_role_check;
ALTER TABLE staff_roles ADD CONSTRAINT staff_roles_role_check 
  CHECK (role IN ('admin', 'doctor', 'receptionist', 'assistant', 'staff'));

-- STEP 2: DROP ALL DANGEROUS ANON POLICES
DROP POLICY IF EXISTS "anon full access - patients" ON patients;
DROP POLICY IF EXISTS "anon full access - appointments" ON appointments;
DROP POLICY IF EXISTS "anon full access - treatments" ON treatments;
DROP POLICY IF EXISTS "anon full access - doctors" ON doctors;

-- STEP 3: Create secure anon policies
-- Anon can ONLY INSERT appointments (for public booking)
CREATE POLICY "anon_insert_appointments_only"
  ON appointments FOR INSERT TO anon WITH CHECK (true);

-- Anon can read active doctors for public display
CREATE POLICY "anon_read_doctors_public"
  ON doctors FOR SELECT TO anon USING (status = 'Active');

-- STEP 4: Fix authenticated policies to allow all valid roles
DROP POLICY IF EXISTS "authenticated select - patients" ON patients;
DROP POLICY IF EXISTS "authenticated insert - patients" ON patients;
DROP POLICY IF EXISTS "authenticated update - patients" ON patients;
DROP POLICY IF EXISTS "authenticated delete - patients" ON patients;

DROP POLICY IF EXISTS "authenticated select - appointments" ON appointments;
DROP POLICY IF EXISTS "authenticated insert - appointments" ON appointments;
DROP POLICY IF EXISTS "authenticated update - appointments" ON appointments;
DROP POLICY IF EXISTS "authenticated delete - appointments" ON appointments;

DROP POLICY IF EXISTS "authenticated select - treatments" ON treatments;
DROP POLICY IF EXISTS "authenticated insert - treatments" ON treatments;
DROP POLICY IF EXISTS "authenticated update - treatments" ON treatments;
DROP POLICY IF EXISTS "authenticated delete - treatments" ON treatments;

-- STEP 5: Create simplified authenticated full access policies
CREATE POLICY "authenticated_patients_full"
  ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_appointments_full"
  ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_treatments_full"
  ON treatments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_doctors_full"
  ON doctors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STEP 6: Fix staff_roles policies
DROP POLICY IF EXISTS "auth users read staff_roles" ON staff_roles;

-- Users can read their own role
CREATE POLICY "staff_roles_read_own"
  ON staff_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all staff_roles
CREATE POLICY "staff_roles_admin_read_all"
  ON staff_roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles sr
      WHERE sr.user_id = auth.uid() 
      AND sr.role = 'admin' 
      AND (sr.status = 'Active' OR sr.status IS NULL)
    )
  );