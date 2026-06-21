import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isAdmin } from '../../lib/auth';
import { Bell, AlertCircle, Clock, Calendar, MessageCircle, CheckCircle, CalendarDays, X, Phone } from 'lucide-react';
import { useAppointmentsRealtime } from '../../hooks/useRealtimeHooks';
import { openWhatsApp } from '../../utils/whatsapp';

type Tab = 'overdue' | 'today' | 'tomorrow' | 'completed';

export default function Followups() {
  const admin = isAdmin();
  const [tab, setTab] = useState<Tab>('today');
  const [data, setData] = useState<Record<Tab, any[]>>({ overdue: [], today: [], tomorrow: [], completed: [] });
  const [loading, setLoading] = useState(true);

  // Reschedule handler states
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // WhatsApp Concierge states
  const [waPatientName, setWaPatientName] = useState('');
  const [waPatientPhone, setWaPatientPhone] = useState('');
  const [waTreatment, setWaTreatment] = useState('Routine Checkup');
  const [waDoctor, setWaDoctor] = useState('Dr. J. Durga Bhavani');
  const [waDate, setWaDate] = useState(new Date().toLocaleDateString('en-IN'));
  const [waTemplate, setWaTemplate] = useState<'confirmation' | 'reminder' | 'feedback' | 'review'>('reminder');
  const [waCustomText, setWaCustomText] = useState('');

  const { appointments: realtimeAppointments, refetch: refetchAppointmentsHook } = useAppointmentsRealtime();

  useEffect(() => {
    fetchAll(false);
  }, [realtimeAppointments]);

  useEffect(() => {
    let msg = '';
    if (waTemplate === 'confirmation') {
      msg = `Hi ${waPatientName || 'Patient'}, your appointment at Sri Chaitanya Multispeciality Dental Care is confirmed. Doctor: ${waDoctor}. Date: ${waDate}. We look forward to helping you smile!`;
    } else if (waTemplate === 'reminder') {
      msg = `Hi ${waPatientName || 'Patient'}, this is a friendly recall reminder for your dental follow-up/cleaning at Sri Chaitanya Dental Care on ${waDate}. Please let us know if you can make it.`;
    } else if (waTemplate === 'feedback') {
      msg = `Hi ${waPatientName || 'Patient'}, thank you for visiting Sri Chaitanya Dental Clinic. How was your treatment experience with Dr. Durga Bhavani? We appreciate and value your thoughts!`;
    } else {
      msg = `Hi ${waPatientName || 'Patient'}, thank you for choosing Sri Chaitanya Dental Care. Please help us serve you and others better by taking 20 seconds to share your review on Google: https://search.google.com/local/writereview?placeid=ChIJi-B92vSRzjsRG_8F1O0W0rE`;
    }
    setWaCustomText(msg);
  }, [waPatientName, waDoctor, waDate, waTemplate, waTreatment]);

  const fetchAll = async (forceQuery = true) => {
    setLoading(true);
    if (forceQuery) {
      console.info("[Followups] Force fetch active. Awaiting appointments hook refetch.");
      await refetchAppointmentsHook();
    }
    const getLocalTodayString = (d: Date = new Date()) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = getLocalTodayString();
    
    const dTomorrow = new Date();
    dTomorrow.setDate(dTomorrow.getDate() + 1);
    const tomorrow = getLocalTodayString(dTomorrow);

    const [overdueRes, todayRes, tomorrowRes, completedRes] = await Promise.all([
      supabase.from('appointments').select('*').lt('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")').order('next_visit', { ascending: false }),
      supabase.from('appointments').select('*').eq('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")'),
      supabase.from('appointments').select('*').eq('next_visit', tomorrow).not('status', 'in', '("Completed","Cancelled","Deleted")'),
      supabase.from('appointments').select('*').eq('status', 'Completed').order('next_visit', { ascending: false }).limit(50),
    ]);

    setData({
      overdue: overdueRes.data || [],
      today: todayRes.data || [],
      tomorrow: tomorrowRes.data || [],
      completed: completedRes.data || [],
    });
    setLoading(false);
  };

  const markCompleted = async (id: number) => {
    await supabase.from('appointments').update({ status: 'Completed' }).eq('id', id);
    fetchAll();
  };

  const openRescheduleModal = (appt: any) => {
    setRescheduleAppt(appt);
    setNewDate(appt.next_visit || '');
    setNewTime(appt.appointment_time || '');
  };

  const saveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleAppt || !newDate) return;
    setRescheduling(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          next_visit: newDate,
          appointment_time: newTime || null,
          status: 'Pending'
        })
        .eq('id', rescheduleAppt.id);

      if (error) throw error;
      setRescheduleAppt(null);
      await fetchAll();
    } catch (err) {
      console.error('Error rescheduling follow-up:', err);
    } finally {
      setRescheduling(false);
    }
  };

  // Removed old manual waMessage function

  const tabs: { id: Tab; label: string; icon: typeof Bell; color: string }[] = [
    { id: 'overdue', label: 'Overdue Followups', icon: AlertCircle, color: 'text-rose-600' },
    { id: 'today', label: "Today's Followups", icon: Clock, color: 'text-amber-500' },
    { id: 'tomorrow', label: 'Tomorrow Followups', icon: Bell, color: 'text-indigo-500' },
    { id: 'completed', label: 'Completed Followups', icon: CheckCircle, color: 'text-emerald-500' },
  ];

  const tabColor: Record<Tab, string> = {
    overdue: 'bg-rose-50 text-rose-700 border-rose-100',
    today: 'bg-amber-50 text-amber-700 border-amber-100',
    tomorrow: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };

  const cardColor: Record<Tab, string> = {
    overdue: 'border-rose-100 focus-within:ring-rose-500',
    today: 'border-amber-100 focus-within:ring-amber-500',
    tomorrow: 'border-indigo-100 focus-within:ring-indigo-500',
    completed: 'border-emerald-100 focus-within:ring-emerald-500',
  };

  const list = data[tab];

  return (
    <div className="space-y-5">
      {/* Summary Tab Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tabs.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-3 p-4 rounded-2xl border bg-white shadow-sm transition hover:shadow-md outline-none text-left ${tab === id ? 'ring-2 ring-teal-500 border-teal-100' : 'border-slate-150'}`}
          >
            <div className={`p-2.5 rounded-xl ${tabColor[id].split(' ')[0]} ${color}`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-extrabold text-slate-800 leading-none">{data[id].length}</p>
              <p className="text-xs text-slate-400 font-semibold mt-1 truncate">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Context Segment Banner */}
      <div className={`flex items-center gap-2.5 px-4.5 py-3 rounded-xl border ${tabColor[tab]}`}>
        {(() => { const T = tabs.find(t => t.id === tab)!; return <T.icon size={16} />; })()}
        <span className="font-bold text-sm">
          {tabs.find(t => t.id === tab)?.label} — {list.length} Records Found
        </span>
      </div>

      {/* Grid of Followup Action Cards */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-semibold mt-4">Retrieving follow-up schedules from Sri Chaitanya database...</p>
        </div>
      ) : list.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-150 shadow-sm max-w-lg mx-auto">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={26} />
          </div>
          <h3 className="font-extrabold text-slate-800 text-sm">All cleared for now</h3>
          <p className="text-slate-500 text-xs mt-1 px-4 leading-relaxed font-medium">No {tabs.find(t => t.id === tab)?.label.toLowerCase()} require clinical follow-up actions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a: any) => (
            <div key={a.id} className={`bg-white rounded-2xl border shadow-sm p-4.5 flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-md ${cardColor[tab]}`}>
              <div>
                <div className="flex items-start gap-3 mb-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-150 text-teal-800 font-extrabold text-base flex items-center justify-center flex-shrink-0">
                    {a.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate leading-snug">{a.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">{a.phone}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border flex-shrink-0
                    ${a.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-110' :
                      a.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-110' :
                      'bg-indigo-50 text-indigo-700 border-indigo-110'}`}>
                    {a.status}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4 text-xs font-semibold">
                  <p className="text-slate-600 leading-snug"><span className="text-slate-400 font-medium">Treatment:</span> {a.treatment || 'Consultation'}</p>
                  <p className="text-slate-605 leading-snug flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    <span>Scheduled: {a.next_visit} {a.appointment_time && `at ${a.appointment_time}`}</span>
                  </p>
                  {admin && Number(a.balance_amount || 0) > 0 && (
                    <p className="text-rose-600 font-bold leading-snug">
                      <span className="text-slate-400 font-medium">Due Balance:</span> ₹{Number(a.balance_amount).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openRescheduleModal(a)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition outline-none"
                >
                  <CalendarDays size={13} />
                  Reschedule
                </button>

                {a.status !== 'Completed' && (
                  <button
                    type="button"
                    onClick={() => markCompleted(a.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition outline-none"
                  >
                    <CheckCircle size={13} />
                    Complete
                  </button>
                )}

                {a.phone && (
                  <a
                    href={`tel:${a.phone}`}
                    className="p-2 h-9 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition border border-teal-150"
                    title="Call Patient Directly"
                  >
                    <Phone size={15} />
                  </a>
                )}

                {a.phone && (
                  <button
                    onClick={() => {
                      const msg = `Hi ${a.name}, this is a friendly reminder for your upcoming treatment follow-up at Sri Chaitanya Multispeciality Dental Care on ${a.next_visit}${a.appointment_time ? ' at ' + a.appointment_time : ''}. Please confirm your visit. Thank you!`;
                      openWhatsApp(a.phone, msg);
                    }}
                    className="p-2 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition border border-emerald-150 cursor-pointer"
                    title="Send WhatsApp Reminder"
                  >
                    <MessageCircle size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WhatsApp Clinical Communication Command Hub */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            WhatsApp Clinical Communication Command Hub
          </h3>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Select a patient & load reusable templates (Confirmation, Reminder, Feedback, or Reviews) to instantly pre-fill clinical WhatsApp messages.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 font-sans">
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block mb-1">
                Fast Select Active Patient (From chosen tab)
              </label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setWaPatientName('');
                    setWaPatientPhone('');
                    setWaTreatment('Routine Checkup');
                  } else {
                    const sel = list.find(x => String(x.id) === val);
                    if (sel) {
                      setWaPatientName(sel.name || '');
                      setWaPatientPhone(sel.phone || '');
                      setWaTreatment(sel.treatment || 'Routine Checkup');
                      if (sel.next_visit) {
                        setWaDate(sel.next_visit);
                      }
                    }
                  }
                }}
                className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none text-xs text-slate-800 font-bold focus:border-teal-500 focus:ring-1 focus:ring-teal-505 transition"
              >
                <option value="">-- Choose active patient to auto-populate --</option>
                {list.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.phone}) - {p.treatment || 'Consultation'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Patient Name</label>
                <input
                  type="text"
                  value={waPatientName}
                  onChange={(e) => setWaPatientName(e.target.value)}
                  placeholder="Patient Name"
                  className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none text-xs font-bold text-slate-850"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Patient Phone (10 digits)</label>
                <input
                  type="text"
                  value={waPatientPhone}
                  onChange={(e) => setWaPatientPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Phone number"
                  className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none text-xs font-mono font-bold text-slate-850"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Treat. Date</label>
                <input
                  type="text"
                  value={waDate}
                  onChange={(e) => setWaDate(e.target.value)}
                  placeholder="e.g. 2026-06-21"
                  className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none text-xs font-bold text-slate-850 animate-in"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Attending Dentist</label>
                <select
                  value={waDoctor}
                  onChange={(e) => setWaDoctor(e.target.value)}
                  className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 outline-none text-xs font-bold text-slate-850 focus:border-teal-505"
                >
                  <option value="Dr. Sri Chaitanya">Dr. Sri Chaitanya, Clinical Director</option>
                  <option value="Dr. J. Durga Bhavani">Dr. J. Durga Bhavani, Cosmetic Surgeon</option>
                  <option value="Dr. Bhavani">Dr. Bhavani</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
                Select WhatsApp Template Theme
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'confirmation', label: 'Confirmation' },
                  { id: 'reminder', label: 'Recall Reminder' },
                  { id: 'feedback', label: 'Feedback' },
                  { id: 'review', label: 'Google Review' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWaTemplate(item.id as any)}
                    className={`h-9 text-xs rounded-xl font-bold transition flex items-center justify-center border ${
                      waTemplate === item.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-650 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Previewer */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-205 p-4.5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-[10px] text-emerald-650 uppercase font-bold tracking-wider font-mono flex items-center gap-1.5 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Compiled Message Preview
                </span>
                <span className="text-[9px] text-slate-400 font-mono font-bold">Characters: {waCustomText.length}</span>
              </div>
              <textarea
                value={waCustomText}
                onChange={(e) => setWaCustomText(e.target.value)}
                rows={5}
                className="w-full bg-slate-50 border border-slate-150 rounded-xl p-3 outline-none text-xs font-semibold text-slate-705 leading-relaxed focus:bg-white focus:border-teal-500 transition-all resize-none"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (!waPatientPhone) {
                    alert("Please specify a 10-digit mobile number for the patient.");
                    return;
                  }
                  openWhatsApp(waPatientPhone, waCustomText);
                }}
                className="w-full h-11 rounded-xl bg-emerald-600/95 hover:bg-emerald-600 text-white font-extrabold text-xs transition shadow-sm hover:shadow-md flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                <MessageCircle size={15} />
                Launch WhatsApp Dispatcher
              </button>
              <p className="text-[9px] text-slate-400 text-center font-bold">Launches official WhatsApp with compiled text in a secure browser tab.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reschedule Modal overlay */}
      {rescheduleAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-150 shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-800">
            <div className="bg-teal-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Reschedule Follow-up</h4>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleAppt(null)}
                className="text-white/80 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveReschedule} className="p-5.5 space-y-4">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Patient Name</p>
                <p className="text-slate-800 font-extrabold text-sm">{rescheduleAppt.name}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">New Visit Date <strong className="text-red-500">*</strong></label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full h-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl px-3 outline-none text-xs font-bold focus:border-teal-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Visit Time Slot (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 11:30 AM"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full h-10 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl px-3 outline-none text-xs font-bold focus:border-teal-500 transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="flex items-center gap-3 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleAppt(null)}
                  className="flex-1 h-10 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-150 rounded-xl text-xs font-bold transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling}
                  className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 border-none shadow-sm cursor-pointer"
                >
                  {rescheduling ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Save Schedule'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
