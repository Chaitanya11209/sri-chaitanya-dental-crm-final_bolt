import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { isAdmin, getRole } from '../../lib/auth';
import { useNotification } from '../../components/NotificationProvider';
import { 
  Users, Plus, Search, X, Loader2, Phone, Mail, 
  MapPin, CheckCircle2, AlertCircle, RefreshCw, Edit, Ban, CheckCircle, Award, HeartPulse 
} from 'lucide-react';

const FALLBACK_DOCTORS = [
  {
    id: 1,
    name: 'Dr. Bhavani',
    qualification: 'BDS, MDS',
    specialization: 'Chief Implantologist & Prosthodontist',
    phone: '+91 8317575165',
    email: 'chaitubolla09@gmail.com',
    status: 'Active'
  },
  {
    id: 2,
    name: 'Dr. A. K. Verma',
    qualification: 'BDS',
    specialization: 'General Dental Surgeon',
    phone: '+91 9988776655',
    email: 'verma.dental@gmail.com',
    status: 'Active'
  }
];

export default function Doctors() {
  const admin = isAdmin();
  const role = getRole();
  const { notify } = useNotification();
  const [doctors, setDoctors] = useState<any[]>([]);

  // Console tracing for Staff/Admin visibility audit
  console.log('[DOCTOR AUDIT] Current Role:', role);
  console.log('[DOCTOR AUDIT] Doctors List Length:', doctors.length);
  console.log('[DOCTOR AUDIT] Doctors Array Data:', doctors);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    qualification: '',
    specialization: '',
    phone: '',
    email: '',
    status: 'Active'
  });

  const [usingFallbacks, setUsingFallbacks] = useState(false);

  useEffect(() => {
    fetchDoctors();

    // Setup real-time updates for doctors
    const channel = supabase
      .channel('doctors-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors' },
        () => {
          fetchDoctors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        // Safe sandbox access
        const stored = localStorage.getItem('sandbox_doctors');
        if (stored) {
          setDoctors(JSON.parse(stored));
        } else {
          setDoctors(FALLBACK_DOCTORS);
          localStorage.setItem('sandbox_doctors', JSON.stringify(FALLBACK_DOCTORS));
        }
        setUsingFallbacks(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setDoctors(data);
        setUsingFallbacks(false);
      } else {
        setDoctors(FALLBACK_DOCTORS);
        setUsingFallbacks(true);
      }
    } catch (err: any) {
      console.warn('Doctors table fetch error (table may not exist yet). Utilizing safe fallbacks.');
      const stored = localStorage.getItem('sandbox_doctors');
      if (stored) {
        setDoctors(JSON.parse(stored));
      } else {
        setDoctors(FALLBACK_DOCTORS);
      }
      setUsingFallbacks(true);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingDoctor(null);
    setForm({
      name: '',
      qualification: '',
      specialization: '',
      phone: '',
      email: '',
      status: 'Active'
    });
    setShowModal(true);
  };

  const openEditModal = (doctor: any) => {
    setEditingDoctor(doctor);
    setForm({
      name: doctor.name || '',
      qualification: doctor.qualification || '',
      specialization: doctor.specialization || '',
      phone: doctor.phone || '',
      email: doctor.email || '',
      status: doctor.status || 'Active'
    });
    setShowModal(true);
  };

  const toggleDoctorStatus = async (doctor: any) => {
    if (!admin) {
      notify('error', 'Unauthorized Access', 'Only administrators can enable or disable medical practitioners.');
      return;
    }

    const newStatus = doctor.status === 'Active' ? 'Inactive' : 'Active';
    
    if (usingFallbacks || !isSupabaseConfigured) {
      const idx = doctors.findIndex(d => d.id === doctor.id);
      if (idx !== -1) {
        const updated = [...doctors];
        updated[idx] = { ...updated[idx], status: newStatus };
        setDoctors(updated);
        localStorage.setItem('sandbox_doctors', JSON.stringify(updated));
        notify('success', 'Status Switched', `Practitioner updated to ${newStatus} locally (Sandbox)`);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('doctors')
        .update({ status: newStatus })
        .eq('id', doctor.id);

      if (error) throw error;
      notify('success', 'Status Updated', `Successfully set doctor status to ${newStatus}`);
      fetchDoctors();
    } catch (err: any) {
      notify('error', 'Update Error', err.message || 'Failed to update practitioner status.');
    }
  };

  const saveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify('error', 'Validation Error', 'Doctor name is required.');
      return;
    }

    setSaving(true);
    
    if (usingFallbacks || !isSupabaseConfigured) {
      // Manage locally during offline sandbox
      let updatedList = [];
      if (editingDoctor) {
        updatedList = doctors.map(d => d.id === editingDoctor.id ? { ...d, ...form } : d);
        setDoctors(updatedList);
        notify('success', 'Doctor Modified', 'Details updated successfully in sandbox mode.');
      } else {
        const newDoc = {
          id: doctors.length > 0 ? Math.max(...doctors.map(d => d.id)) + 1 : 1,
          ...form
        };
        updatedList = [...doctors, newDoc];
        setDoctors(updatedList);
        notify('success', 'Doctor Registered', 'Prerecord created successfully in sandbox mode.');
      }
      localStorage.setItem('sandbox_doctors', JSON.stringify(updatedList));
      setShowModal(false);
      setSaving(false);
      return;
    }

    try {
      if (editingDoctor) {
        const { error } = await supabase
          .from('doctors')
          .update(form)
          .eq('id', editingDoctor.id);

        if (error) throw error;
        notify('success', 'Record Saved', `Successfully updated profile of Dr. ${form.name}`);
      } else {
        const { error } = await supabase
          .from('doctors')
          .insert([form]);

        if (error) throw error;
        notify('success', 'Doctor Added', `Successfully onboarded Dr. ${form.name}`);
      }
      setShowModal(false);
      fetchDoctors();
    } catch (err: any) {
      notify('error', 'Execution Error', err.message || 'Operation failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredDoctors = doctors.filter(doc => {
    const s = search.toLowerCase();
    const matchesSearch = 
      !search || 
      doc.name?.toLowerCase().includes(s) || 
      doc.specialization?.toLowerCase().includes(s) || 
      doc.qualification?.toLowerCase().includes(s) || 
      doc.phone?.includes(s);
    
    const matchesStatus = statusFilter === 'All' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <HeartPulse className="text-teal-500" size={26} /> 
            Doctor Management Module
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Register and manage specialist rosters, active consulting hours, and dental practitioners.
          </p>
        </div>
        {admin && (
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-teal-600 border border-teal-505 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus size={15} /> Add Dental Doctor
          </button>
        )}
      </div>

      {/* Migration warning if table doesn't exist */}
      {usingFallbacks && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Database Migration Pending (Run Schema SQL)</p>
            <p className="text-[11px] mt-0.5 text-amber-700">
              The 'doctors' table is not present in your active Supabase project. We have booted this module in a secure local memory sandbox to verify styling and layout. Copy and run the generated migration script <strong>/supabase/migrations/..._doctors_module.sql</strong> in your Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by practitioner name, specialty, credential, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Filter Status:</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {['All', 'Active', 'Inactive'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === st 
                    ? 'bg-slate-800 text-white' 
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchDoctors}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition"
            title="Reload Records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && doctors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-teal-600 mb-2" size={32} />
          <p className="text-slate-400 text-xs font-semibold">Retrieving dental practitioners...</p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center border-dashed">
          <Users className="mx-auto text-slate-300 mb-3" size={40} />
          <h3 className="font-extrabold text-slate-800 text-sm">No Dental Practitioners Found</h3>
          <p className="text-slate-400 text-[11px] mt-1 max-w-md mx-auto">
            Try adjusting your search keywords, clearing filters, or adding a new specialist doctor profiles to Sri Chaitanya's dental practice registry.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDoctors.map((doc) => (
            <div 
              key={doc.id}
              className={`bg-white border rounded-2xl p-5 relative transition duration-200 shadow-2xs hover:shadow-sm ${
                doc.status === 'Inactive' ? 'border-red-100/80 bg-red-50/10 opacity-75' : 'border-slate-105'
              }`}
            >
              {/* Badge */}
              <span className={`absolute top-4 right-4 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                doc.status === 'Active' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                {doc.status}
              </span>

              {/* Icon and Doctor Name */}
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 font-bold border border-teal-100 flex items-center justify-center flex-shrink-0 text-lg uppercase tracking-tight">
                  <Award size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm truncate">{doc.name}</h3>
                  <p className="text-teal-600 text-[11px] font-extrabold tracking-tight mt-0.5">{doc.qualification || 'Dental Surgeon'}</p>
                </div>
              </div>

              {/* Specs and details */}
              <div className="space-y-2 border-t border-slate-100 pt-3.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider w-20 flex-shrink-0">Specialty</span>
                  <p className="font-semibold text-slate-700 truncate">{doc.specialization || 'General Dentistry'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider w-20 flex-shrink-0">Contact</span>
                  <p className="font-medium text-slate-700 flex items-center gap-1">
                    <Phone size={11} className="text-slate-400" />
                    {doc.phone || 'No phone'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider w-20 flex-shrink-0">Email</span>
                  <p className="font-medium text-slate-600 truncate flex items-center gap-1" title={doc.email}>
                    <Mail size={11} className="text-slate-400 hover:text-slate-600" />
                    {doc.email || 'No email'}
                  </p>
                </div>
              </div>

              {/* Action layout */}
              {admin && (
                <div className="flex items-center gap-2 border-t border-slate-100 mt-4 pt-3.5 justify-end">
                  <button 
                    onClick={() => openEditModal(doc)}
                    className="p-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                    title="Edit profile details"
                  >
                    <Edit size={12} /> Edit
                  </button>
                  <button 
                    onClick={() => toggleDoctorStatus(doc)}
                    className={`p-1 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                      doc.status === 'Active'
                        ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title={doc.status === 'Active' ? 'Disable Doctor' : 'Activate Doctor'}
                  >
                    {doc.status === 'Active' ? (
                      <>
                        <Ban size={12} /> Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle size={12} /> Enable
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Roster Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in duration-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <h2 className="text-sm font-bold tracking-tight">
                {editingDoctor ? `Edit Profile — Dr. ${editingDoctor.name}` : 'Onboard New Dental Practitioners'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={saveDoctor} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Doctor Full Name *</label>
                <input 
                  type="text"
                  placeholder="e.g. Dr. Haritha Bolla"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Qualifications</label>
                  <input 
                    type="text"
                    placeholder="e.g. BDS, MDS"
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Roster Specialty</label>
                  <input 
                    type="text"
                    placeholder="e.g. Orthodontics, Endodontics"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Mobile Phone</label>
                  <input 
                    type="tel"
                    placeholder="e.g. +91 8317575165"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Clinic Email</label>
                  <input 
                    type="email"
                    placeholder="e.g. office@srichaitanya.co"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Practitioner Status</label>
                <select 
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:ring-1 focus:ring-teal-505 outline-none"
                >
                  <option value="Active">Active / On-Duty</option>
                  <option value="Inactive">Inactive / Suspended</option>
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-3.5 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-500 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 border border-teal-505 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save Specialist Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
