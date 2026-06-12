-- ============================================================
-- DYNAMIC PERMISSION MATRIX - Dental CRM
-- Allows admins to assign module access per user
-- ============================================================

-- Create modules table (defines all available CRM modules)
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT DEFAULT 'LayoutDashboard',
  category TEXT DEFAULT 'staff' CHECK (category IN ('staff', 'admin')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_permissions table (junction table - which modules each user can access)
CREATE TABLE IF NOT EXISTS user_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_id TEXT REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Insert default modules
INSERT INTO modules (id, name, path, icon, category, sort_order) VALUES
  ('dashboard', 'Dashboard', '/crm/dashboard', 'LayoutDashboard', 'staff', 1),
  ('patients', 'Patients', '/crm/patients', 'Users', 'staff', 2),
  ('appointments', 'Appointments', '/crm/appointments', 'CalendarPlus', 'staff', 3),
  ('treatments', 'Treatments', '/crm/treatments', 'Stethoscope', 'staff', 4),
  ('doctors', 'Doctors', '/crm/doctors', 'HeartPulse', 'staff', 5),
  ('followups', 'Follow-ups', '/crm/followups', 'Bell', 'staff', 6),
  ('billing', 'Billing & Invoices', '/crm/billing', 'FileText', 'admin', 7),
  ('reports', 'Reports & Analytics', '/crm/reports', 'TrendingUp', 'admin', 8),
  ('collections', 'Collections', '/crm/collections', 'DollarSign', 'admin', 9),
  ('users', 'Users & Permissions', '/crm/users', 'UserCog', 'admin', 10),
  ('export', 'Backup & Export', '/crm/export', 'FolderDown', 'admin', 11),
  ('settings', 'Settings', '/crm/settings', 'Settings', 'admin', 12)
ON CONFLICT (id) DO NOTHING;

-- Add permissions column to staff_roles for backward compatibility
ALTER TABLE staff_roles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Create function to check user has module access
CREATE OR REPLACE FUNCTION user_has_module_access(
  p_user_id UUID,
  p_module_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
  v_role TEXT;
BEGIN
  -- Check if user has explicit permission
  SELECT EXISTS(
    SELECT 1 FROM user_permissions
    WHERE user_id = p_user_id
    AND module_id = p_module_id
    AND can_view = true
  ) INTO v_has_permission;
  
  IF v_has_permission THEN
    RETURN true;
  END IF;
  
  -- Check if user is admin (has all access)
  SELECT role INTO v_role FROM staff_roles WHERE user_id = p_user_id;
  IF v_role = 'admin' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module_id ON user_permissions(module_id);

-- Grant permissions to existing admin users for all modules
INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_delete)
SELECT 
  sr.user_id,
  m.id,
  true,
  true,
  true
FROM staff_roles sr
CROSS JOIN modules m
WHERE sr.role = 'admin'
ON CONFLICT (user_id, module_id) DO NOTHING;

-- Default permissions for new non-admin users (staff-level modules only)
INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_delete)
SELECT 
  sr.user_id,
  m.id,
  true,
  CASE WHEN m.id IN ('patients', 'appointments', 'followups') THEN true ELSE false END,
  false
FROM staff_roles sr
CROSS JOIN modules m
WHERE sr.role != 'admin'
AND m.category = 'staff'
ON CONFLICT (user_id, module_id) DO NOTHING;