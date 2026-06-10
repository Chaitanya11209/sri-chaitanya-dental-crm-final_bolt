import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin, isLoggedIn, getRole } from '../../lib/auth';
import { useNotification } from '../../components/NotificationProvider';
import { startGlobalSync, stopGlobalSync } from '../../lib/syncState';
import {
  Users, CalendarCheck, AlertCircle, DollarSign, UserCheck,
  Clock, CheckCircle2, Activity, TrendingUp, ArrowUpRight,
  Plus, Search, FileText, Stethoscope, CalendarPlus, ChevronRight,
  Hourglass, TriangleAlert, Bell, Send, X, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const TREATMENT_TYPES = ['RCT', 'Scaling', 'Crown', 'Extraction', 'Orthodontics', 'Implant', 'Cleaning', 'Filling'];

export default function CRMDashboard() {
  const [, setLocation] = useLocation();
  const admin = isAdmin();
  const role = getRole();
  const validRoles = ['admin', 'doctor', 'receptionist', 'assistant'];
  const isValidRole = role && validRoles.includes(role);
  const { notify } = useNotification();

  useEffect(() => {
    if (!isLoggedIn()) {
      setLocation('/admin');
      return;
    }
    if (!isValidRole) {
      console.error("Access Denied: Dashboard role lookup failed or unauthorized role. Value:", role);
    }
  }, [setLocation, role, isValidRole]);

  const [loading, setLoading] = useState(true);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayTotal: 0, todayPending: 0, todayCompleted: 0,
    waitingPatients: 0, inTreatment: 0, followupDue: 0,
    overdueFollowups: 0, tomorrowFollowups: 0, upcomingFollowups: 0,
    completedTreatments: 0,
    todayCollection: 0, pendingBalance: 0, monthCollection: 0,
  });
  const [treatmentBreakdown, setTreatmentBreakdown] = useState<{ name: string; count: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [weeklyCollectionsData, setWeeklyCollectionsData] = useState<any[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [monthlyCollection, setMonthlyCollection] = useState<any[]>([]);

  // Recall Queue states
  const [recalls, setRecalls] = useState<any[]>([]);
  const [contactedList, setContactedList] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sdc_contacted_recalls');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Dynamic booking overlay/modal state
  const [bookingRecall, setBookingRecall] = useState<any | null>(null);
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('10:00');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bBooking, setBBooking] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { setLocation('/admin'); return; }
    fetchAll();

    // Set up Realtime subscriptions so updates in other tabs sync immediately.
    const channelAppt = supabase
      .channel('dash-appts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAll();
      })
      .subscribe();

    const channelTreat = supabase
      .channel('dash-treats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treatments' }, () => {
        fetchAll();
      })
      .subscribe();

    const channelPatients = supabase
      .channel('dash-patients-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelAppt);
      supabase.removeChannel(channelTreat);
      supabase.removeChannel(channelPatients);
    };
  }, []);

  const toggleContacted = (phone: string, reason: string) => {
    const key = `${phone}-${reason}`;
    let next: string[] = [];
    if (contactedList.includes(key)) {
      next = contactedList.filter(k => k !== key);
    } else {
      next = [...contactedList, key];
    }
    setContactedList(next);
    localStorage.setItem('sdc_contacted_recalls', JSON.stringify(next));
  };

  const openBookingModal = (recallItem: any) => {
    setBookingRecall(recallItem);
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setBookDate(tomorrowStr);
    setBookTime('10:00');
    setBookingError('');
    setBookingSuccess('');
    setBBooking(false);
  };

  const handleBookRecallAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRecall) return;
    setBBooking(true);
    setBookingError('');
    setBookingSuccess('');

    let attempts = 0;
    const maxAttempts = 2;
    let finalErr = null;

    while (attempts < maxAttempts) {
      try {
        const { data: existing } = await supabase.from('patients').select('id, email, location').eq('phone', bookingRecall.phone).maybeSingle();
        let patientId = existing?.id;
        let email = existing?.email || '';
        let location = existing?.location || '';

        const { error } = await supabase.from('appointments').insert([{
          name: bookingRecall.name,
          phone: bookingRecall.phone,
          email: email,
          location: location,
          treatment: bookingRecall.treatment,
          next_visit: bookDate,
          appointment_time: bookTime,
          patient_id: patientId,
          status: 'Pending',
          visit_count: 1,
          amount_paid: 0,
          balance_amount: 0,
          notes: `Scheduled via automated recall outreach for: ${bookingRecall.reason}`
        }]);

        if (error) {
          if (error.code === '23505') {
            const dupMsg = 'Duplicate appointment slot detected. This slot is already booked for this phone number.';
            setBookingError(dupMsg);
            notify('error', 'Duplicate Appointment', dupMsg);
            setBBooking(false);
            return;
          }
          throw error;
        }

        setBookingSuccess('Recall appointment scheduled successfully!');
        notify('success', 'Recall Appointment Created', `Successfully scheduled recall appointment for ${bookingRecall.name}.`);
        
        // Remove from contacted logs if success
        const outreachKey = `${bookingRecall.phone}-${bookingRecall.reason}`;
        const nextContacted = contactedList.filter(k => k !== outreachKey);
        setContactedList(nextContacted);
        localStorage.setItem('sdc_contacted_recalls', JSON.stringify(nextContacted));

        setTimeout(() => {
          setBookingRecall(null);
          fetchAll();
        }, 1200);

        setBBooking(false);
        return;
      } catch (err: any) {
        attempts++;
        finalErr = err;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    const errMsg = finalErr?.message || 'A network error occurred during booking. Please try again.';
    setBookingError(errMsg);
    notify('error', 'Booking Failed', errMsg);
    setBBooking(false);
  };

  const fetchAll = async () => {
    startGlobalSync();
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const next7 = new Date(); next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split('T')[0];
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      const [
        patientsRes, todayRes, todayPendingRes, todayCompletedRes,
        waitingRes, inTreatRes, overdueRes, tomorrowRes, upcomingRes,
        completedRes, recentRes, weekRes, monthlyRes,
        treatmentsRes, allAppointmentsRes
      ] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).neq('status', 'Cancelled').neq('status', 'Deleted'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Completed'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'In Treatment'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).lt('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', tomorrowStr).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gt('next_visit', tomorrowStr).lte('next_visit', next7Str).neq('status', 'Cancelled').neq('status', 'Deleted'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'Completed'),
        supabase.from('appointments').select('*').neq('status', 'Deleted').order('created_at', { ascending: false }).limit(6),
        supabase.from('appointments').select('next_visit, status, treatment, amount_paid, balance_amount').neq('status', 'Deleted').order('next_visit', { ascending: false }).limit(300),
        admin ? supabase.from('appointments').select('next_visit, amount_paid, balance_amount').gte('next_visit', monthStartStr).neq('status', 'Deleted') : Promise.resolve({ data: [] }),
        supabase.from('treatments').select('*'),
        supabase.from('appointments').select('*').neq('status', 'Deleted')
      ]);

      // Normalize and sort today's clinical appointments for workflow card
      const todayList = (allAppointmentsRes.data || []).filter((a: any) => a.next_visit === today);
      const sortedToday = todayList.sort((a: any, b: any) => {
        const timeA = a.appointment_time || '';
        const timeB = b.appointment_time || '';
        return timeA.localeCompare(timeB);
      });
      setTodayAppointments(sortedToday);

      const allData = weekRes.data || [];

      // Weekly appointments chart
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const count = allData.filter((a: any) => a.next_visit === key).length;
        days.push({ day: label, count });
      }
      setWeeklyData(days);

      // Weekly collections chart (daily collections for active week)
      if (admin) {
        const collectionsWeek = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
          const dayAmount = allData
            .filter((a: any) => a.next_visit === key)
            .reduce((sum: number, a: any) => sum + Number(a.amount_paid || 0), 0);
          collectionsWeek.push({ day: label, amount: dayAmount });
        }
        setWeeklyCollectionsData(collectionsWeek);
      }

      // Treatment breakdown
      const tMap: Record<string, number> = {};
      allData.forEach((a: any) => {
        if (!a.treatment) return;
        const key = TREATMENT_TYPES.find(t => a.treatment.toLowerCase().includes(t.toLowerCase())) || 'Other';
        tMap[key] = (tMap[key] || 0) + 1;
      });
      const breakdown = Object.entries(tMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
      setTreatmentBreakdown(breakdown);

      // Financial (admin only)
      let todayCollection = 0, pendingBalance = 0, monthCollection = 0;
      if (admin) {
        const monthlyData = (monthlyRes as any).data || [];
        todayCollection = allData.filter((a: any) => a.next_visit === today).reduce((t: number, a: any) => t + Number(a.amount_paid || 0), 0);
        pendingBalance = allData.reduce((t: number, a: any) => t + Number(a.balance_amount || 0), 0);
        monthCollection = monthlyData.reduce((t: number, a: any) => t + Number(a.amount_paid || 0), 0);

        // Monthly collection chart (last 30 days grouped by week)
        const weeks: Record<string, number> = {};
        monthlyData.forEach((a: any) => {
          const d = new Date(a.next_visit);
          const weekLabel = `W${Math.ceil(d.getDate() / 7)}`;
          weeks[weekLabel] = (weeks[weekLabel] || 0) + Number(a.amount_paid || 0);
        });
        setMonthlyCollection(Object.entries(weeks).map(([week, amount]) => ({ week, amount })));
      }

      setStats({
        totalPatients: patientsRes.count || 0,
        todayTotal: todayRes.count || 0,
        todayPending: todayPendingRes.count || 0,
        todayCompleted: todayCompletedRes.count || 0,
        waitingPatients: waitingRes.count || 0,
        inTreatment: inTreatRes.count || 0,
        followupDue: overdueRes.count || 0,
        overdueFollowups: overdueRes.count || 0,
        tomorrowFollowups: tomorrowRes.count || 0,
        upcomingFollowups: upcomingRes.count || 0,
        completedTreatments: completedRes.count || 0,
        todayCollection, pendingBalance, monthCollection,
      });

      setRecentAppointments(recentRes.data || []);

      // Build Dynamic Recall Queue from historical data
      const rawTreatments = treatmentsRes.data || [];
      const rawAppts = allAppointmentsRes.data || [];
      const completedEvents: { name: string; phone: string; treatment: string; date: string }[] = [];

      // Gather from completed treatment plans
      rawTreatments.forEach((t: any) => {
        if (t.stage === 'Completed' && t.patient_name && t.phone) {
          completedEvents.push({
            name: t.patient_name,
            phone: t.phone,
            treatment: t.treatment_type || 'Dental Service',
            date: t.start_date || t.created_at?.split('T')[0] || ''
          });
        }
      });

      // Gather from completed appointment care sessions
      rawAppts.forEach((a: any) => {
        if (a.status === 'Completed' && a.name && a.phone && a.treatment) {
          completedEvents.push({
            name: a.name,
            phone: a.phone,
            treatment: a.treatment,
            date: a.next_visit || a.created_at?.split('T')[0] || ''
          });
        }
      });

      // Sort chronological descending
      completedEvents.sort((a, b) => b.date.localeCompare(a.date));

      // Group latest event by patient phone + treatment category
      const latestByPatientAndType: Record<string, typeof completedEvents[0]> = {};
      completedEvents.forEach(ev => {
        const phone = ev.phone?.trim();
        if (!phone) return;
        
        let typeGroup = 'other';
        const txt = ev.treatment.toLowerCase();
        if (txt.includes('scaling') || txt.includes('polish') || txt.includes('cleaning')) {
          typeGroup = 'scaling';
        } else if (txt.includes('rct') || txt.includes('root canal')) {
          typeGroup = 'rct';
        } else if (txt.includes('crown') || txt.includes('bridge') || txt.includes('cap')) {
          typeGroup = 'crown';
        } else if (txt.includes('implant')) {
          typeGroup = 'implant';
        } else if (txt.includes('filling')) {
          typeGroup = 'filling';
        }

        const key = `${phone}-${typeGroup}`;
        if (!latestByPatientAndType[key]) {
          latestByPatientAndType[key] = ev;
        }
      });

      const todayStr = new Date().toISOString().split('T')[0];

      // Formulate active recall due items
      const computedRecalls: any[] = [];
      Object.values(latestByPatientAndType).forEach(ev => {
        const completedDate = new Date(ev.date);
        if (isNaN(completedDate.getTime())) return;

        let intervalMonths = 6;
        let reason = 'Routine Oral Check';
        const txt = ev.treatment.toLowerCase();

        if (txt.includes('scaling') || txt.includes('polish') || txt.includes('cleaning')) {
          intervalMonths = 6;
          reason = 'Preventive Scale & Polish';
        } else if (txt.includes('rct') || txt.includes('root canal')) {
          intervalMonths = 1;
          reason = 'Post-RCT Evaluation Review';
        } else if (txt.includes('crown') || txt.includes('bridge') || txt.includes('cap')) {
          intervalMonths = 12;
          reason = 'Crown & Bridge Integrity Check';
        } else if (txt.includes('implant')) {
          intervalMonths = 6;
          reason = 'Implant Osseointegration Monitor';
        } else if (txt.includes('filling')) {
          intervalMonths = 12;
          reason = 'Restorative Filling Checkup';
        }

        const dueDate = new Date(completedDate);
        dueDate.setMonth(dueDate.getMonth() + intervalMonths);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        // Active within next 30 days or already overdue
        const diffTime = dueDate.getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          // Exclude if already booked a slot after ev.date, or have active pending/confirmed appointment
          const hasFutureOrNewer = rawAppts.some((appt: any) => {
            if (appt.phone?.trim() !== ev.phone.trim()) return false;
            if (appt.status === 'Cancelled' || appt.status === 'Deleted') return false;

            const isFutureActive = (appt.status === 'Pending' || appt.status === 'Confirmed') && appt.next_visit >= todayStr;
            const isNewerVisit = appt.next_visit > ev.date;

            return isFutureActive || isNewerVisit;
          });

          if (!hasFutureOrNewer) {
            computedRecalls.push({
              name: ev.name,
              phone: ev.phone,
              treatment: ev.treatment,
              completedDate: ev.date,
              dueDate: dueDateStr,
              reason,
              isOverdue: dueDateStr < todayStr,
              daysDiff: diffDays
            });
          }
        }
      });

      // Eldest overdue first
      computedRecalls.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setRecalls(computedRecalls);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      stopGlobalSync();
    }
  };

  const updateAppointmentStatus = async (id: number, status: string) => {
    startGlobalSync();
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      notify('success', 'Workflow Status Updated', `Appointment status updated to "${status}".`);
      await fetchAll();
    } catch (err: any) {
      notify('error', 'Workflow Update Failed', err.message || String(err));
    } finally {
      stopGlobalSync();
    }
  };

  if (!isLoggedIn()) {
    return null;
  }

  if (!isValidRole) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-red-150 text-red-700 flex items-center justify-center mb-4">
          <TriangleAlert size={24} />
        </div>
        <h2 className="text-slate-800 font-bold text-base">Dashboard Access Denied</h2>
        <p className="text-slate-500 text-xs mt-1.5 max-w-sm leading-relaxed font-semibold">
          Your account role is either unassigned or unrecognized. Please sign out and sign back in to establish a secure session.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-9 h-9 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading dashboard…</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'Pending') return 'bg-amber-100 text-amber-700';
    if (s === 'Cancelled') return 'bg-red-100 text-red-700';
    if (s === 'In Treatment') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-5 pb-4">

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'teal' },
          { label: "Today's Appts", value: stats.todayTotal, icon: CalendarCheck, color: 'blue' },
          { label: 'Patients Waiting', value: stats.waitingPatients, icon: Hourglass, color: 'amber' },
          { label: 'Follow-ups Due', value: stats.overdueFollowups, icon: AlertCircle, color: 'rose' },
          { label: 'Completed', value: stats.completedTreatments, icon: CheckCircle2, color: 'emerald' },
          admin
            ? { label: 'Pending Balance', value: `₹${Number(stats.pendingBalance).toLocaleString('en-IN')}`, icon: DollarSign, color: 'purple' }
            : { label: 'In Treatment', value: stats.inTreatment, icon: Stethoscope, color: 'indigo' },
        ].map(({ label, value, icon: Icon, color }) => {
          return (
            <div key={label} className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
              <div className="flex items-end justify-between mt-1">
                <span className="text-xl font-bold text-slate-900 leading-none">{value}</span>
                <span className="text-[10px] text-slate-400 font-medium leading-none">Stable</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin-only Collections Row */}
      {admin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Today's Collections", value: `₹${Number(stats.todayCollection).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'bg-teal-600', sub: 'Payments received today' },
            { label: 'Monthly Collections', value: `₹${Number(stats.monthCollection).toLocaleString('en-IN')}`, icon: Activity, color: 'bg-blue-600', sub: 'This month total' },
            { label: 'Pending Balance', value: `₹${Number(stats.pendingBalance).toLocaleString('en-IN')}`, icon: AlertCircle, color: 'bg-amber-500', sub: 'Outstanding from patients' },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily Schedule Summary - Today's Workflow at a glance */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <CalendarCheck size={15} className="text-teal-600" /> Daily Schedule Summary
            </h3>
            <p className="text-slate-400 text-[10.5px] mt-0.5 font-medium">
              Today's direct workflow, time slot sequences, and queue controls at a glance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-teal-100 uppercase font-mono">
              {todayAppointments.length} Active Slot{todayAppointments.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-semibold">
            No clinical appointments scheduled for today.
            <div className="mt-2.5">
              <Link href="/crm/appointments">
                <span className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] uppercase font-bold px-4 py-2 rounded-xl inline-block shadow-sm transition cursor-pointer">
                  + Create Appointment
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">
                  <th className="py-2.5">Time Slot</th>
                  <th className="py-2.5">Patient Details</th>
                  <th className="py-2.5">Treatment Procedure</th>
                  {admin && <th className="py-2.5">Financials</th>}
                  <th className="py-2.5">Workflow Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105 text-slate-700">
                {todayAppointments.map((appt) => (
                  <tr key={`sched-${appt.id}`} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 font-mono font-bold text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                      <Clock size={12} className="text-teal-600" />
                      {appt.appointment_time || '10:00 AM'}
                    </td>
                    <td className="py-3">
                      <div>
                        <p className="font-bold text-slate-900">{appt.name || 'Unknown Patient'}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{appt.phone || 'No Contact'}</p>
                      </div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <span className="bg-slate-100 border border-slate-205 text-slate-700 px-2 py-0.5 rounded text-[10.5px] font-semibold">
                        {appt.treatment || 'General Checkup'}
                      </span>
                    </td>
                    {admin && (
                      <td className="py-3 whitespace-nowrap font-mono">
                        <div>
                          <p className="text-slate-800 font-bold">₹{Number(appt.amount_paid || 0).toLocaleString('en-IN')}</p>
                          {appt.balance_amount > 0 && (
                            <p className="text-rose-605 font-bold text-[9px] mt-0.5">Due: ₹{Number(appt.balance_amount || 0).toLocaleString('en-IN')}</p>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider border ${
                        appt.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        appt.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        appt.status === 'In Treatment' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {appt.status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        {appt.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() => updateAppointmentStatus(appt.id, 'In Treatment')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-bold px-2.5 py-1 rounded-lg shadow-xs transition cursor-pointer"
                          >
                            In Treatment
                          </button>
                        )}
                        {appt.status === 'In Treatment' && (
                          <button
                            type="button"
                            onClick={() => updateAppointmentStatus(appt.id, 'Completed')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold px-2.5 py-1 rounded-lg shadow-xs transition cursor-pointer"
                          >
                            Mark Completed
                          </button>
                        )}
                        {appt.status !== 'Completed' && appt.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => updateAppointmentStatus(appt.id, 'Cancelled')}
                            className="bg-slate-100 hover:bg-slate-205 text-slate-600 text-[9.5px] font-bold px-2 py-1 rounded-lg border border-slate-200 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        {appt.status === 'Completed' && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 uppercase pr-2">
                            <CheckCircle2 size={11} /> Handled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Middle Row: Today's Appointments + Patient Queue + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Today's Appointments */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <CalendarCheck size={14} className="text-teal-600" /> Today's Appointments
            </h3>
            <Link href="/crm/appointments">
              <span className="text-[10px] uppercase font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">View <ChevronRight size={11} /></span>
            </Link>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Total Today', value: stats.todayTotal, color: 'bg-blue-500', text: 'text-slate-900' },
              { label: 'Pending Queue', value: stats.todayPending, color: 'bg-amber-400', text: 'text-amber-700' },
              { label: 'Completed Care', value: stats.todayCompleted, color: 'bg-emerald-500', text: 'text-emerald-700' },
            ].map(({ label, value, color, text }) => (
              <div key={label} className="flex items-center gap-3 py-0.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                <span className="text-xs text-slate-600 flex-1">{label}</span>
                <span className={`text-xs font-bold font-mono ${text}`}>{value}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-slate-100">
              <div className="w-full bg-slate-100 rounded-full h-1.5 animate-pulse">
                <div
                  className="bg-teal-600 h-1.5 rounded-full transition-all"
                  style={{ width: stats.todayTotal > 0 ? `${(stats.todayCompleted / stats.todayTotal) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                {stats.todayTotal > 0 ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) : 0}% completed
              </p>
            </div>
          </div>
        </div>

        {/* Patient Queue */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <Users size={14} className="text-blue-600" /> Patient Queue
            </h3>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Pending Consultations', value: stats.waitingPatients, icon: Hourglass, bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-100' },
              { label: 'Active In Treatment', value: stats.inTreatment, icon: Stethoscope, bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-100' },
              { label: 'Follow-ups Required', value: stats.followupDue, icon: Bell, bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-100' },
            ].map(({ label, value, icon: Icon, bg, text, border }) => (
              <div key={label} className={`flex items-center gap-3 px-2.5 py-1.5 rounded-lg border ${bg} ${border}`}>
                <Icon size={13} className="text-slate-450" />
                <span className="text-xs font-semibold text-slate-700 flex-1">{label}</span>
                <span className={`text-xs font-bold font-mono ${text}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Tracker */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <Bell size={14} className="text-rose-600" /> Follow-up Tracker
            </h3>
            <Link href="/crm/followups">
              <span className="text-[10px] uppercase font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">View <ChevronRight size={11} /></span>
            </Link>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Overdue Schedules', value: stats.overdueFollowups, icon: TriangleAlert, bg: 'bg-red-50/70', text: 'text-red-700', border: 'border-red-100/50' },
              { label: "Today's Schedules", value: stats.todayPending, icon: Clock, bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-100' },
              { label: 'Upcoming (7 days)', value: stats.upcomingFollowups, icon: CalendarCheck, bg: 'bg-slate-50', text: 'text-slate-80% ', border: 'border-slate-100' },
            ].map(({ label, value, icon: Icon, bg, text, border }) => (
              <div key={label} className={`flex items-center gap-3 px-2.5 py-1.5 rounded-lg border ${bg} ${border}`}>
                <Icon size={13} className="text-slate-450" />
                <span className="text-xs font-semibold text-slate-700 flex-1">{label}</span>
                <span className={`text-xs font-bold font-mono ${text}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AUTOMATED CLINICAL RECALL OUTREACH QUEUE ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Activity size={15} className="text-teal-605 animate-pulse" />
              Recall & Preventive Outreach Queue
            </h3>
            <p className="text-[11px] text-slate-500">Automated scheduling alerts based on elapsed intervals (Scaling @ 6mo, RCT @ 1mo) — Reach out to reactivate dormant cases</p>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            <span className="text-[10px] font-bold text-slate-600 font-mono">{recalls.length} Patients Eligible</span>
          </div>
        </div>

        {recalls.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-150 rounded-xl bg-slate-50/50">
            No patients currently due for clinical recall schedules. Outstanding completed treatments are fully up to date!
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-150 rounded-xl">
            <table className="min-w-full divide-y divide-slate-150 text-left text-xs bg-slate-50/30">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3 font-semibold text-slate-550">Patient</th>
                  <th className="p-3 font-semibold text-slate-550">Last Completed Procedure</th>
                  <th className="p-3 font-semibold text-slate-550">Outreach Frequency Alert</th>
                  <th className="p-3 font-semibold text-slate-550">Recall Target Date</th>
                  <th className="p-3 font-semibold text-slate-550">Outreach Status</th>
                  <th className="p-3 font-semibold text-slate-550 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white">
                {recalls.map((item, idx) => {
                  const contactedKey = `${item.phone}-${item.reason}`;
                  const isContacted = contactedList.includes(contactedKey);
                  const isOverdue = item.isOverdue;
                  
                  // WhatsApp template message
                  const waText = `Hi ${item.name}, this is Sri Chaitanya Dental Practice. Hope you are doing well! Our records show you are due for your recommended "${item.reason}" checkup (completed on ${new Date(item.completedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}). Would you like to schedule a quick evaluation slot this week? Please let us know. Thank you!`;
                  const waUrl = `https://wa.me/91${item.phone.trim()}?text=${encodeURIComponent(waText)}`;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="p-3">
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{item.phone}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-slate-700">{item.treatment}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Done: {new Date(item.completedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-150">
                          {item.reason}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold font-mono text-slate-700">
                          {new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${
                          isOverdue 
                            ? 'bg-rose-50 text-rose-700 border-rose-150 animate-pulse' 
                            : 'bg-amber-50 text-amber-700 border-amber-150'
                        }`}>
                          {isOverdue ? 'Overdue' : 'Due Soon'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isContacted 
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {isContacted ? '📞 Outreach Initiated' : '⏳ Pending Contact'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => toggleContacted(item.phone, item.reason)}
                            className={`p-1.5 rounded-lg border transition ${
                              isContacted 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title={isContacted ? 'Mark Pending Outreach' : 'Log Contact Outcome'}
                          >
                            <UserCheck size={14} />
                          </button>
                          
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-150 hover:bg-emerald-100 transition inline-flex items-center"
                            title="Send WhatsApp Outreach"
                          >
                            <Send size={14} />
                          </a>

                          <button
                            onClick={() => openBookingModal(item)}
                            className="px-2 py-1 text-[10px] font-extrabold bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-xs transition flex items-center gap-1"
                          >
                            <CalendarPlus size={11} /> Book Slot
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Modal Overlay for Recall */}
      {bookingRecall && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-150 shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-teal-700 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CalendarPlus size={18} />
                <h4 className="font-extrabold text-xs uppercase tracking-wider">Book Recall Appointment</h4>
              </div>
              <button onClick={() => setBookingRecall(null)} className="text-white/80 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleBookRecallAppt} className="p-5 space-y-4 text-xs">
              <div>
                <p className="font-bold text-slate-800 text-sm mb-0.5">{bookingRecall.name}</p>
                <p className="text-slate-500 font-mono">Contact: {bookingRecall.phone}</p>
                <div className="mt-2 bg-teal-50 border border-teal-150 p-2 rounded-lg text-teal-800">
                  <strong>Recall Context:</strong> {bookingRecall.reason} ({bookingRecall.treatment})
                </div>
              </div>

              {bookingError && (
                <div className="bg-rose-50 text-rose-700 p-2.5 rounded-lg border border-rose-150 font-bold">
                  Error: {bookingError}
                </div>
              )}

              {bookingSuccess && (
                <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-150 font-bold">
                  {bookingSuccess}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Appointment Date</label>
                  <input
                    type="date"
                    required
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Appointment Time</label>
                  <input
                    type="time"
                    required
                    value={bookTime}
                    onChange={(e) => setBookTime(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end font-semibold">
                <button
                  type="button"
                  onClick={() => setBookingRecall(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bBooking}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm transition disabled:opacity-50"
                >
                  {bBooking ? 'Scheduling...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${admin ? 'xl:grid-cols-4' : 'lg:grid-cols-2'} gap-4`}>
        {/* Weekly appointments */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-1">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">Appointments This Week</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={20} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
              <Bar dataKey="count" name="Appointments" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Treatment breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-1">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">Treatment Progress</h3>
          {treatmentBreakdown.length > 0 ? (
            <div className="space-y-2">
              {treatmentBreakdown.slice(0, 5).map(({ name, count }, i) => {
                const max = treatmentBreakdown[0].count;
                const pct = Math.round((count / max) * 100);
                const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-600">{name}</span>
                      <span className="text-xs font-bold font-mono text-slate-800">{count}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full">
                      <div className={`h-1 rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {treatmentBreakdown.length === 0 && (
                <p className="text-slate-400 text-xs text-center py-6">No treatment data yet</p>
              )}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No treatment data</div>
          )}
        </div>

        {/* Admin-only: Weekly Collections chart */}
        {admin && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Weekly Collections</h3>
              <Link href="/crm/collections">
                <span className="text-[10px] uppercase font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">Details <ArrowUpRight size={11} /></span>
              </Link>
            </div>
            {weeklyCollectionsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={weeklyCollectionsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Collections']} />
                  <Line type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No collections data</div>
            )}
          </div>
        )}

        {/* Admin-only: Monthly revenue chart */}
        {admin && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Monthly Revenue</h3>
              <Link href="/crm/collections">
                <span className="text-[10px] uppercase font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">Details <ArrowUpRight size={11} /></span>
              </Link>
            </div>
            {monthlyCollection.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={monthlyCollection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11 }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Collections']} />
                  <Line type="monotone" dataKey="amount" stroke="#0d9488" strokeWidth={2} dot={{ fill: '#0d9488', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No revenue data</div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity size={14} className="text-teal-600" /> Quick Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Add Patient', icon: Plus, href: '/crm/patients', color: 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100' },
            { label: 'New Appointment', icon: CalendarPlus, href: '/crm/appointments', color: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100' },
            { label: 'New Treatment', icon: Stethoscope, href: '/crm/treatments', color: 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100' },
            { label: 'Search Patient', icon: Search, href: '/crm/patients', color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
            ...(admin ? [
              { label: 'Generate Bill', icon: FileText, href: '/crm/billing', color: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100' },
              { label: 'Collections', icon: DollarSign, href: '/crm/collections', color: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' },
            ] : []),
          ].map(({ label, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${color} uppercase tracking-wider`}>
                <Icon size={13} />
                {label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-150 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
            <UserCheck size={14} className="text-teal-600" /> Recent Appointments
          </h3>
          <Link href="/crm/appointments">
            <span className="text-[10px] uppercase font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">View all <ChevronRight size={11} /></span>
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recentAppointments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">No appointments yet</div>
          ) : recentAppointments.map((a: any) => (
            <div key={a.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition">
              <div className="w-8 h-8 rounded-lg bg-teal-950 border border-teal-900 text-teal-400 font-bold text-xs flex-shrink-0 flex items-center justify-center uppercase">
                {a.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{a.name}</p>
                <p className="text-[10px] text-slate-405 font-medium leading-none mt-0.5">{a.treatment || 'Consultation'} · {a.phone}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${statusColor(a.status)}`}>
                  {a.status}
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">{a.next_visit}</p>
              </div>
              {admin && a.amount_paid > 0 && (
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-xs font-bold text-emerald-600">₹{Number(a.amount_paid).toLocaleString('en-IN')}</p>
                  {a.balance_amount > 0 && <p className="text-[10px] text-rose-600 font-semibold">₹{Number(a.balance_amount).toLocaleString('en-IN')} due</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
