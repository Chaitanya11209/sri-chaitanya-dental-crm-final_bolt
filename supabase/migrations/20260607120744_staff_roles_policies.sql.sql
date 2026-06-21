-- Add policies for staff_roles insert/update by admins only
DROP POLICY IF EXISTS "auth users insert staff_roles" ON staff_roles;
DROP POLICY IF EXISTS "auth users update staff_roles" ON staff_roles;

CREATE POLICY "auth users insert staff_roles"
  ON staff_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_roles sr
      WHERE sr.user_id = auth.uid() AND sr.role = 'admin' AND sr.status = 'Active'
    )
    OR NOT EXISTS (SELECT 1 FROM staff_roles)
  );

CREATE POLICY "auth users update staff_roles"
  ON staff_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_roles sr
      WHERE sr.user_id = auth.uid() AND sr.role = 'admin' AND sr.status = 'Active'
    )
  );