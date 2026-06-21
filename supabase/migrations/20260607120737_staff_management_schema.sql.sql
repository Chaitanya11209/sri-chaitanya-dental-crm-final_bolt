-- Extend staff_roles table with additional columns
ALTER TABLE staff_roles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- Create audit_logs table for tracking staff management actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_name text,
  performed_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name text,
  details text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_roles_status ON staff_roles(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Update RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "auth users read audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "auth users insert audit_logs" ON audit_logs;

-- Audit logs: admins can read all, authenticated users can insert
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