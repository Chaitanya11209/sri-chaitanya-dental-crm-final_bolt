-- ============================================================
-- SRI CHAITANYA DENTAL CRM — WIDEN STAFF ROLES CHECK CONSTRAINT
-- ============================================================

DO $$ 
BEGIN
  -- 1. Drop existing role check constraint if it exists (handles both system auto-generated and explicit names)
  ALTER TABLE public.staff_roles DROP CONSTRAINT IF EXISTS staff_roles_role_check;
  
  -- 2. Add the complete, widened check constraint to accept doctors and other staff subroles
  ALTER TABLE public.staff_roles ADD CONSTRAINT staff_roles_role_check CHECK (role IN ('admin', 'doctor', 'receptionist', 'assistant', 'staff'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not recreate staff_roles_role_check constraint: %', SQLERRM;
END $$;
