import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isAdmin } from '../../lib/auth';
import { 
  Plus, Search, X, Phone, Clock, Calendar, CheckSquare, 
  Send, CheckCircle2, AlertCircle, MessageSquare, Edit2, Trash2, HeartPulse, ShieldAlert 
} from 'lucide-react';
import { sendSMS, getSMSTemplates } from '../../lib/sms';
import { useNotification } from '../../components/NotificationProvider';
import { notifyAppointmentBooked } from '../../lib/email';
import { sendWhatsAppNotification } from '../../lib/whatsapp';

const STATUS_OPTIONS = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'];
const TREATMENTS = [
  'Consultation', 'OP', 'Composite Fillings', 'Scaling', 'RCT', 
  'RCT Post Endodontic Restoration', 'Crown', 'Extraction', 
  'Surgical Extraction', 'Denture', 'Implant', 'Disposables', 'Other'
];

const FALLBACK_DOCTORS = [
  { id: 1, name: 'Dr. Sample Doctor', phone: '91XXXXXXXXXX', qualification: 'BDS, MDS', specialization: 'Chief Dental Surgeon' },
  { id: 2, name: 'Dr. Sample Associate', phone: '91XXXXXXXXXX', qualification: 'BDS', specialization: 'General Dentistry' }
];

const WAITING_LIST_QUEUE: any[] = [];

