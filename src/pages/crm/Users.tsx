import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase, signupClient } from '../../lib/supabase';
import { isAdmin, getCurrentUser, getRole } from '../../lib/auth';
import {
  Search, Plus, X, Shield, ShieldOff, UserCheck, UserX,
  KeyRound, Edit, History, Clock, Mail, ChevronRight,
  ShieldAlert, Users as UsersIcon, Activity
} from 'lucide-react';

interface StaffMember {
  id: number;
  user_id: string;
  name: string;
  role: 'admin' | 'doctor' | 'receptionist' | 'assistant' | 'staff';
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
  last_login: string | null;
  email?: string;
}

interface AuditLog {
  id: number;
  action: string;
  target_user_name: string;
  performed_by_name: string;
  details: string;
  created_at: string;
}

const ROLE_COLORS = {
  admin: 'bg-teal-100 text-teal-700 border-teal-200',
  doctor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  receptionist: 'bg-blue-100 text-blue-700 border-blue-200',
  assistant: 'bg-slate-100 text-slate-700 border-slate-200',
  staff: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_COLORS = {
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Inactive: 'bg-red-100 text-red-700 border-red-200',
};

export default function Users() {
  const [, setLocation] = useLocation();
  const admin = isAdmin();
  const hasAccess = admin || getRole() === 'doctor';
  const currentUser = getCurrentUser();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'receptionist' as 'admin' | 'doctor' | 'receptionist' | 'assistant' | 'staff' });
  const [editForm, setEditForm] = useState({ name: '', role: 'receptionist' as 'admin' | 'doctor' | 'receptionist' | 'assistant' | 'staff', status: 'Active' as 'Active' | 'Inactive' });
  const [saving, setSaving] = useState(false);

  // Redirect non-admins/non-doctors
  useEffect(() => {
    if (!hasAccess) {
      setLocation('/crm/dashboard');
    }
  }, [hasAccess, setLocation]);

  useEffect(() => {
    if (hasAccess) fetchStaff();
  }, [hasAccess]);

  const fetchStaff = async () => {
    setLoading(true);

    // Fetch staff_roles with user emails from auth
    const { data: staffData } = await supabase
      .from('staff_roles')
      .select('*')
      .order('created_at', { ascending: false });

    // Ensure all members have mapped defaults in case columns do not exist in some database environments
    const normalized = (staffData || []).map((s: any) => ({
      ...s,
      status: s.status ?? 'Active',
      updated_at: s.updated_at ?? s.created_at ?? new Date().toISOString(),
      last_login: s.last_login ?? null,
    }));

    // Get emails from auth users via admin API
    // Note: In production, this would need a Supabase admin client or edge function
    // For now, we'll display what we have and note that emails need to be fetched via edge function

    setStaff(normalized);
    setLoading(false);
  };

  const fetchAuditLogs = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setAuditLogs(data || []);
  };

  const logAction = async (action: string, targetUser: StaffMember | null, details: string) => {
    await supabase.from('audit_logs').insert([{
      action,
      target_user_id: targetUser?.user_id,
      target_user_name: targetUser?.name || '',
      performed_by_id: currentUser?.email,
      performed_by_name: currentUser?.name || 'Admin',
      details,
    }]);
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.name) return;

    // Convert plain usernames to non-routeable internal srichaitanya.local email to prevent mail delivery bounces
    const processedEmail = form.email.includes('@')
      ? form.email.trim()
      : `${form.email.trim().toLowerCase()}@srichaitanya.local`;

    setSaving(true);
    try {
      // Create user in Supabase Auth using signupClient (ignores local session persist, avoiding session hijack)
      const { data: authData, error: authError } = await signupClient.auth.signUp({
        email: processedEmail,
        password: form.password,
        options: {
          data: { name: form.name },
          emailRedirectTo: window.location.origin + '/admin',
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Create staff_roles entry
      let rolePayload: any = {
        user_id: authData.user.id,
        name: form.name,
        role: form.role,
        status: 'Active',
      };
      let { error: roleError } = await supabase
        .from('staff_roles')
        .insert([rolePayload]);

      if (roleError && (roleError.message?.includes('status') || roleError.code === '42703')) {
        // Retry without status
        const retryPayload = {
          user_id: authData.user.id,
          name: form.name,
          role: form.role,
        };
        const { error: retryError } = await supabase
          .from('staff_roles')
          .insert([retryPayload]);
        roleError = retryError;
      }

      // If check constraint on role fails in unmigrated database environments
      if (roleError && (roleError.message?.toLowerCase().includes('role') || roleError.message?.toLowerCase().includes('constraint') || roleError.code === '23514')) {
        const fallbackRole = form.role === 'admin' ? 'admin' : 'staff';
        const fallbackPayload: any = {
          user_id: authData.user.id,
          name: form.name,
          role: fallbackRole,
        };
        const { error: fallbackError } = await supabase
          .from('staff_roles')
          .insert([fallbackPayload]);
        roleError = fallbackError;
      }

      if (roleError) throw roleError;

      // Log the action
      const newStaff: StaffMember = {
        id: 0,
        user_id: authData.user.id,
        name: form.name,
        role: form.role,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login: null,
        email: processedEmail,
      };
      await logAction('User Created', newStaff, `Created ${form.role} account for ${form.name} (${processedEmail})`);

      setShowAddModal(false);
      setForm({ name: '', email: '', password: '', role: 'staff' });
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to create staff member');
    }
    setSaving(false);
  };

  const openEditModal = (s: StaffMember) => {
    setSelectedStaff(s);
    setEditForm({ name: s.name, role: s.role, status: s.status });
    setShowEditModal(true);
  };

  const updateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setSaving(true);
    try {
      let updatePayload: any = {
        name: editForm.name,
        role: editForm.role,
        status: editForm.status,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from('staff_roles')
        .update(updatePayload)
        .eq('user_id', selectedStaff.user_id);

      if (error && (error.message?.includes('status') || error.code === '42703')) {
        // Retry without status or updated_at
        const retryPayload = {
          name: editForm.name,
          role: editForm.role,
        };
        const { error: retryError } = await supabase
          .from('staff_roles')
          .update(retryPayload)
          .eq('user_id', selectedStaff.user_id);
        error = retryError;
      }

      // Fallback if role check constraint failed
      if (error && (error.message?.toLowerCase().includes('role') || error.message?.toLowerCase().includes('constraint') || error.code === '23514')) {
        const fallbackRole = editForm.role === 'admin' ? 'admin' : 'staff';
        const fallbackPayload = {
          name: editForm.name,
          role: fallbackRole,
        };
        const { error: fallbackError } = await supabase
          .from('staff_roles')
          .update(fallbackPayload)
          .eq('user_id', selectedStaff.user_id);
        error = fallbackError;
      }

      if (error) throw error;

      // Log the action
      const changes = [];
      if (editForm.name !== selectedStaff.name) changes.push('name changed');
      if (editForm.role !== selectedStaff.role) changes.push('role changed to ' + editForm.role);
      if (editForm.status !== selectedStaff.status) changes.push('status changed to ' + editForm.status);
      await logAction('User Updated', selectedStaff, `Updated: ${changes.join(', ')}`);

      setShowEditModal(false);
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to update staff member');
    }
    setSaving(false);
  };

  const toggleStatus = async (s: StaffMember) => {
    const newStatus = s.status === 'Active' ? 'Inactive' : 'Active';

    try {
      let { error } = await supabase
        .from('staff_roles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('user_id', s.user_id);

      if (error) {
        if (error.message?.includes('status') || error.code === '42703') {
          alert('This database schema does not support user status. Run migration or update schema first.');
          return;
        }
        throw error;
      }

      // Log the action
      await logAction(
        newStatus === 'Inactive' ? 'User Deactivated' : 'User Activated',
        s,
        `Status changed to ${newStatus}`
      );

      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const resetPassword = async (s: StaffMember) => {
    try {
      // Get the user's email - in production this would come from an edge function
      // For now we'll use Supabase's reset password for email
      const email = prompt('Enter the email address for this user:');
      if (!email) return;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/admin',
      });

      if (error) throw error;

      // Log the action
      await logAction('Password Reset', s, `Password reset email sent to ${email}`);

      alert('Password reset email sent!');
    } catch (err: any) {
      alert(err.message || 'Failed to send reset email');
    }
  };

  const openAuditModal = async () => {
    await fetchAuditLogs();
    setShowAuditModal(true);
  };

  const filteredStaff = staff.filter(s => {
    const searchLower = search.toLowerCase();
    return s.name.toLowerCase().includes(searchLower) ||
           s.role.toLowerCase().includes(searchLower) ||
           s.status.toLowerCase().includes(searchLower);
  });

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldOff size={32} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-700">Access Denied</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            Staff management is only accessible to Admin and Doctor users.
          </p>
        </div>
        <button onClick={() => setLocation('/crm/dashboard')} className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Supabase Transactional Email Safety / Username Instructions */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-4 sm:p-5 shadow-sm text-sm text-amber-900">
        <div className="flex gap-3">
          <div className="p-1 rounded-lg bg-amber-100 text-amber-700 h-fit">
            <ShieldAlert size={18} className="flex-shrink-0" />
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-amber-950 flex items-center gap-1.5 leading-snug">
              Stop Supabase Email Bounce Threats & Use Simple Usernames
            </h4>
            <p className="text-amber-800 leading-relaxed text-xs">
              To resolve the <strong>Supabase transactional email bounce warning</strong>, we have enabled support for logging in and creating staff using simple **Usernames or User IDs** (e.g. <code>doctor123</code> or <code>ankita</code>) instead of actual email addresses! This prevents Supabase from sending verification emails that bounce.
            </p>
            <div className="text-xs text-amber-900/90 pt-1 space-y-1">
              <p className="font-semibold text-amber-950">Action Required in Supabase Console:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-amber-800 ml-1">
                <li>Log in to your <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline font-bold text-teal-700 hover:text-teal-800" d-none="true">Supabase Dashboard</a>.</li>
                <li>Go to <strong>Authentication</strong> &rarr; <strong>Providers</strong> &rarr; <strong>Email</strong>.</li>
                <li>Toggle <strong>OFF</strong> the <code className="bg-amber-100/80 px-1 py-0.5 rounded text-amber-950 font-mono">Confirm email</code> setting.</li>
                <li>Toggle <strong>OFF</strong> the <code className="bg-amber-100/80 px-1 py-0.5 rounded text-amber-950 font-mono">Send welcome email</code> setting, then click <strong>Save</strong>.</li>
              </ol>
              <p className="text-[11px] italic mt-1.5 text-amber-700">
                With email confirmations and welcome emails disabled, Supabase will instantly activate newly created staff members without sending verification emails, completely eliminating any mail bounce or spam complaints.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, or status…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAuditModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
          >
            <History size={16} /> Audit Log
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition"
          >
            <Plus size={16} /> Add Staff
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
              <UsersIcon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{staff.length}</p>
              <p className="text-xs text-slate-500">Total Staff</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{staff.filter(s => s.status === 'Active').length}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{staff.filter(s => s.role === 'admin').length}</p>
              <p className="text-xs text-slate-500">Admins</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <UserX size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{staff.filter(s => s.status === 'Inactive').length}</p>
              <p className="text-xs text-slate-500">Inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No staff members found</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Name', 'Role', 'Status', 'Created', 'Last Login', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStaff.map(s => (
                    <tr key={s.user_id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            s.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                            s.role === 'doctor' ? 'bg-indigo-100 text-indigo-700' :
                            s.role === 'receptionist' ? 'bg-blue-100 text-blue-700' :
                            s.role === 'assistant' ? 'bg-slate-100 text-slate-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {s.name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-semibold border ${ROLE_COLORS[s.role] || 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                          {s.role === 'admin' ? <Shield size={11} /> : <UserCheck size={11} />}
                          {s.role.charAt(0).toUpperCase() + s.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-semibold border ${STATUS_COLORS[s.status]}`}>
                          {s.status === 'Active' ? <Activity size={11} /> : <UserX size={11} />}
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(s.last_login)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditModal(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-teal-600" title="Edit">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => toggleStatus(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-600" title={s.status === 'Active' ? 'Deactivate' : 'Activate'}>
                            {s.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button onClick={() => resetPassword(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600" title="Reset Password">
                            <KeyRound size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredStaff.map(s => (
                <div key={s.user_id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                        s.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                        s.role === 'doctor' ? 'bg-indigo-100 text-indigo-700' :
                        s.role === 'receptionist' ? 'bg-blue-100 text-blue-700' :
                        s.role === 'assistant' ? 'bg-slate-100 text-slate-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {s.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${ROLE_COLORS[s.role] || 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                            {s.role}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${STATUS_COLORS[s.status]}`}>
                            {s.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(s)} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => toggleStatus(s)} className="p-1.5 rounded-lg hover:bg-slate-100">
                        {s.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button onClick={() => resetPassword(s)} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <KeyRound size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    Created: {formatDate(s.created_at)} · Last Login: {formatDate(s.last_login)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Add New Staff Member</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={createStaff} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="John Doe"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Username or Email Address *</label>
                <input
                  type="text"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="e.g. john_doe or doctor_verma (no space)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Temporary Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="Min 6 characters"
                  minLength={6}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm(f => ({ ...f, role: e.target.value as any }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="doctor">Doctor</option>
                  <option value="assistant">Assistant</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Other Staff</option>
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {form.role === 'admin'
                    ? 'Admin users have full access to all features including billing, staff management, and financial reports.'
                    : form.role === 'doctor'
                    ? 'Doctors can write treatment reports, clinical records, and view schedules.'
                    : 'Staff, receptionists, and assistants can manage patients and schedules, but cannot access billing or user systems.'}
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition disabled:opacity-60 shadow-sm"
              >
                {saving ? 'Creating…' : 'Create Staff Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Edit Staff Member</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={updateStaff} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Full Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value as any }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="doctor">Doctor</option>
                  <option value="assistant">Assistant</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Other Staff</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {editForm.status === 'Inactive'
                    ? 'Inactive users cannot log in or access the CRM.'
                    : 'Active users can access the CRM based on their role permissions.'}
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition disabled:opacity-60 shadow-sm"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-slate-800">Audit Log</h3>
              <button onClick={() => setShowAuditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No audit logs yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          log.action.includes('Created') ? 'bg-emerald-100 text-emerald-600' :
                          log.action.includes('Deactivated') ? 'bg-red-100 text-red-600' :
                          log.action.includes('Password') ? 'bg-blue-100 text-blue-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          <Clock size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm">{log.action}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span>Target: {log.target_user_name}</span>
                            <span>By: {log.performed_by_name}</span>
                            <span>{formatDateTime(log.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
