import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../components/NotificationProvider';
import { getCurrentUser } from '../../lib/auth';
import {
  Shield, UserCog, Check, X, Loader2, Search, ChevronRight,
  Lock, Unlock, Eye, Edit, Trash2, Save, RefreshCw
} from 'lucide-react';

interface Module {
  id: string;
  name: string;
  path: string;
  icon: string;
  category: string;
  sort_order: number;
}

interface StaffMember {
  user_id: string;
  name: string;
  role: string;
  status: string;
  email?: string;
  permissions?: UserPermission[];
}

interface UserPermission {
  user_id: string;
  module_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  'LayoutDashboard': <Shield size={16} />,
  'Users': <UserCog size={16} />,
  'CalendarPlus': <Shield size={16} />,
  'Stethoscope': <Shield size={16} />,
  'HeartPulse': <Shield size={16} />,
  'Bell': <Shield size={16} />,
  'FileText': <Shield size={16} />,
  'TrendingUp': <Shield size={16} />,
  'DollarSign': <Shield size={16} />,
  'FolderDown': <Shield size={16} />,
  'Settings': <Shield size={16} />,
};

export default function Permissions() {
  const { notify } = useNotification();
  const currentUser = getCurrentUser();
  const [modules, setModules] = useState<Module[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, { can_view: boolean; can_edit: boolean; can_delete: boolean }>>({});

  useEffect(() => {
    fetchModules();
    fetchStaff();
  }, []);

  const fetchModules = async () => {
    const { data } = await supabase
      .from('modules')
      .select('*')
      .order('sort_order');
    setModules(data || []);
  };

  const fetchStaff = async () => {
    setLoading(true);

    // Get staff roles
    const { data: staffData } = await supabase
      .from('staff_roles')
      .select('*')
      .order('name');

    // Get all permissions
    const { data: permissionsData } = await supabase
      .from('user_permissions')
      .select('*');

    // Group permissions by user
    const permissionsByUser: Record<string, UserPermission[]> = {};
    (permissionsData || []).forEach((p: UserPermission) => {
      if (!permissionsByUser[p.user_id]) {
        permissionsByUser[p.user_id] = [];
      }
      permissionsByUser[p.user_id].push(p);
    });

    // Merge staff with permissions
    const enrichedStaff = (staffData || []).map((s: any) => ({
      ...s,
      permissions: permissionsByUser[s.user_id] || []
    }));

    setStaff(enrichedStaff);
    setLoading(false);
  };

  const openPermissionEditor = (staffMember: StaffMember) => {
    setSelectedUser(staffMember);

    // Build permissions map from existing permissions
    const permMap: Record<string, { can_view: boolean; can_edit: boolean; can_delete: boolean }> = {};

    // Initialize all modules as no access
    modules.forEach(m => {
      permMap[m.id] = { can_view: false, can_edit: false, can_delete: false };
    });

    // Override with existing permissions
    (staffMember.permissions || []).forEach((p: UserPermission) => {
      permMap[p.module_id] = {
        can_view: p.can_view,
        can_edit: p.can_edit,
        can_delete: p.can_delete
      };
    });

    // Admin has all permissions by default
    if (staffMember.role === 'admin') {
      modules.forEach(m => {
        permMap[m.id] = { can_view: true, can_edit: true, can_delete: true };
      });
    }

    setUserPermissions(permMap);
  };

  const togglePermission = (moduleId: string, type: 'can_view' | 'can_edit' | 'can_delete') => {
    if (!selectedUser || selectedUser.role === 'admin') return;

    setUserPermissions(prev => {
      const updated = { ...prev };
      if (updated[moduleId]) {
        updated[moduleId][type] = !updated[moduleId][type];

        // If view is turned off, turn off edit and delete
        if (type === 'can_view' && !updated[moduleId].can_view) {
          updated[moduleId].can_edit = false;
          updated[moduleId].can_delete = false;
        }

        // If edit is turned on, ensure view is on
        if (type === 'can_edit' && updated[moduleId].can_edit) {
          updated[moduleId].can_view = true;
        }

        // If delete is turned on, ensure view is on
        if (type === 'can_delete' && updated[moduleId].can_delete) {
          updated[moduleId].can_view = true;
        }
      }
      return updated;
    });
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);

    try {
      // Delete existing permissions for this user
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.user_id);

      // Insert new permissions
      const permissionsToInsert = Object.entries(userPermissions)
        .filter(([_, perms]) => perms.can_view || perms.can_edit || perms.can_delete)
        .map(([moduleId, perms]) => ({
          user_id: selectedUser.user_id,
          module_id: moduleId,
          can_view: perms.can_view,
          can_edit: perms.can_edit,
          can_delete: perms.can_delete,
          granted_by: currentUser?.id
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      notify('success', 'Permissions Updated', `Module access updated for ${selectedUser.name}`);

      // Log audit
      await supabase.from('audit_logs').insert([{
        action: 'PERMISSIONS_UPDATED',
        target_user_id: selectedUser.user_id,
        target_user_name: selectedUser.name,
        performed_by_name: currentUser?.name,
        details: `Updated module permissions`
      }]);

      await fetchStaff();
      setSelectedUser(null);
    } catch (err: any) {
      notify('error', 'Update Failed', err.message);
    }

    setSaving(false);
  };

  const grantAllStaffAccess = async (staffMember: StaffMember) => {
    // Grant view access to all staff modules
    const staffModules = modules.filter(m => m.category === 'staff');
    const permissionsToGrant = staffModules.map(m => ({
      user_id: staffMember.user_id,
      module_id: m.id,
      can_view: true,
      can_edit: false,
      can_delete: false,
      granted_by: currentUser?.id
    }));

    // Delete existing and insert new
    await supabase.from('user_permissions').delete().eq('user_id', staffMember.user_id);
    await supabase.from('user_permissions').insert(permissionsToGrant);

    notify('success', 'Staff Access Granted', `${staffMember.name} now has access to all staff modules`);
    await fetchStaff();
  };

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="text-teal-600" size={28} />
            Module Permissions
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Control which CRM modules each staff member can access
          </p>
        </div>
        <button
          onClick={fetchStaff}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search staff by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-teal-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Staff List */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-800">Staff Members</h2>
              <p className="text-xs text-slate-500 mt-0.5">Select a user to manage permissions</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredStaff.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No staff members found
                </div>
              ) : (
                filteredStaff.map((s) => (
                  <button
                    key={s.user_id}
                    onClick={() => openPermissionEditor(s)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition text-left ${
                      selectedUser?.user_id === s.user_id ? 'bg-teal-50 border-l-4 border-teal-500' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      s.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                      s.role === 'doctor' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      <UserCog size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {s.role.charAt(0).toUpperCase() + s.role.slice(1)}
                        {s.role === 'admin' && ' (Full Access)'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Permission Editor */}
          <div className="lg:col-span-2">
            {selectedUser ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-800">
                      {selectedUser.name}'s Module Access
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedUser.role === 'admin'
                        ? 'Administrators have full access to all modules'
                        : 'Toggle module access permissions below'}
                    </p>
                  </div>
                  {selectedUser.role !== 'admin' && (
                    <button
                      onClick={() => grantAllStaffAccess(selectedUser)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                      Grant Staff Access
                    </button>
                  )}
                </div>

                {selectedUser.role === 'admin' ? (
                  <div className="p-8 text-center">
                    <Lock className="mx-auto text-teal-600 mb-3" size={48} />
                    <h3 className="font-bold text-slate-800 mb-2">Administrator Account</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      Administrators have unrestricted access to all CRM modules.
                      To restrict access, change their role first.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100">
                      {/* Staff Modules */}
                      <div className="p-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                          Staff Workspace
                        </h3>
                        <div className="space-y-3">
                          {modules.filter(m => m.category === 'staff').map((module) => (
                            <div
                              key={module.id}
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                                  {MODULE_ICONS[module.icon] || <Shield size={16} />}
                                </div>
                                <span className="font-medium text-slate-800 text-sm">{module.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => togglePermission(module.id, 'can_view')}
                                  className={`p-1.5 rounded transition ${
                                    userPermissions[module.id]?.can_view
                                      ? 'bg-teal-100 text-teal-700'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}
                                  title="View Access"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => togglePermission(module.id, 'can_edit')}
                                  className={`p-1.5 rounded transition ${
                                    userPermissions[module.id]?.can_edit
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}
                                  title="Edit Access"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => togglePermission(module.id, 'can_delete')}
                                  className={`p-1.5 rounded transition ${
                                    userPermissions[module.id]?.can_delete
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}
                                  title="Delete Access"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Admin Modules */}
                      <div className="p-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                          Administrative Tools
                        </h3>
                        <div className="space-y-3">
                          {modules.filter(m => m.category === 'admin').map((module) => (
                            <div
                              key={module.id}
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                                  {MODULE_ICONS[module.icon] || <Shield size={16} />}
                                </div>
                                <span className="font-medium text-slate-800 text-sm">{module.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => togglePermission(module.id, 'can_view')}
                                  className={`p-1.5 rounded transition ${
                                    userPermissions[module.id]?.can_view
                                      ? 'bg-teal-100 text-teal-700'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}
                                  title="View Access"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => togglePermission(module.id, 'can_edit')}
                                  className={`p-1.5 rounded transition ${
                                    userPermissions[module.id]?.can_edit
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}
                                  title="Edit Access"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => togglePermission(module.id, 'can_delete')}
                                  className={`p-1.5 rounded transition ${
                                    userPermissions[module.id]?.can_delete
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-slate-200 text-slate-400'
                                  }`}
                                  title="Delete Access"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium text-sm hover:bg-white transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={savePermissions}
                        disabled={saving}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Permissions
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <Shield className="mx-auto text-slate-300 mb-4" size={48} />
                <h3 className="font-bold text-slate-800 mb-2">Select a Staff Member</h3>
                <p className="text-sm text-slate-500">
                  Choose a staff member from the list to view and edit their module permissions
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