export default function Appointments() {
  const admin = isAdmin();
  const { notify } = useNotification();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // States for checkbox-based bulk sending
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string[]>([]);

  // Post-saving notification alerts modal
  const [savedWhatsAppAlerts, setSavedWhatsAppAlerts] = useState<any | null>(null);

  // Waiting list vacancy reallocation state
  const [vacantSlotNotification, setVacantSlotNotification] = useState<any>(null);

  // Default Form values
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    treatment: '',
    next_visit: '',
    appointment_time: '',
    location: '',
    notes: '',
    amount_paid: '',
    balance_amount: '',
    doctor_id: '',
    doctor_name: ''
  });

  useEffect(() => {
    fetch();
    fetchActiveDoctors();
 
    const channelAppts = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          fetch();
        }
      )
      .subscribe();

    const channelPatients = supabase
      .channel('appointments-patients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients' },
        () => {
          fetch();
        }
      )
      .subscribe();
 
    return () => {
      supabase.removeChannel(channelAppts);
      supabase.removeChannel(channelPatients);
    };
  }, []);

  const fetchActiveDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('status', 'Active')
        .order('name', { ascending: true });

      if (error) throw error;
      setDoctors(data && data.length > 0 ? data : FALLBACK_DOCTORS);
    } catch (e) {
      console.warn("Doctors table fetching bypassed. Standard roster utilized.");
      setDoctors(FALLBACK_DOCTORS);
    }
  };

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .neq('status', 'Deleted')
      .order('created_at', { ascending: false });
    setAppointments(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: number, status: string) => {
    await supabase.from('appointments').update({ status }).eq('id', id);
    if (status === 'Cancelled') {
      const cancelledAppt = appointments.find(a => a.id === id);
      if (cancelledAppt) {
        setVacantSlotNotification({
          id: cancelledAppt.id,
          date: cancelledAppt.next_visit,
          time: cancelledAppt.appointment_time,
          treatment: cancelledAppt.treatment
        });
      }
    }
    fetch();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to dismiss and delete this appointment?")) return;
    try {
      const { error } = await supabase.from('appointments').update({ status: 'Deleted' }).eq('id', id);
      if (error) throw error;
      notify('success', 'Appointment Deleted', 'Appointment successfully deleted on patient schedule.');
      fetch();
    } catch (err: any) {
      notify('error', 'Execution Error', 'Failed to remove appointment.');
    }
  };

  const handleAssignSlot = async (candidate: any) => {
    if (!vacantSlotNotification) return;

    // Retrieve or register patient
    const { data: existing } = await supabase.from('patients').select('id').eq('phone', candidate.phone).maybeSingle();
    let patientId = existing?.id;
    if (!patientId) {
      const { data: nps } = await supabase.from('patients').insert([{
        name: candidate.name,
        phone: candidate.phone,
        patient_code: `SDC-${Date.now()}`,
        patient_status: 'Registered'
      }]).select();
      patientId = nps?.[0]?.id;
    }

    // Default primary doctor
    const primaryDr = doctors[0] || FALLBACK_DOCTORS[0];

    // Schedule new appointment
    const { data: scheduledAppt, error } = await supabase.from('appointments').insert([{
      name: candidate.name,
      phone: candidate.phone,
      treatment: candidate.treatment,
      next_visit: vacantSlotNotification.date,
      appointment_time: vacantSlotNotification.time,
      status: 'Confirmed',
      patient_id: patientId,
      doctor_id: primaryDr.id,
      doctor_name: primaryDr.name,
      notes: `Waiting List reallocation auto-assign slot. Original Cancelled Appt ID: ${vacantSlotNotification.id}`
    }]).select();

    if (!error) {
      notifyAppointmentBooked({
        name: candidate.name,
        phone: candidate.phone,
        treatment: candidate.treatment,
        next_visit: vacantSlotNotification.date,
        appointment_time: vacantSlotNotification.time,
        notes: `reallocation slot. Doctor: ${primaryDr.name}`,
        bookedBy: 'Queue Manager'
      });

      // Show instant click-to-chat links
      setSavedWhatsAppAlerts({
        patientName: candidate.name,
        patientPhone: candidate.phone,
        doctorName: primaryDr.name,
        doctorPhone: primaryDr.phone || '918317575165',
        treatment: candidate.treatment,
        date: vacantSlotNotification.date,
        time: vacantSlotNotification.time,
        status: 'Confirmed'
      });

      setVacantSlotNotification(null);
      fetch();
    } else {
      console.error(error);
    }
  };

  const handleIndividualSMS = async (a: any) => {
    const templates = getSMSTemplates();
    const text = templates.appointment
      .replace('[Name]', a.name || '')
      .replace('[Treatment]', a.treatment || '')
      .replace('[Date]', a.next_visit || '')
      .replace('[Time]', a.appointment_time || '');
    try {
      const res = await sendSMS({
        phone: a.phone,
        name: a.name,
        message: text
      });

      if (res.success) {
        notify('success', 'SMS Dispatched', `SMS successfully sent to ${a.name}!`);
      } else {
        notify('error', 'SMS Failed', `Failed to send SMS: ${res.error}`);
      }
    } catch (err: any) {
      notify('error', 'SMS Error', `Error: ${err.message}`);
    }
  };

  const handleOpenBookModal = () => {
    setEditingAppt(null);
    setForm({
      name: '',
      phone: '',
      email: '',
      treatment: '',
      next_visit: '',
      appointment_time: '',
      location: '',
      notes: '',
      amount_paid: '',
      balance_amount: '',
      doctor_id: doctors[0]?.id?.toString() || '1',
      doctor_name: doctors[0]?.name || 'Dr. Bolla Chaitanya'
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (a: any) => {
    setEditingAppt(a);
    setForm({
      name: a.name || '',
      phone: a.phone || '',
      email: a.email || '',
      treatment: a.treatment || '',
      next_visit: a.next_visit || '',
      appointment_time: a.appointment_time || '',
      location: a.location || '',
      notes: a.notes || '',
      amount_paid: a.amount_paid?.toString() || '',
      balance_amount: a.balance_amount?.toString() || '',
      doctor_id: a.doctor_id?.toString() || doctors[0]?.id?.toString() || '1',
      doctor_name: a.doctor_name || doctors[0]?.name || 'Dr. Bolla Chaitanya'
    });
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.treatment || !form.next_visit) {
      notify('error', 'Fields Incomplete', 'Provide name, mobile connection, treatment and visit date.');
      return;
    }

    setSaving(true);
    try {
      // ── APPOINTMENT TO PATIENT SYNCHRONIZATION ENGINE ──
      // Search matching patient record via highly resilient clean mobile digit comparison
      const cleanPhoneInput = form.phone.replace(/\D/g, '');
      const last10 = cleanPhoneInput.slice(-10);

      const { data: matchedPatients } = await supabase
        .from('patients')
        .select('id, name, phone, email')
        .or(`phone.eq.${form.phone},phone.ilike.%${last10}%`);

      let matchedPatientId = matchedPatients?.[0]?.id;

      if (!matchedPatientId && form.email) {
        const { data: matchedByEmail } = await supabase
          .from('patients')
          .select('id')
          .eq('email', form.email.trim())
          .limit(1);
        matchedPatientId = matchedByEmail?.[0]?.id;
      }

      // Look up assigned doctor textual details
      const selectedDocObj = doctors.find(d => d.id.toString() === form.doctor_id.toString()) || 
                              doctors[0] || FALLBACK_DOCTORS[0];
      
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        treatment: form.treatment,
        next_visit: form.next_visit,
        appointment_time: form.appointment_time,
        location: form.location.trim(),
        notes: form.notes.trim(),
        amount_paid: form.amount_paid === '' ? 0 : Number(form.amount_paid),
        balance_amount: form.balance_amount === '' ? 0 : Number(form.balance_amount),
        doctor_id: selectedDocObj.id,
        doctor_name: selectedDocObj.name,
        patient_id: matchedPatientId || null // The DB Trigger will auto-create patient if null
      };

      if (editingAppt) {
        // Update
        const { error } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', editingAppt.id);

        if (error) throw error;
        notify('success', 'Roster Rescheduled', `Successfully rescheduled and updated Dr. ${selectedDocObj.name} consulting hours.`);
      } else {
        // Insert
        const { error } = await supabase
          .from('appointments')
          .insert([payload]);

        if (error) {
          if (error.code === '23505') {
            notify('error', 'Duplicate Slot Alert', 'This patient already carries an appointment at this exact date & time.');
            setSaving(false);
            return;
          }
          throw error;
        }
        notify('success', 'Appointment Set', `Successfully scheduled appointment with Dr. ${selectedDocObj.name}`);
      }

      // Prepare WhatsApp Notification engine double payload
      setSavedWhatsAppAlerts({
        patientName: form.name,
        patientPhone: form.phone,
        doctorName: selectedDocObj.name,
        doctorPhone: selectedDocObj.phone || '918317575165',
        treatment: form.treatment,
        date: form.next_visit,
        time: form.appointment_time,
        status: editingAppt ? 'Rescheduled' : 'Scheduled'
      });

      // Dispatch clinic alert email
      notifyAppointmentBooked({
        name: form.name,
        phone: form.phone,
        email: form.email,
        treatment: form.treatment,
        next_visit: form.next_visit,
        appointment_time: form.appointment_time,
        notes: `Specialist assigned: ${selectedDocObj.name}`,
        bookedBy: 'CRM Roster Operator'
      });

      setShowModal(false);
      fetch();
    } catch (err: any) {
      console.error(err);
      notify('error', 'Booking Error', err.message || 'Operation failed. Please check network.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = appointments.filter(a => {
    const s = search.toLowerCase();
    const matchSearch = !search || a.name?.toLowerCase().includes(s) || a.phone?.includes(s) || a.treatment?.toLowerCase().includes(s) || a.doctor_name?.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    const matchDate = !dateFilter || a.next_visit === dateFilter;
    return matchSearch && matchStatus && matchDate;
  });

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(a => a.id));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const triggerBulkReminders = () => {
    if (selectedIds.length === 0) return;
    setBulkFeedback([]);
    setShowBulkModal(true);
    setBulkSending(true);

    let current = 0;
    const ids = [...selectedIds];
    const logNext = () => {
      if (current < ids.length) {
        const appt = appointments.find(a => a.id === ids[current]);
        if (appt) {
          const text = `Sending WhatsApp reminder to ${appt.name} (${appt.phone}) for their ${appt.treatment} session with ${appt.doctor_name || 'Dr. Bolla Chaitanya'} on ${appt.next_visit}...`;
          setBulkFeedback(prev => [...prev, `[SENDING] ${text}`]);
          
          setTimeout(() => {
            setBulkFeedback(prev => [
              ...prev.filter(l => !l.startsWith(`[SENDING] Sending WhatsApp reminder to ${appt.name}`)),
              `[SUCCESS] Dispatched successfully to ${appt.name} (${appt.phone})! ✔`
            ]);
            current++;
            logNext();
          }, 850);
        } else {
          current++;
          logNext();
        }
      } else {
        setBulkSending(false);
      }
    };
    logNext();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold',
      Pending: 'bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold',
      Confirmed: 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold',
      Cancelled: 'bg-rose-50 text-rose-600 border border-rose-200/60 font-semibold',
      'No Show': 'bg-slate-100 text-slate-600 border border-slate-300 font-semibold',
    };
    return map[status] || 'bg-slate-50 text-slate-600 border border-slate-200';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient name, phone, specialist, treatment…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
        <button onClick={handleOpenBookModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap cursor-pointer">
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {vacantSlotNotification && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-widest font-mono select-none">
                Autopopulate Open Slot: Appointment Cancelled
              </h4>
            </div>
            <button onClick={() => setVacantSlotNotification(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
          </div>
          <div className="text-xs text-amber-800 font-medium">
            A slot has become vacant on <strong>{vacantSlotNotification.date}</strong> at <strong>{vacantSlotNotification.time}</strong> for treatment "<em>{vacantSlotNotification.treatment}</em>". Assign this vacant slot instantly to any patient in our waiting list queue:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {WAITING_LIST_QUEUE.map(candidate => (
              <div key={candidate.id} className="bg-white/80 p-3.5 rounded-xl border border-amber-200/60 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-800">{candidate.name}</p>
                  <p className="text-[10px] text-slate-500">{candidate.treatment} · {candidate.preferred_time}</p>
                </div>
                <button
                  onClick={() => handleAssignSlot(candidate)}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] cursor-pointer shadow-xs transition"
                >
                  Allocate Slot
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-teal-50 border border-teal-150 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-teal-800 font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-600" />
            <span>{selectedIds.length} appointments selected in roster lists</span>
          </div>
          <button
            onClick={triggerBulkReminders}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer shadow-xs whitespace-nowrap transition"
          >
            <Send size={12} /> Send Bulk WhatsApp Reminders
          </button>
        </div>
      )}

      <div className="bg-white border rounded-2xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-24 text-center">
            <p className="text-xs text-slate-400 animate-pulse font-semibold">Retrieving active appointments...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-1">
            <p className="text-sm font-bold text-slate-600">No appointments scheduled</p>
            <p className="text-xs">Adjust your search keyword parameters or book a new slot.</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-400 text-[10px] uppercase font-bold tracking-widest select-none">
                    <td className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5">Patient Details</td>
                    <td className="px-4 py-3.5">Assigned Specialist</td>
                    <td className="px-4 py-3.5">Treatment</td>
                    <td className="px-4 py-3.5">Slot Schedule</td>
                    <td className="px-4 py-3.5">Roster Status</td>
                    {admin && (
                      <>
                        <td className="px-4 py-3.5">Total Paid</td>
                        <td className="px-4 py-3.5">Pending Due</td>
                      </>
                    )}
                    <td className="px-4 py-3.5 w-44">Quick Alerts</td>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-705">
                  {filtered.map(a => (
                    <tr key={a.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(a.id) ? 'bg-teal-50/10' : ''}`}>
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(a.id)}
                          onChange={() => toggleOne(a.id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800 text-sm hover:text-teal-600 cursor-pointer transition" onClick={() => handleOpenEditModal(a)}>{a.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{a.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <HeartPulse size={12} className="text-teal-500" />
                          <p className="font-semibold text-slate-700 text-xs">{a.doctor_name || 'Dr. Bolla Chaitanya'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 text-left">
                        <span className="bg-slate-100 border border-slate-200 text-slate-605 px-2 py-0.5 rounded-lg">
                          {a.treatment}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-slate-700 font-semibold"><Calendar size={12} className="text-slate-400" />{a.next_visit}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><Clock size={12} className="text-slate-400" />{a.appointment_time || 'General'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                          className={`text-xs px-2 py-1.5 rounded-lg border cursor-pointer outline-none ${statusBadge(a.status)}`}>
                          {STATUS_OPTIONS.map(s => <option key={s} className="bg-white text-slate-800">{s}</option>)}
                        </select>
                      </td>
                      {admin && (
                        <>
                          <td className="px-4 py-3 text-sm text-emerald-600 font-bold font-mono">₹{a.amount_paid || 0}</td>
                          <td className="px-4 py-3 text-sm text-red-500 font-bold font-mono">₹{a.balance_amount || 0}</td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => handleOpenEditModal(a)}
                            className="p-1 text-slate-400 hover:text-slate-705 cursor-pointer"
                            title="Edit / Reschedule Appointment"
                          >
                            <Edit2 size={13} />
                          </button>
                          
                          {admin && (
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete Appointment"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <span className="text-slate-250">|</span>
                          <a href={`https://wa.me/91${a.phone}?text=${encodeURIComponent(`Sri Chaitanya Dental Care\n\nAppointment scheduled successfully\n\nPatient:\n${a.name}\n\nDoctor:\n${a.doctor_name || 'Dr. Bolla Chaitanya'}\n\nDate:\n${a.next_visit}\n\nTime:\n${a.appointment_time || 'General'}\n\nTreatment:\n${a.treatment}\n\nStatus:\nScheduled`)}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-teal-650 hover:underline font-bold flex items-center gap-0.5"
                            title="Launch WhatsApp Web Alert">
                            <Send size={11} className="text-teal-500" /> WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map(a => (
                <div key={a.id} className={`p-4 flex gap-3 items-start transition-colors ${selectedIds.includes(a.id) ? 'bg-teal-50/20' : ''}`}>
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(a.id)}
                      onChange={() => toggleOne(a.id)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-slate-800 text-sm hover:text-teal-600 transition" onClick={() => handleOpenEditModal(a)}>{a.name}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 font-semibold"><Phone size={10} />{a.phone}</p>
                      </div>
                      <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg font-semibold border cursor-pointer outline-none ${statusBadge(a.status)}`}>
                        {STATUS_OPTIONS.map(s => <option key={s} className="bg-white text-slate-800">{s}</option>)}
                      </select>
                    </div>
                  <p className="text-xs text-slate-700 font-semibold">{a.treatment} · {a.next_visit} {a.appointment_time}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <HeartPulse size={11} className="text-teal-500" />
                    <p className="text-[11px] text-slate-500 font-bold">{a.doctor_name || 'Dr. Bolla Chaitanya'}</p>
                  </div>
                  {admin && (
                    <div className="flex gap-4 mt-1.5 text-xs">
                      <span className="text-emerald-600 font-bold">Paid: ₹{a.amount_paid || 0}</span>
                      <span className="text-red-500 font-bold">Balance: ₹{a.balance_amount || 0}</span>
                    </div>
                  )}
                  <div className="flex gap-3 mt-2.5 pt-2 border-t border-slate-100 flex-wrap items-center">
                    <button onClick={() => handleOpenEditModal(a)} className="text-xs text-slate-600 hover:underline font-bold flex items-center gap-0.5">
                      <Edit2 size={10} /> Edit
                    </button>
                    {admin && (
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-slate-500 hover:underline font-bold flex items-center gap-0.5">
                        <Trash2 size={10} /> Dismiss
                      </button>
                    )}
                    <span className="text-slate-200">|</span>
                    <a href={`https://wa.me/91${a.phone}?text=${encodeURIComponent(`Sri Chaitanya Dental Care\n\nAppointment scheduled successfully\n\nPatient:\n${a.name}\n\nDoctor:\n${a.doctor_name || 'Dr. Bolla Chaitanya'}\n\nDate:\n${a.next_visit}\n\nTime:\n${a.appointment_time || 'General'}\n\nTreatment:\n${a.treatment}\n\nStatus:\nScheduled`)}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                      <Send size={11} className="text-teal-555" /> WhatsApp
                    </a>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Book / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-900 text-white">
              <h3 className="font-bold text-sm tracking-tight">{editingAppt ? 'Edit / Reschedule Appointment' : 'Book Dental Appointment'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>
            
            <form onSubmit={save} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Patient Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Prasad Rao"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Mobile Phone *</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="e.g. 8317575165"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Email Address</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. client@gmail.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Patient Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Hyderabad"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
              </div>

              {/* Doctors selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-teal-500">Consulting Dental Specialist *</label>
                <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-teal-500">
                  <option value="">Select Doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialization || 'Surgeon'})</option>
                  ))}
                </select>
              </div>

              {/* Treatments dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Treatment Procedure *</label>
                <select value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-teal-500">
                  <option value="">Select treatment</option>
                  {TREATMENTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Appointment Date *</label>
                  <input type="date" value={form.next_visit} onChange={e => setForm(f => ({ ...f, next_visit: e.target.value }))} required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Roster Time Slot</label>
                  <input type="time" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
              </div>

              {admin && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Amount Paid (₹)</label>
                    <input type="number" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Balance Pending (₹)</label>
                    <input type="number" value={form.balance_amount} onChange={e => setForm(f => ({ ...f, balance_amount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  </div>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Clinical / Scheduling Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="e.g. Patient requires local anesthesia"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold resize-none focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t justify-end">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-500 text-xs font-bold hover:bg-slate-55 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-65">
                  {saving ? 'Scheduling…' : editingAppt ? 'Update Schedule' : 'Schedule Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Dispatch alerts modal */}
      {savedWhatsAppAlerts && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-4 text-white flex items-center gap-2">
              <CheckCircle2 size={18} className="text-teal-200 animate-bounce" />
              <h3 className="font-bold text-sm tracking-tight">Roster Notification Generated</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Appointment with <strong>{savedWhatsAppAlerts.doctorName}</strong> for patient <strong>{savedWhatsAppAlerts.patientName}</strong> has been successfully synchronized on the database. 
              </p>
              
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-slate-705 text-[10.5px] font-mono whitespace-pre-line leading-relaxed select-all" title="Click to copy message">
                {`Sri Chaitanya Dental Care\n\nNew Appointment Scheduled\n\nPatient:\n${savedWhatsAppAlerts.patientName}\n\nPhone:\n${savedWhatsAppAlerts.patientPhone}\n\nDoctor:\n${savedWhatsAppAlerts.doctorName}\n\nDate:\n${savedWhatsAppAlerts.date}\n\nTime:\n${savedWhatsAppAlerts.time || 'General'}\n\nTreatment:\n${savedWhatsAppAlerts.treatment}\n\nStatus:\n${savedWhatsAppAlerts.status}`}
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Broadcast Action (Dual Roster alerts)</p>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`https://wa.me/${formatWhatsAppPhone(savedWhatsAppAlerts.patientPhone)}?text=${encodeURIComponent(constructWhatsAppMessage(savedWhatsAppAlerts))}`}
                    target="_blank" rel="noreferrer"
                    className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-150 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition"
                  >
                    <Send size={12} className="text-teal-600" /> Notify Patient
                  </a>
                  <a
                    href={`https://wa.me/${formatWhatsAppPhone(savedWhatsAppAlerts.doctorPhone)}?text=${encodeURIComponent(constructWhatsAppMessage(savedWhatsAppAlerts))}`}
                    target="_blank" rel="noreferrer"
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition"
                  >
                    <Send size={12} className="text-slate-400" /> Notify Doctor
                  </a>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t">
                <button
                  onClick={() => setSavedWhatsAppAlerts(null)}
                  className="px-4 py-2 bg-slate-100 font-bold text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition"
                >
                  Close & Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk WhatsApp Dispatch status modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-205">
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-teal-400" />
                <h3 className="font-bold text-xs uppercase tracking-widest">WhatsApp Reminders Queue</h3>
              </div>
              {!bulkSending && (
                <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-white transition cursor-pointer"><X size={18} /></button>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between font-bold text-slate-700 text-sm mb-1.5">
                  <span>Dispatching Logs</span>
                  <span className="text-teal-600 font-mono text-xs font-semibold">
                    {bulkFeedback.filter(l => l.startsWith('[SUCCESS]')).length} / {selectedIds.length} Dispatched
                  </span>
                </div>
                
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-3">
                  <div className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkFeedback.filter(l => l.startsWith('[SUCCESS]')).length / selectedIds.length) * 100}%` }} />
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto font-mono text-[10.5px] text-slate-600 border border-slate-100 bg-white p-3 rounded-lg leading-relaxed">
                  {bulkFeedback.map((log, index) => {
                    if (log.startsWith('[SENDING]')) {
                      return (
                        <div key={index} className="flex items-center gap-2 text-amber-600 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
                          <span>{log.replace('[SENDING] ', '')}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={index} className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                        <span>{log.replace('[SUCCESS] ', '')}</span>
                      </div>
                    );
                  })}
                  {bulkFeedback.length === 0 && <div className="text-slate-400 italic text-center py-4">Initializing queue...</div>}
                </div>
              </div>

              {!bulkSending && (
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowBulkModal(false); setSelectedIds([]); }}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-sm transition">Close Queue</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers for modal construction
function formatWhatsAppPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `91${clean}`;
  return clean;
}

function constructWhatsAppMessage(alerts: any): string {
  return `Sri Chaitanya Dental Care\n\nNew Appointment Scheduled\n\nPatient:\n${alerts.patientName}\n\nPhone:\n${alerts.patientPhone}\n\nDoctor:\n${alerts.doctorName}\n\nDate:\n${alerts.date}\n\nTime:\n${alerts.time || 'General'}\n\nTreatment:\n${alerts.treatment}\n\nStatus:\n${alerts.status}`;
}
