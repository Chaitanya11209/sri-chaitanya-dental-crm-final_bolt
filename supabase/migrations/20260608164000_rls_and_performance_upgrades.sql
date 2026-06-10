-- ==============================================================================
-- Schema Performance & Integrity Enhancements + Patients RLS Security Upgrades
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- Part 1: Row Level Security (RLS) Upgrades on 'patients' Table
-- We ensure that only active authenticated staff/admins can perform operations.
-- ──────────────────────────────────────────────────────────────────────────────

-- Disable broad "full access" policy for authenticated users first
DROP POLICY IF EXISTS "authenticated full access - patients" ON patients;

-- Drop any individual old ones to avoid collisions
DROP POLICY IF EXISTS "authenticated select - patients" ON patients;
DROP POLICY IF EXISTS "authenticated insert - patients" ON patients;
DROP POLICY IF EXISTS "authenticated update - patients" ON patients;
DROP POLICY IF EXISTS "authenticated delete - patients" ON patients;

-- Read Access: Allow authenticated users who have an Active profile inside 'staff_roles' to SELECT patients
CREATE POLICY "authenticated select - patients" ON patients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
        AND staff_roles.role IN ('admin', 'staff')
    )
  );

-- Create Access: Allow authenticated users who have an Active profile inside 'staff_roles' to INSERT patients
CREATE POLICY "authenticated insert - patients" ON patients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
        AND staff_roles.role IN ('admin', 'staff')
    )
  );

-- Update Access: Allow authenticated users who have an Active profile inside 'staff_roles' to UPDATE patients
CREATE POLICY "authenticated update - patients" ON patients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
        AND staff_roles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
        AND staff_roles.role IN ('admin', 'staff')
    )
  );

-- Delete Access: Enforce that only 'admin' role can delete patient records
CREATE POLICY "authenticated delete - patients" ON patients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.role = 'admin'
        AND staff_roles.status = 'Active'
    )
  );


-- ──────────────────────────────────────────────────────────────────────────────
-- Part 2: Row Level Security (RLS) for 'appointments' and 'treatments' for robust roles
-- Let's also bring consistency to other CRM tables based on 'staff_roles'.
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop generic policies
DROP POLICY IF EXISTS "authenticated full access - appointments" ON appointments;
DROP POLICY IF EXISTS "authenticated full access - treatments" ON treatments;

DROP POLICY IF EXISTS "authenticated select - appointments" ON appointments;
DROP POLICY IF EXISTS "authenticated insert - appointments" ON appointments;
DROP POLICY IF EXISTS "authenticated update - appointments" ON appointments;
DROP POLICY IF EXISTS "authenticated delete - appointments" ON appointments;

DROP POLICY IF EXISTS "authenticated select - treatments" ON treatments;
DROP POLICY IF EXISTS "authenticated insert - treatments" ON treatments;
DROP POLICY IF EXISTS "authenticated update - treatments" ON treatments;
DROP POLICY IF EXISTS "authenticated delete - treatments" ON treatments;

-- RLS policies for appointments
CREATE POLICY "authenticated select - appointments" ON appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'));

CREATE POLICY "authenticated insert - appointments" ON appointments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'));

CREATE POLICY "authenticated update - appointments" ON appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'));

CREATE POLICY "authenticated delete - appointments" ON appointments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role = 'admin' AND staff_roles.status = 'Active'));

-- RLS policies for treatments
CREATE POLICY "authenticated select - treatments" ON treatments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'));

CREATE POLICY "authenticated insert - treatments" ON treatments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'));

CREATE POLICY "authenticated update - treatments" ON treatments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.status = 'Active'));

CREATE POLICY "authenticated delete - treatments" ON treatments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE staff_roles.user_id = auth.uid() AND staff_roles.role = 'admin' AND staff_roles.status = 'Active'));


-- ──────────────────────────────────────────────────────────────────────────────
-- Part 3: Indexing Optmizations & Integrity Safeguards (Billing & Performance)
-- ──────────────────────────────────────────────────────────────────────────────

-- Index 1: Composite Filter Index for Date & Status (extremely frequent in due-lists, dashboards, and follow-ups)
CREATE INDEX IF NOT EXISTS idx_appointments_next_visit_status 
  ON appointments (next_visit, status);

-- Index 2: Chronological sorting of appointments/billing audits
CREATE INDEX IF NOT EXISTS idx_appointments_created_at_desc 
  ON appointments (created_at DESC);

-- Index 3: Accelerating payments/billing calculations and revenue charts
CREATE INDEX IF NOT EXISTS idx_appointments_payment_mode 
  ON appointments (payment_mode) 
  WHERE status != 'Deleted';

-- Index 4: Composite Query Index for historic files loading/timeline filters
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id_created_at 
  ON appointments (patient_id, created_at DESC);

-- Index 5: Chronological sort index for treatment progress records
CREATE INDEX IF NOT EXISTS idx_treatments_created_at_desc 
  ON treatments (created_at DESC);

-- Index 6: Composite Query Index for loader matching patient profile to treatments list
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id_created_at_desc 
  ON treatments (patient_id, created_at DESC);
