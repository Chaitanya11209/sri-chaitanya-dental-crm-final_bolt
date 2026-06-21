-- ==============================================================================
-- SRI CHAITANYA DENTAL CRM — ROBUST RLS POLICIES & STRUCTURAL INTEGRITY
-- ==============================================================================

-- 1. Ensure the 'status', 'updated_at', and 'last_login' columns exist on staff_roles to avoid column mismatch errors.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'staff_roles' 
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.staff_roles ADD COLUMN status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'staff_roles' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.staff_roles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'staff_roles' 
      AND column_name = 'last_login'
  ) THEN
    ALTER TABLE public.staff_roles ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- 2. Drop existing restrictive RLS policies for staff_roles
DROP POLICY IF EXISTS "auth users insert staff_roles" ON public.staff_roles;
DROP POLICY IF EXISTS "auth users update staff_roles" ON public.staff_roles;
DROP POLICY IF EXISTS "auth users read staff_roles" ON public.staff_roles;

-- 3. Re-create robust policies for staff_roles
-- Read: Active authenticated users can read staff listings
CREATE POLICY "auth users read staff_roles"
  ON public.staff_roles FOR SELECT TO authenticated
  USING (true);

-- Insert: Allow admins and doctors to insert new staff profiles (or if there are no staff yet, e.g. bootstrapping)
CREATE POLICY "auth users insert staff_roles"
  ON public.staff_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_roles sr
      WHERE sr.user_id = auth.uid() 
        AND sr.role IN ('admin', 'doctor') 
        AND sr.status = 'Active'
    )
    OR NOT EXISTS (SELECT 1 FROM public.staff_roles)
  );

-- Update: Allow admins and doctors to modify staff listings
CREATE POLICY "auth users update staff_roles"
  ON public.staff_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles sr
      WHERE sr.user_id = auth.uid() 
        AND sr.role IN ('admin', 'doctor') 
        AND sr.status = 'Active'
    )
  );

-- 4. Drop and widen patients policies to support all system roles (doctor, receptionist, assistant, staff, admin)
DROP POLICY IF EXISTS "authenticated select - patients" ON public.patients;
DROP POLICY IF EXISTS "authenticated insert - patients" ON public.patients;
DROP POLICY IF EXISTS "authenticated update - patients" ON public.patients;

CREATE POLICY "authenticated select - patients" ON public.patients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
    )
  );

CREATE POLICY "authenticated insert - patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
    )
  );

CREATE POLICY "authenticated update - patients" ON public.patients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_roles
      WHERE staff_roles.user_id = auth.uid()
        AND staff_roles.status = 'Active'
    )
  );
