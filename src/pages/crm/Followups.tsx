import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isAdmin } from '../../lib/auth';
import { Bell, AlertCircle, Clock, Calendar, MessageCircle, CheckCircle, CalendarDays, X } from 'lucide-react';

type Tab = 'missed' | 'today' | 'upcoming' | 'completed';

export default function Followups() {
  const admin = isAdmin();
  const [tab, setTab] = useState<Tab>('today');
  const [data, setData] = useState<Record<Tab, any[]>>({ missed: [], today: [], upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);

  // Reschedule handler states
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [missedRes, todayRes, upcomingRes, completedRes] = await Promise.all([
      supabase.from('appointments').select('*').lt('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")').order('next_visit', { ascending: false }),
      supabase.from('appointments').select('*').eq('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")'),
      supabase.from('appointments').select('*').gt('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")').order('next_visit', { ascending: true }),
      supabase.from('appointments').select('*').eq('status', 'Completed').order('next_visit', { ascending: false }).limit(50),
    ]);

    setData({
      missed: missedRes.data || [],
      today: todayRes.data || [],
      upcoming: upcomingRes.data || [],
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
          status: 'Pending' // Reset to pending if rescheduled so it shows up in upcoming/today schedules
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

  const waMessage = (a: any) =>
    `https://wa.me/91${a.phone}?text=${encodeURIComponent(`Hi ${a.name}, this is a reminder for your dental appointment at Sri Chaitanya Dental Care on ${a.next_visit}${a.appointment_time ? ' at ' + a.appointment_time : ''}. Please confirm your visit. Thank you!`)}`;

  const tabs: { id: Tab; label: string; icon: typeof Bell; color: string }[] = [
    { id: 'missed', label: 'Missed Follow-ups', icon: AlertCircle, color: 'text-rose-600' },
    { id: 'today', label: "Today's Follow-ups", icon: Clock, color: 'text-amber-500' },
    { id: 'upcoming', label: 'Upcoming Follow-ups', icon: Bell, color: 'text-indigo-500' },
    { id: 'completed', label: 'Completed Follow-ups', icon: CheckCircle, color: 'text-emerald-500' },
  ];

  const tabColor: Record<Tab, string> = {
    missed: 'bg-rose-50 text-rose-700 border-rose-100',
    today: 'bg-amber-50 text-amber-700 border-amber-100',
    upcoming: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };

  const cardColor: Record<Tab, string> = {
    missed: 'border-rose-100 focus-within:ring-rose-500',
    today: 'border-amber-100 focus-within:ring-amber-500',
    upcoming: 'border-indigo-100 focus-within:ring-indigo-500',
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
                    href={waMessage(a)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition border border-emerald-150"
                    title="Send WhatsApp Reminder"
                  >
                    <MessageCircle size={16} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
