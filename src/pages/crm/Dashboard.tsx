import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin, isLoggedIn, getRole } from '../../lib/auth';
import { useNotification } from '../../components/NotificationProvider';
import { CLINIC_SIGNATURE, openWhatsApp } from '../../utils/whatsapp';
import { useAppointments, getLocalTodayDateString } from '../../components/AppointmentsContext';
import { startGlobalSync, stopGlobalSync } from '../../lib/syncState';
import DoctorSpecificDashboard from '../../components/DoctorSpecificDashboard';
import { motion } from 'motion/react';
import {
  Users, CalendarCheck, AlertCircle, DollarSign, UserCheck,
  Clock, CheckCircle2, Activity, TrendingUp, ArrowUpRight,
  Plus, Search, FileText, Stethoscope, CalendarPlus, ChevronRight,
  Hourglass, TriangleAlert, Bell, Send, X, RefreshCw, Shield, MessageSquare
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { usePatientsRealtime, useAppointmentsRealtime, useTreatmentsRealtime } from '../../hooks/useRealtimeHooks';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 14
    }
  }
};

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

  const {
    todayAppointments,
    updateAppointmentStatus,
    refreshAppointments,
  } = useAppointments();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    todayTotal: 0, todayPending: 0, todayCompleted: 0,
    waitingPatients: 0, inTreatment: 0, followupDue: 0,
    overdueFollowups: 0, tomorrowFollowups: 0, upcomingFollowups: 0,
    completedTreatments: 0,
    todayCollection: 0, pendingBalance: 0, monthCollection: 0,
    totalPendingPayments: 0,
    newPatientsCount: 0,
  });
  const [treatmentBreakdown, setTreatmentBreakdown] = useState<{ name: string; count: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [attendancePatterns7Days, setAttendancePatterns7Days] = useState<any[]>([]);
  const [weeklyCollectionsData, setWeeklyCollectionsData] = useState<any[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [monthlyCollection, setMonthlyCollection] = useState<any[]>([]);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);

  // Daily Huddle States (Admin Only)
  const [patientStatuses, setPatientStatuses] = useState<{ phoneMap: Record<string, string>; idMap: Record<number, string> }>({ phoneMap: {}, idMap: {} });
  const [huddleTab, setHuddleTab] = useState<'all' | 'balance' | 'followup'>('all');
  const [huddleSearch, setHuddleSearch] = useState('');
  const [huddleChecklist, setHuddleChecklist] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('sdc_huddle_checklist');
      return stored ? JSON.parse(stored) : {
        goals: false,
        charts: false,
        labs: false,
        payments: false,
      };
    } catch {
      return {
        goals: false,
        charts: false,
        labs: false,
        payments: false,
      };
    }
  });

  const toggleHuddleChecklist = (key: string) => {
    const next = { ...huddleChecklist, [key]: !huddleChecklist[key] };
    setHuddleChecklist(next);
    localStorage.setItem('sdc_huddle_checklist', JSON.stringify(next));
  };

  const handleEditUpcomingAppt = (appt: any) => {
    setEditingAppt(appt);
    setEditForm({
      id: appt.id || 0,
      name: appt.name || '',
      phone: appt.phone || '',
      treatment: appt.treatment || '',
      next_visit: appt.next_visit || '',
      appointment_time: appt.appointment_time || '',
      status: appt.status || 'Pending',
      notes: appt.notes || '',
      doctor_name: appt.doctor_name || ''
    });
  };

  const handleSaveUpcomingAppt = async (e: any) => {
    e.preventDefault();
    startGlobalSync();
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          name: editForm.name,
          phone: editForm.phone,
          treatment: editForm.treatment,
          next_visit: editForm.next_visit,
          appointment_time: editForm.appointment_time,
          status: editForm.status,
          notes: editForm.notes,
          doctor_name: editForm.doctor_name
        })
        .eq('id', editForm.id);

      if (error) throw error;

      notify('success', 'Appointment Updated', `Successfully updated upcoming slot for ${editForm.name}.`);
      setEditingAppt(null);
      fetchAll();
    } catch (err: any) {
      console.error('[Dashboard] Error updating upcoming appt:', err);
      notify('error', 'Update Failed', err.message || 'Could not update appointment.');
    } finally {
      stopGlobalSync();
    }
  };

  const handleSendWhatsAppSingle = async (appt: any) => {
    const template = `Hi ${appt.name}, this is Sri Chaitanya Dental Care. This is a friendly reminder for your upcoming ${appt.treatment || 'general consultation'} session with ${appt.doctor_name || 'Dr. Bhavani'} scheduled on ${appt.next_visit} at ${appt.appointment_time || 'your scheduled time'}. Please confirm your visit by replying.\n\n${CLINIC_SIGNATURE}`;
    openWhatsApp(appt.phone, template);

    try {
      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data?.session;
      const user = session?.user;
      
      const patientsList = hookPatients || [];
      let parsedPatientId = appt.patient_id ? Number(appt.patient_id) : null;
      if (!parsedPatientId && appt.phone) {
        const cleanPhone = appt.phone.trim();
        const matchedPatient = patientsList.find((p: any) => p.phone && p.phone.trim() === cleanPhone);
        if (matchedPatient) {
          parsedPatientId = Number(matchedPatient.id);
        }
      }
      if (!parsedPatientId && appt.name) {
        const cleanName = appt.name.trim().toLowerCase();
        const matchedPatient = patientsList.find((p: any) => p.name && p.name.trim().toLowerCase() === cleanName);
        if (matchedPatient) {
          parsedPatientId = Number(matchedPatient.id);
        }
      }

      // Validate patient_id before insert
      if (!parsedPatientId) {
        notify('warning', 'Patient Record Missing', `No matching patient record found for ${appt.name}. Skipping database insert but WhatsApp will still open.`);
        console.warn(`[Campaign] Skipping single reminder DB logging for ${appt.name} as a matching patient record was not found.`);
        return;
      }

      // Validate appointment_id before insert
      const parsedAppointmentId = appt.id ? Number(appt.id) : null;
      if (!parsedAppointmentId) {
        notify('warning', 'Appointment ID Invalid', `No valid appointment ID found. Skipping database log but opening WhatsApp.`);
        return;
      }

      const payload = {
        patient_id: parsedPatientId,
        appointment_id: parsedAppointmentId,
        phone: appt.phone,
        message: template,
        status: 'Sent',
        sent_at: new Date().toISOString()
      };

      console.log('--- WHATSAPP SINGLE REMINDER TRACE ---');
      console.log('Session exists:', !!session);
      console.log('User Role:', localStorage.getItem('userRole'));
      console.log('crmAuthMode:', localStorage.getItem('crmAuthMode'));
      console.log('WhatsApp Single Payload:', payload);

      const { data, error } = await supabase.from('whatsapp_messages').insert(payload).select();
      if (error) {
        console.error('Supabase Single Insert Error Object:', error);
        throw error;
      }
      console.log('Supabase Single Insert Success Data:', data);
      notify('success', 'Reminder Logged', `WhatsApp message successfully queued & logged in the database.`);
    } catch (err: any) {
      console.error('[Dashboard] error logging whatsapp:', err);
      notify('error', 'Campaign Failed', err.message || 'Could not queue campaign.');
    }
  };

  const getCampaignDates = () => {
    const today = new Date();
    const todayStr = getLocalTodayDateString(today);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalTodayDateString(tomorrow);
    
    const day3 = new Date(today);
    day3.setDate(day3.getDate() + 3);
    const day3Str = getLocalTodayDateString(day3);

    return { todayStr, tomorrowStr, day3Str };
  };

  const startBulkReminderCampaign = async (type: 'tomorrow' | '3days' | 'all') => {
    const { todayStr, tomorrowStr, day3Str } = getCampaignDates();
    const pendingSlots = appointments.filter((a: any) => a.status === 'Pending' && a.status !== 'Deleted');
    
    let targets: any[] = [];
    let name = '';
    if (type === 'tomorrow') {
      targets = pendingSlots.filter((a: any) => a.next_visit === tomorrowStr);
      name = "Tomorrow's Patients";
    } else if (type === '3days') {
      targets = pendingSlots.filter((a: any) => a.next_visit >= todayStr && a.next_visit <= day3Str);
      name = "3-Day Window Patients";
    } else {
      targets = pendingSlots.filter((a: any) => a.next_visit >= todayStr);
      name = "All Pending Patients";
    }

    if (targets.length === 0) {
      notify('info', 'No Targets Found', `No pending slots found requiring reminder dispatch in the specified range.`);
      return;
    }

    // Resolve details for the first valid appointment to open synchronously
    const patientsList = hookPatients || [];
    let firstValidAppt: any = null;
    let firstValidUrl = '';
    let firstValidMessage = '';

    for (const appt of targets) {
      let parsedPatientId = appt.patient_id ? Number(appt.patient_id) : null;
      if (!parsedPatientId && appt.phone) {
        const cleanPhone = appt.phone.trim();
        const matchedPatient = patientsList.find((p: any) => p.phone && p.phone.trim() === cleanPhone);
        if (matchedPatient) {
          parsedPatientId = Number(matchedPatient.id);
        }
      }
      if (!parsedPatientId && appt.name) {
        const cleanName = appt.name.trim().toLowerCase();
        const matchedPatient = patientsList.find((p: any) => p.name && p.name.trim().toLowerCase() === cleanName);
        if (matchedPatient) {
          parsedPatientId = Number(matchedPatient.id);
        }
      }

      if (parsedPatientId && appt.phone) {
        firstValidAppt = appt;
        firstValidMessage = `Hi ${appt.name}, this is Sri Chaitanya Dental Care. This is a friendly reminder for your upcoming ${appt.treatment || 'general consultation'} session with ${appt.doctor_name || 'Dr. Bhavani'} scheduled on ${appt.next_visit} at ${appt.appointment_time || 'your scheduled time'}. Please confirm your visit by replying.\n\n${CLINIC_SIGNATURE}`;
        break;
      }
    }

    if (!firstValidAppt) {
      notify('warning', 'No Valid Patients Linked', 'None of the target appointments are linked to active patient profiles. Skipping campaign logged execution.');
      return;
    }

    // Open first reminder URL using audited and sanitized utility
    openWhatsApp(firstValidAppt.phone, firstValidMessage);

    startGlobalSync();
    try {
      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data?.session;
      const user = session?.user;

      const messageList: any[] = [];

      for (const appt of targets) {
        let parsedPatientId = appt.patient_id ? Number(appt.patient_id) : null;
        
        if (!parsedPatientId && appt.phone) {
          const cleanPhone = appt.phone.trim();
          const matchedPatient = patientsList.find((p: any) => p.phone && p.phone.trim() === cleanPhone);
          if (matchedPatient) {
            parsedPatientId = Number(matchedPatient.id);
          }
        }
        
        if (!parsedPatientId && appt.name) {
          const cleanName = appt.name.trim().toLowerCase();
          const matchedPatient = patientsList.find((p: any) => p.name && p.name.trim().toLowerCase() === cleanName);
          if (matchedPatient) {
            parsedPatientId = Number(matchedPatient.id);
          }
        }

        // If patient record is missing: Skip record, Show warning/toast, Continue campaign
        if (!parsedPatientId) {
          notify('warning', 'Patient Skipped', `No patient record found for ${appt.name}. Skipping reminder logging in campaign.`);
          console.warn(`[Campaign] Skipping reminder for ${appt.name} as a matching patient record was not found.`);
          continue;
        }

        // Validate appointment_id before insert
        const parsedApptId = appt.id ? Number(appt.id) : null;
        if (!parsedApptId) {
          notify('warning', 'Appointment Skipped', `No valid appointment ID for ${appt.name}. Skipping reminder logging in campaign.`);
          console.warn(`[Campaign] Skipping reminder for ${appt.name} as a valid appointment ID was not found.`);
          continue;
        }

        const txt = `Hi ${appt.name}, this is Sri Chaitanya Dental Care. This is a friendly reminder for your upcoming ${appt.treatment || 'general consultation'} session with ${appt.doctor_name || 'Dr. Bhavani'} scheduled on ${appt.next_visit} at ${appt.appointment_time || 'your scheduled time'}. Please confirm your visit by replying.\n\n${CLINIC_SIGNATURE}`;
        
        messageList.push({
          patient_id: parsedPatientId,
          appointment_id: parsedApptId,
          phone: appt.phone,
          message: txt,
          status: 'Sent',
          sent_at: new Date().toISOString()
        });
      }

      if (messageList.length === 0) {
        notify('error', 'Campaign Execution Blocked', 'None of the selected appointments are linked to active patient profiles. Campaign aborted.');
        return;
      }

      console.log('--- WHATSAPP BULK CAMPAIGN TRACE ---');
      console.log('Session exists:', !!session);
      console.log('User Role:', localStorage.getItem('userRole'));
      console.log('crmAuthMode:', localStorage.getItem('crmAuthMode'));
      console.log('WhatsApp Campaign Payload:', messageList);

      const { data, error } = await supabase.from('whatsapp_messages').insert(messageList).select();
      if (error) {
        console.error('Supabase Campaign Insert Error Object:', error);
        throw error;
      }
      console.log('Supabase Campaign Insert Success Data:', data);

      notify('success', 'Campaign Processed!', `Successfully logged & queued ${messageList.length} reminders for ${name} in database.`);
    } catch (err: any) {
      console.error('[Dashboard] campaign error:', err);
      notify('error', 'Campaign Failed', err.message || 'Could not queue campaign.');
    } finally {
      stopGlobalSync();
    }
  };

  // Recall Queue states
  const [recalls, setRecalls] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
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

  const { patients: hookPatients } = usePatientsRealtime();
  const { appointments: hookAppointments } = useAppointmentsRealtime();
  const { treatments: hookTreatments } = useTreatmentsRealtime();

  // Unified appointments lists and filters for future-proof upcoming tracking
  const appointments = hookAppointments || [];
  const currentTodayStr = getLocalTodayDateString();

  const [upcomingFilter, setUpcomingFilter] = useState<'tomorrow' | '3days' | '7days' | '30days' | 'all'>('all');
  const [upcomingSearch, setUpcomingSearch] = useState('');
  const [viewingAppt, setViewingAppt] = useState<any | null>(null);
  const [editingAppt, setEditingAppt] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    id: 0,
    name: '',
    phone: '',
    treatment: '',
    next_visit: '',
    appointment_time: '',
    status: '',
    notes: '',
    doctor_name: ''
  });
  const [doctors, setDoctors] = useState<any[]>([]);

  const upcomingAppointments = appointments.filter(
    (a: any) => a.next_visit >= currentTodayStr && a.status !== 'Deleted'
  ).sort((a: any, b: any) => a.next_visit.localeCompare(b.next_visit) || (a.appointment_time || '').localeCompare(b.appointment_time || ''));

  const todayVal = new Date();
  const todayStr = currentTodayStr;

  const tomorrowVal = new Date(todayVal);
  tomorrowVal.setDate(tomorrowVal.getDate() + 1);
  const tomorrowStr = getLocalTodayDateString(tomorrowVal);

  const next3Val = new Date(todayVal);
  next3Val.setDate(next3Val.getDate() + 3);
  const next3Str = getLocalTodayDateString(next3Val);

  const next7Val = new Date(todayVal);
  next7Val.setDate(next7Val.getDate() + 7);
  const next7Str = getLocalTodayDateString(next7Val);

  const next30Val = new Date(todayVal);
  next30Val.setDate(next30Val.getDate() + 30);
  const next30Str = getLocalTodayDateString(next30Val);

  const filteredUpcoming = upcomingAppointments.filter((appt: any) => {
    // Apply search filter
    const searchLower = upcomingSearch.toLowerCase();
    const matchesSearch = 
      appt.name.toLowerCase().includes(searchLower) ||
      appt.phone.toLowerCase().includes(searchLower) ||
      (appt.treatment || '').toLowerCase().includes(searchLower) ||
      (appt.doctor_name || '').toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Apply date filter
    const dStr = appt.next_visit;
    if (upcomingFilter === 'tomorrow') {
      return dStr === tomorrowStr;
    } else if (upcomingFilter === '3days') {
      return dStr >= todayStr && dStr <= next3Str;
    } else if (upcomingFilter === '7days') {
      return dStr >= todayStr && dStr <= next7Str;
    } else if (upcomingFilter === '30days') {
      return dStr >= todayStr && dStr <= next30Str;
    }
    return true; // all
  });

  const tomorrowPendingCount = upcomingAppointments.filter((a: any) => a.next_visit === tomorrowStr && a.status === 'Pending').length;
  const next3PendingCount = upcomingAppointments.filter((a: any) => a.next_visit >= todayStr && a.next_visit <= next3Str && a.status === 'Pending').length;
  const allPendingCount = upcomingAppointments.filter((a: any) => a.status === 'Pending').length;

  useEffect(() => {
    console.log('All appointments:', appointments);
    console.log('Upcoming appointments:', upcomingAppointments);
  }, [appointments, upcomingAppointments]);

  useEffect(() => {
    if (!isLoggedIn()) { setLocation('/admin'); return; }
    console.info("[Dashboard] Reactive hook change registered. Initiating aggregate dashboard calculations.");
    fetchAll();
  }, [hookPatients, hookAppointments, hookTreatments, setLocation]);

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
    const tomorrowStr = getLocalTodayDateString(new Date(Date.now() + 86400000));
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
        // Match exactly by both Phone and Name to handle shared phone numbers
        const { data: existingPatients } = await supabase
          .from('patients')
          .select('id, email, location')
          .eq('phone', bookingRecall.phone)
          .eq('name', bookingRecall.name);
        
        let existing = existingPatients?.[0];
        if (!existing) {
          // Fallback to match by phone only
          const { data: fallbackPatients } = await supabase
            .from('patients')
            .select('id, email, location')
            .eq('phone', bookingRecall.phone);
          existing = fallbackPatients?.[0];
        }

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
      const today = getLocalTodayDateString();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = getLocalTodayDateString(tomorrow);
      const next7 = new Date(); next7.setDate(next7.getDate() + 7);
      const next7Str = getLocalTodayDateString(next7);
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStartStr = getLocalTodayDateString(monthStart);

      console.info(`[Dashboard] [DEBUG] fetchAll() started query. Computed local-time dates: today=${today}, tomorrow=${tomorrowStr}, next7=${next7Str}, monthStartStr=${monthStartStr}`);

      const [
        patientsRes, todayRes, todayPendingRes, todayCompletedRes,
        waitingRes, inTreatRes, overdueRes, tomorrowRes, upcomingRes,
        completedRes, recentRes, weekRes, monthlyRes,
        treatmentsRes, allAppointmentsRes,
        huddlePatientsRes,
        recentPatientsRes,
        inventoryRes
      ] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).neq('status', 'Cancelled').neq('status', 'Deleted'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Completed'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', today).eq('status', 'Pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'In Treatment'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).lt('next_visit', today).not('status', 'in', '("Completed","Cancelled","Deleted")'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('next_visit', tomorrowStr).not('status', 'in', '("Completed","Cancelled","Deleted")'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gt('next_visit', tomorrowStr).lte('next_visit', next7Str).neq('status', 'Cancelled').neq('status', 'Deleted'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'Completed'),
        supabase.from('appointments').select('*').neq('status', 'Deleted').order('created_at', { ascending: false }).limit(6),
        supabase.from('appointments').select('next_visit, status, treatment, amount_paid, balance_amount').neq('status', 'Deleted').order('next_visit', { ascending: false }).limit(300),
        admin ? supabase.from('appointments').select('next_visit, amount_paid, balance_amount').gte('next_visit', monthStartStr).neq('status', 'Deleted') : Promise.resolve({ data: [] }),
        supabase.from('treatments').select('*'),
        supabase.from('appointments').select('*').neq('status', 'Deleted'),
        supabase.from('patients').select('id, phone, patient_status'),
        supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(6),
        Promise.resolve(supabase.from('inventory').select('*')).then((res) => {
          if (res.error) {
            console.warn('[Dashboard] Inventory fetch failed or was blocked by RLS policies. Defaulting gracefully:', res.error);
            try {
              const rawLocal = localStorage.getItem('srichaitanya_local_inventory');
              if (rawLocal) {
                return { data: JSON.parse(rawLocal), error: null };
              }
            } catch (lex) {}
            return { data: [], error: null };
          }
          return res;
        }).catch(() => {
          try {
            const rawLocal = localStorage.getItem('srichaitanya_local_inventory');
            if (rawLocal) {
              return { data: JSON.parse(rawLocal), error: null };
            }
          } catch (lex) {}
          return { data: [], error: null };
        })
      ]);

      console.info(`[Dashboard] [DEBUG] fetchAll() completed query. Raw counts returned - allAppointments total size: ${allAppointmentsRes.data?.length || 0}, todayRes count: ${todayRes.count || 0}, recentRes count: ${recentRes.data?.length || 0}`);

      const statusMap: Record<string, string> = {};
      const statusIdMap: Record<number, string> = {};
      if (huddlePatientsRes && huddlePatientsRes.data) {
        huddlePatientsRes.data.forEach((p: any) => {
          if (p.phone) {
            statusMap[p.phone.trim()] = p.patient_status;
          }
          if (p.id) {
            statusIdMap[p.id] = p.patient_status;
          }
        });
      }
      setPatientStatuses({ phoneMap: statusMap, idMap: statusIdMap });

      const allData = weekRes.data || [];

      // Weekly appointments chart
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = getLocalTodayDateString(d);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const count = allData.filter((a: any) => a.next_visit === key).length;
        days.push({ day: label, count });
      }
      setWeeklyData(days);

      // 7-day daily appointment counts and attendance patterns for Recharts BarChart
      const patterns7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = getLocalTodayDateString(d);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        
        // Filter appointments on this specific day
        const dayAppts = allData.filter((a: any) => a.next_visit === key);
        const total = dayAppts.length;
        const attended = dayAppts.filter((a: any) => a.status === 'Completed').length;
        const missedOrCancelled = dayAppts.filter((a: any) => a.status === 'Cancelled' || a.status === 'Deleted').length;
        const pendingOrInTreatment = dayAppts.filter((a: any) => a.status === 'Pending' || a.status === 'In Treatment').length;

        patterns7Days.push({
          date: label,
          Total: total,
          Attended: attended,
          'Missed / Cancelled': missedOrCancelled,
          'Pending / In Treatment': pendingOrInTreatment,
        });
      }
      setAttendancePatterns7Days(patterns7Days);

      // Weekly collections chart (daily collections for active week)
      if (admin) {
        const collectionsWeek = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const key = getLocalTodayDateString(d);
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

      const todayAppointmentsFetched = (allAppointmentsRes.data || []).filter((a: any) => a.next_visit === today);
      const computedTodayTotal = todayAppointmentsFetched.filter((a: any) => a.status !== 'Cancelled' && a.status !== 'Deleted').length;
      const computedTodayPending = todayAppointmentsFetched.filter((a: any) => a.status === 'Pending').length;
      const computedTodayCompleted = todayAppointmentsFetched.filter((a: any) => a.status === 'Completed').length;
      const totalPendingPayments = (allAppointmentsRes.data || []).reduce((t: number, a: any) => t + Number(a.balance_amount || 0), 0);

      // Query actual new clinical registrations since month start
      let monthNewPatients = 0;
      try {
        const { count } = await supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStartStr);
        monthNewPatients = count || 0;
      } catch (err) {
        console.warn("Bypassed dynamic monthly registrations lookup:", err);
      }

      console.info(`[Dashboard] [DEBUG] todayAppointmentsFetched length: ${todayAppointmentsFetched.length}, computedTodayTotal: ${computedTodayTotal}, computedTodayPending: ${computedTodayPending}, computedTodayCompleted: ${computedTodayCompleted}, totalPendingPayments: ${totalPendingPayments}, monthNewPatients: ${monthNewPatients}`);

      setStats({
        totalPatients: patientsRes.count || 0,
        totalAppointments: allAppointmentsRes.data?.length || 0,
        todayTotal: computedTodayTotal,
        todayPending: computedTodayPending,
        todayCompleted: computedTodayCompleted,
        waitingPatients: waitingRes.count || 0,
        inTreatment: inTreatRes.count || 0,
        followupDue: overdueRes.count || 0,
        overdueFollowups: overdueRes.count || 0,
        tomorrowFollowups: tomorrowRes.count || 0,
        upcomingFollowups: (allAppointmentsRes.data || []).filter((a: any) => a.next_visit > today && a.next_visit <= next7Str && !['Completed', 'Cancelled', 'Deleted'].includes(a.status || '')).length,
        completedTreatments: completedRes.count || 0,
        todayCollection, pendingBalance, monthCollection,
        totalPendingPayments,
        newPatientsCount: monthNewPatients,
      });

      // Silently sync the appointments provider context
      refreshAppointments().catch((err) => {
        console.error('[Dashboard] [DEBUG] [ERROR] syncing appointments context:', err);
      });

      let lowStockAlerts: any[] = [];
      if (inventoryRes && inventoryRes.data) {
        lowStockAlerts = inventoryRes.data.filter((item: any) => {
          const currentStock = item.current_stock !== undefined && item.current_stock !== null 
            ? item.current_stock 
            : (item.stock !== undefined && item.stock !== null ? item.stock : (item.quantity ?? 0));
          const limit = item.safety_min_limit !== undefined && item.safety_min_limit !== null 
            ? item.safety_min_limit 
            : (item.min_stock !== undefined && item.min_stock !== null ? item.min_stock : (item.reorder_level ?? 0));
          return currentStock < limit;
        });

        // Normalize model objects to include all potential formats (name/item_name, stock/current_stock, min_stock/safety_min_limit)
        lowStockAlerts = lowStockAlerts.map((item: any) => ({
          ...item,
          name: item.name || item.item_name || 'Unnamed Item',
          stock: item.current_stock !== undefined && item.current_stock !== null 
            ? item.current_stock 
            : (item.stock !== undefined && item.stock !== null ? item.stock : (item.quantity ?? 0)),
          min_stock: item.safety_min_limit !== undefined && item.safety_min_limit !== null 
            ? item.safety_min_limit 
            : (item.min_stock !== undefined && item.min_stock !== null ? item.min_stock : (item.reorder_level ?? 0)),
        }));
      }
      setLowStockItems(lowStockAlerts);

      setRecentAppointments(recentRes.data || []);
      setRecentPatients(recentPatientsRes.data || []);

      // Fetch Dr names and IDs
      const doctorsRes = await supabase.from('doctors').select('*');
      if (doctorsRes.data) {
        setDoctors(doctorsRes.data);
      } else {
        setDoctors([
          { id: '1', name: 'Dr. Bhavani Prasad (MDS)' },
          { id: '2', name: 'Dr. Chaitanya Prasad (BDS)' },
          { id: '3', name: 'Dr. Srilatha' }
        ]);
      }

      // Compute Daily appointment volume and clinic attendance patterns for last 10 operating days
      const trends = [];
      const nowIdx = new Date();
      for (let i = 9; i >= 0; i--) {
        const d = new Date();
        d.setDate(nowIdx.getDate() - i);
        const key = getLocalTodayDateString(d);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        
        const dayAppts = (allAppointmentsRes.data || []).filter((a: any) => a.next_visit === key);
        const volume = dayAppts.length;
        const attended = dayAppts.filter((a: any) => a.status === 'Completed' || a.status === 'Confirmed').length;
        const noShow = dayAppts.filter((a: any) => a.status === 'No Show' || a.status === 'Cancelled').length;
        const revenue = dayAppts.reduce((sum: number, a: any) => sum + Number(a.amount_paid || 0), 0);
        
        trends.push({
          date: label,
          volume,
          attended,
          noShow,
          revenue
        });
      }
      setDailyTrends(trends);

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

      const todayStr = getLocalTodayDateString();

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
        const dueDateStr = getLocalTodayDateString(dueDate);

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

  const formatRoleLabel = (r: string) => {
    if (r === 'admin') return 'Practice Admin';
    if (r === 'doctor') return 'Doctor / Surgeon';
    if (r === 'receptionist') return 'Front Desk Receptionist';
    if (r === 'assistant') return 'Dental Assistant';
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Staff';
  };

  // Doctors will now render their highly specialized klinic dashboard layout
  if (role === 'doctor') {
    return <DoctorSpecificDashboard />;
  }

  return (
    <div className="space-y-6 pb-6">

      {/* CRM Dashboard Welcome Banner */}
      <div className="bg-[#2F63E0] rounded-2xl p-6 text-white relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <svg className="w-28 h-28 text-white rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a4 4 0 0 0-4 4c0 .82.11 1.48.33 1.83.33.5.67.67.67 1.17 0 1-.61 1.54-1.22 2.6A9 9 0 0 0 7 16c0 3 2 5 4.5 5 .5 0 .9-.2 1.5-.5.6.3 1 .5 1.5.5 2.5 0 4.5-2 4.5-5a9 9 0 0 0-.78-4.4c-.61-1.06-1.22-1.6-1.22-2.6 0-.5.34-.67.67-1.17.22-.35.33-1 .33-1.83a4 4 0 0 0-4-4h-2z" />
          </svg>
        </div>
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome back, Sri Chaitanya Dental Care!
          </h2>
          <p className="text-xs sm:text-sm text-white/90 mt-1 font-medium pb-1.5">
            Here is your clinic overview for {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        </div>
      </div>

      {/* Quick Clinic Status Summary Row */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-[#111827] tracking-tight font-sans">
          Quick Clinic Status
        </h3>
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Card 1: Total Registered Patients */}
          <motion.div variants={cardVariants} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Registered Patients</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-slate-800 font-sans">{stats.totalPatients}</span>
                <span className="text-[10px] font-bold text-teal-600">+Active Directory</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100/45">
              <Users size={18} strokeWidth={2.5} />
            </div>
          </motion.div>

          {/* Card 2: Today's Appointments */}
          <motion.div variants={cardVariants} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Today's Appointments</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-[#2F63E0] font-sans">{todayAppointments.length}</span>
                <span className="text-[10px] font-bold text-[#2F63E0]/80">Active Sessions</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2F63E0] flex items-center justify-center border border-blue-100/45">
              <CalendarCheck size={18} strokeWidth={2.5} />
            </div>
          </motion.div>

          {/* Card 3: Pending Payments */}
          <motion.div variants={cardVariants} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pending Payments (Dues)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-[#EF4444] font-sans">
                  ₹{Number(stats.totalPendingPayments || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-bold text-[#EF4444]/80">Outstanding</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#EF4444] flex items-center justify-center border border-red-100/45">
              <DollarSign size={18} strokeWidth={2.5} />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Quick Action Buttons Section */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-[#111827] tracking-tight font-sans">
          Quick Actions
        </h3>
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={cardVariants}>
            <Link href="/crm/appointments">
              <button className="w-full flex items-center justify-between p-4.5 rounded-[12px] bg-[#2F63E0] hover:bg-[#2554CC] text-white font-semibold transition-all shadow-sm active:scale-98 cursor-pointer group text-xs text-left">
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-base">🗓️</span>
                  <span>Schedule Appointment</span>
                </span>
                <ChevronRight size={15} className="text-white/75 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </motion.div>

          <motion.div variants={cardVariants}>
            <Link href="/crm/patients">
              <button className="w-full flex items-center justify-between p-4.5 rounded-[12px] bg-gradient-to-r from-[#8757EA] to-[#8B5CF6] hover:opacity-95 text-white font-semibold transition-all shadow-sm active:scale-98 cursor-pointer group text-xs text-left">
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-base">👥</span>
                  <span>Add New Patient</span>
                </span>
                <ChevronRight size={15} className="text-white/75 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </motion.div>

          <motion.div variants={cardVariants}>
            <Link href="/crm/profile">
              <button className="w-full flex items-center justify-between p-4.5 rounded-[12px] bg-gradient-to-r from-[#1FA0DD] to-[#22A7F0] hover:opacity-95 text-white font-semibold transition-all shadow-sm active:scale-98 cursor-pointer group text-xs text-left">
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-base">⚙️</span>
                  <span>Clinic Profile</span>
                </span>
                <ChevronRight size={15} className="text-white/75 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Statistics Cards Section */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-[#111827] tracking-tight font-sans">
          Daily Metrics
        </h3>
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Card 1: Today's Appointments */}
          <motion.div variants={cardVariants} className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] shadow-xs flex flex-col items-center justify-center min-h-[140px]">
            <p className="text-[52px] font-extrabold text-[#2F63E0] leading-none mb-1 font-sans">
              {todayAppointments.length}
            </p>
            <p className="text-[10px] font-bold text-[#6B7280] tracking-widest uppercase">
              Today's Appointments
            </p>
          </motion.div>

          {/* Card 2: Total Patients */}
          <motion.div variants={cardVariants} className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] shadow-xs flex flex-col items-center justify-center min-h-[140px]">
            <p className="text-[52px] font-extrabold text-[#14B874] leading-none mb-1 font-sans">
              {stats.totalPatients}
            </p>
            <p className="text-[10px] font-bold text-[#6B7280] tracking-widest uppercase">
              Total Patients
            </p>
          </motion.div>

          {/* Card 3: Total Appointments */}
          <motion.div variants={cardVariants} className="bg-white rounded-[12px] p-6 border border-[#E5E7EB] shadow-xs flex flex-col items-center justify-center min-h-[140px]">
            <p className="text-[52px] font-extrabold text-[#8757EA] leading-none mb-1 font-sans">
              {stats.totalAppointments}
            </p>
            <p className="text-[10px] font-bold text-[#6B7280] tracking-widest uppercase">
              Total Appointments
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* ── SRI CHAITANYA CLINICAL DAILY HUDDLE (ADMIN ONLY) ── */}
      {admin && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono font-bold tracking-widest text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full uppercase">
                  MANAGEMENT COMMAND CENTER
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-700 font-mono font-bold">Active Board</span>
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm mt-1 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                <Activity size={15} className="text-amber-500 animate-pulse" /> Today's Clinical Daily Huddle
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed font-semibold">
                An exclusive administrative command center to align morning briefings, audit chart readiness, prioritize revenue collections, and secure follow-up checkups.
              </p>
            </div>

            <div className="text-right flex items-center md:flex-col gap-2 md:gap-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Huddle Date</span>
              <span className="text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Huddle Briefing Dashboard Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Today's Huddle Volume</span>
                <span className="bg-blue-50 text-blue-700 p-1.5 rounded-lg border border-blue-200">
                  <Users size={12} />
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-slate-800 mt-1">
                {todayAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'Deleted').length} Patients
              </p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">Scheduled clinical sessions today</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-amber-700 tracking-wider">Financial Priorities</span>
                <span className="bg-amber-50 text-amber-700 p-1.5 rounded-lg border border-amber-200">
                  <DollarSign size={12} />
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-amber-700 mt-1">
                ₹{todayAppointments
                  .filter(a => a.status !== 'Cancelled' && a.status !== 'Deleted')
                  .reduce((sum, a) => sum + Number(a.balance_amount || 0), 0)
                  .toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">
                {todayAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'Deleted' && Number(a.balance_amount || 0) > 0).length} accounts with outstanding dues
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-rose-700 tracking-wider">Clinical Follow-up Alerts</span>
                <span className="bg-rose-50 text-rose-700 p-1.5 rounded-lg border border-rose-200">
                  <Bell size={12} />
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-rose-700 mt-1">
                {todayAppointments.filter(a => {
                  const cleanedPhone = a.phone?.trim() || '';
                  const st = patientStatuses.phoneMap[cleanedPhone] || patientStatuses.idMap[a.patient_id!] || '';
                  return st === 'Follow-up Required';
                }).length} Required
              </p>
              <p className="text-[10px] text-slate-450 mt-1 font-semibold">Active clinical follow-up records scheduled</p>
            </div>
          </div>

          {/* Interactive Huddle Planning checklist */}
          <div className="bg-white rounded-xl border border-slate-200 p-4.5 space-y-3">
            <h4 className="text-[10.5px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-slate-455" /> Morning Huddle Alignment Checklist
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'goals', label: 'Review Collection Goals', desc: 'Brief receptionist desk' },
                { key: 'charts', label: 'Inspect Diagnostic Charts', desc: 'Confirm clinical consents' },
                { key: 'labs', label: 'Verify Prosthetic Lab Deliveries', desc: 'Check crown/onlay statuses' },
                { key: 'payments', label: 'Confirm UPI/POS Payment Mode', desc: 'Ensure registers are active' },
              ].map(item => (
                <div
                  key={item.key}
                  onClick={() => toggleHuddleChecklist(item.key)}
                  className={`border rounded-xl p-3 flex flex-col justify-between gap-1 cursor-pointer transition select-none
                    ${huddleChecklist[item.key]
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-colors
                      ${huddleChecklist[item.key]
                        ? 'bg-emerald-600 border-transparent text-white'
                        : 'bg-white border-slate-300'}`}
                    >
                      {huddleChecklist[item.key] && (
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[11px] font-bold line-clamp-2 leading-tight">{item.label}</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-1 italic pl-5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Huddle Filtered Schedule Viewer */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-3">
            <div className="bg-slate-50/50 px-4.5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: "All Today's Huddle", count: todayAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'Deleted').length, color: 'hover:bg-slate-100 text-slate-700 border-slate-300' },
                  { id: 'balance', label: 'Outstanding Dues Only', count: todayAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'Deleted' && Number(a.balance_amount || 0) > 0).length, color: 'hover:bg-amber-50 text-amber-800 border-amber-205 bg-amber-50/30' },
                  { id: 'followup', label: 'Clinical Follow-ups Only', count: todayAppointments.filter(a => {
                    const cleanedPhone = a.phone?.trim() || '';
                    const st = patientStatuses.phoneMap[cleanedPhone] || patientStatuses.idMap[a.patient_id!] || '';
                    return st === 'Follow-up Required';
                  }).length, color: 'hover:bg-rose-50 text-rose-800 border-rose-205 bg-rose-50/30' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHuddleTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase transition flex items-center gap-1.5 cursor-pointer select-none
                      ${huddleTab === tab.id
                        ? tab.id === 'balance' ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : tab.id === 'followup' ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : tab.color}`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold
                      ${huddleTab === tab.id
                        ? 'bg-white/20 text-white'
                        : tab.id === 'balance' ? 'bg-amber-100 text-amber-800'
                        : tab.id === 'followup' ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-600'}`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Dynamic search inside the daily schedule */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter huddle schedule..."
                  value={huddleSearch}
                  onChange={(e) => setHuddleSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-teal-500 text-xs text-slate-800"
                />
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>

            {/* In-Line List View of patients representing the filtered list */}
            <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
              {(() => {
                const query = huddleSearch.toLowerCase().trim();
                const filtered = todayAppointments
                  .filter(a => a.status !== 'Cancelled' && a.status !== 'Deleted')
                  .filter(appt => {
                    // Match Tab
                    if (huddleTab === 'balance') {
                      return Number(appt.balance_amount || 0) > 0;
                    }
                    if (huddleTab === 'followup') {
                      const st = patientStatuses.phoneMap[appt.phone?.trim() || ''] || patientStatuses.idMap[appt.patient_id!] || '';
                      return st === 'Follow-up Required';
                    }
                    return true;
                  })
                  .filter(appt => {
                    // Match Search Query
                    if (!query) return true;
                    return (
                      appt.name?.toLowerCase().includes(query) ||
                      appt.phone?.toLowerCase().includes(query) ||
                      appt.treatment?.toLowerCase().includes(query)
                    );
                  });

                if (filtered.length === 0) {
                  return (
                    <div className="py-10 text-center text-slate-400 text-xs font-semibold">
                      {huddleTab === 'balance' ? 'No patients with outstanding balances scheduled today.' :
                        huddleTab === 'followup' ? 'No patients with active clinical follow-up flags scheduled today.' :
                        'No matching patients found in this morning huddle filter.'}
                    </div>
                  );
                }

                return filtered.map((appt) => {
                  const cleanedPhone = appt.phone?.trim() || '';
                  const pStatus = patientStatuses.phoneMap[cleanedPhone] || patientStatuses.idMap[appt.patient_id!] || '';
                  const hasBalance = Number(appt.balance_amount || 0) > 0;
                  const isFollowup = pStatus === 'Follow-up Required';

                  return (
                    <div
                      key={`huddle-row-${appt.id}`}
                      className={`px-4.5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/50 transition border-l-4
                        ${isFollowup ? 'border-l-rose-500 bg-rose-50/20' :
                        hasBalance ? 'border-l-amber-500 bg-amber-50/10' :
                        'border-l-teal-500 bg-white'}`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl font-bold flex-shrink-0 flex items-center justify-center uppercase border text-xs
                          ${isFollowup ? 'bg-rose-950 border-rose-900 text-rose-450' :
                          hasBalance ? 'bg-amber-950 border-amber-900 text-amber-400' :
                          'bg-teal-950 border-teal-900 text-teal-400'}`}
                        >
                          {appt.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 font-sans">
                            <span className="text-xs font-bold text-slate-800">{appt.name || 'Unknown Patient'}</span>
                            <span className="text-[10px] font-mono text-slate-400">({appt.appointment_time || '10:00 AM'})</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-none">
                            Procedure: <strong className="text-slate-700 font-bold">{appt.treatment || 'Consultation'}</strong> · {appt.phone || 'No Contact'}
                          </p>

                          {/* Detail Highlighting Tags */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {hasBalance && (
                              <span className="text-[9px] font-bold text-amber-805 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 uppercase">
                                <DollarSign size={9} /> Dues Outstanding: ₹{Number(appt.balance_amount).toLocaleString('en-IN')}
                              </span>
                            )}
                            {isFollowup && (
                              <span className="text-[9px] font-bold text-rose-805 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1 uppercase">
                                <Bell size={9} /> Clinical Follow-Up Required
                              </span>
                            )}
                            {!hasBalance && !isFollowup && (
                              <span className="text-[9px] font-bold text-teal-800 bg-teal-50 border border-teal-150 px-2 py-0.5 rounded uppercase font-semibold">
                                Clean Account Balance
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Side quick administrative action controls */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* WhatsApp / Phone trigger */}
                        <a
                          href={`https://wa.me/91${cleanedPhone.replace(/[\s-+]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white hover:bg-emerald-50 text-emerald-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer select-none"
                        >
                          <Send size={11} className="text-emerald-600" /> WhatsApp Direct
                        </a>

                        {/* Bill routing */}
                        <Link href="/crm/billing">
                          <span className="bg-white hover:bg-amber-50 text-amber-800 font-bold text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer select-none">
                            <FileText size={11} className="text-amber-600" /> Billing Center
                          </span>
                        </Link>

                        {/* Complete queue shortcut */}
                        <button
                          type="button"
                          onClick={() => {
                            if (appt.status === 'Pending') {
                              updateAppointmentStatus(appt.id, 'In Treatment');
                            } else if (appt.status === 'In Treatment') {
                              updateAppointmentStatus(appt.id, 'Completed');
                            }
                          }}
                          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer select-none border
                            ${appt.status === 'Pending' ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' :
                            appt.status === 'In Treatment' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' :
                            'bg-slate-50 text-slate-400 border-slate-200 pointer-events-none'}`}
                        >
                          {appt.status === 'Pending' ? 'Start Tx' : appt.status === 'In Treatment' ? 'Complete Tx' : 'Handled'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Specific Doctor-Only Insights */}
      {(role as string) === 'doctor' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Clinical Performance & Treatment Success Rates */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Activity size={13} className="text-indigo-600" />
                  Clinical Resolution Rate
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">Symptom-free post-op care benchmarks</p>
              </div>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-indigo-100">
                100% Verified
              </span>
            </div>

            <div className="flex items-center gap-4 py-1">
              <div className="relative flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" className="stroke-slate-100" strokeWidth="6" fill="transparent" />
                  <circle cx="32" cy="32" r="28" className="stroke-indigo-600" strokeWidth="6" fill="transparent"
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={2 * Math.PI * 28 * (1 - 0.984)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-slate-800 text-xs font-black">98.4%</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 text-xs font-extrabold">Active Success Index</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Based on {stats.completedTreatments || 12} resolved clinical courses and follow-up tracking.</p>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-2.5 text-[11px]">
              {[
                { title: 'Root Canal Endodontics (RCT)', rate: '98.2%' },
                { title: 'Surgical Extractions Recovery', rate: '99.1%' },
                { title: 'Porous/Aesthetic Restorations', rate: '97.5%' },
                { title: 'Orthodontic Realignment Index', rate: '100%' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-600 font-medium py-0.5">
                  <span className="truncate pr-1">{item.title}</span>
                  <span className="font-mono font-bold text-slate-900 flex-shrink-0">{item.rate}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Operational Clinical Velocity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-shrink-0">
              <div>
                <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Clock size={13} className="text-sky-600" />
                  Chair-time Allocation
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">Session duration & utilization</p>
              </div>
              <span className="bg-sky-50 text-sky-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-sky-100">
                Shift: Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-50 border p-2 rounded-xl border-slate-200">
                <p className="text-[9px] uppercase text-slate-450 font-bold tracking-wider">Avg Session</p>
                <p className="text-sm font-black text-slate-800 mt-0.5 font-mono">35 mins</p>
                <p className="text-[9px] text-emerald-600 mt-0.5 font-semibold">Optimal Speed</p>
              </div>
              <div className="bg-slate-50 border p-2 rounded-xl border-slate-200">
                <p className="text-[9px] uppercase text-slate-455 font-bold tracking-wider">Sessions Done</p>
                <p className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                  {recalls.reduce((done, r) => done + (r.sessions_done || 1), 0) + 4}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 font-medium">This Week</p>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-2 text-[10.5px]">
              <div>
                <div className="flex justify-between font-semibold text-slate-600 mb-1">
                  <span>Daily Chair Capacity (8h)</span>
                  <span className="font-mono font-bold text-slate-800">{Math.min(100, Math.round((todayAppointments.length * 35) / 480 * 100))}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round((todayAppointments.length * 35) / 480 * 100))}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Doctor's Clinical Advice Watchlist */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Stethoscope size={13} className="text-teal-605" />
                  Clinical Action Items
                </h4>
                <p className="text-[10px] text-slate-400 font-medium">Critical patient files requiring chart oversight</p>
              </div>
            </div>

            <div className="space-y-2 max-h-[145px] overflow-y-auto pr-1">
              {todayAppointments.length > 0 ? (
                todayAppointments.slice(0, 3).map((appt, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-teal-50/40 border border-teal-100/50">
                    <span className="w-3.5 h-3.5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-850 truncate">{appt.name}</p>
                      <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">Review {appt.treatment || 'dental history log'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                  All surgical records & charts cleared! No immediate actions.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* KPI & Clinical Metrics Grid Block */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Appointments", value: stats.todayTotal, icon: CalendarCheck, color: 'text-blue-600', bg: 'bg-blue-50/55', sub: "Active schedules today" },
          { label: "Completed Appointments", value: stats.todayCompleted, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50/55', sub: "Successfully treated today" },
          { label: "Pending Appointments", value: stats.todayPending, icon: Hourglass, color: 'text-amber-500', bg: 'bg-amber-50/55', sub: "Awaiting consultation" },
          { label: "New Patients", value: `${stats.totalPatients} (All) / ${stats.newPatientsCount} (Month)`, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50/55', sub: "Registrations logged" },
          { label: "Today's Revenue", value: admin ? `₹${Number(stats.todayCollection).toLocaleString('en-IN')}` : '🔐 Secured', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50/55', sub: "Today's payments" },
          { label: "Monthly Revenue", value: admin ? `₹${Number(stats.monthCollection).toLocaleString('en-IN')}` : '🔐 Secured', icon: Activity, color: 'text-cyan-600', bg: 'bg-cyan-50/55', sub: "Current month collections" },
          { label: "Pending Payments", value: admin ? `₹${Number(stats.pendingBalance).toLocaleString('en-IN')}` : '🔐 Secured', icon: DollarSign, color: 'text-rose-600', bg: 'bg-rose-50/55', sub: "Total dues outstanding" },
          { label: "Follow-ups Due", value: stats.overdueFollowups, icon: AlertCircle, color: 'text-purple-600', bg: 'bg-purple-50/55', sub: "Return recall actions" },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">{label}</span>
              <div className={`p-1.5 rounded-xl ${bg} ${color}`}>
                <Icon size={15} />
              </div>
            </div>
            <p className="text-xl font-black text-slate-800 leading-none">{value}</p>
            <p className="text-[9px] text-slate-400 font-bold mt-1.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

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

      {/* ── UPCOMING APPOINTMENTS CONTROL CENTER ── */}
      <div id="upcoming-appointments-command-center" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-150 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <CalendarCheck size={15} className="text-teal-605 animate-pulse" />
              Upcoming Appointments Command Center
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Clinic operational dashboard for scheduling triage, real-time tracking, and automated reminder dispatch outreach.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">All Upcoming:</span>
              <span className="text-xs font-bold font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {upcomingAppointments.length} Patients
              </span>
            </div>
            <div className="bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-rose-800">
              <span className="text-[10px] font-bold text-rose-600 uppercase">Requires Reminder Today:</span>
              <span className="text-xs font-bold font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                {tomorrowPendingCount}
              </span>
            </div>
          </div>
        </div>

        {/* Campaign Control Center Group */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Send size={13} className="text-teal-605" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Bulk Reminder Outreach Campaigns</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              id="btn-campaign-tomorrow"
              onClick={() => startBulkReminderCampaign('tomorrow')}
              className="bg-white hover:bg-slate-50 text-slate-750 flex items-center justify-between p-3 rounded-lg border border-slate-150 shadow-xs text-xs font-bold transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-left">Send Tomorrow Reminders</span>
              </div>
              <span className="bg-amber-100 text-amber-800 font-mono text-[10px] px-2 py-0.5 rounded">
                {tomorrowPendingCount} Pending
              </span>
            </button>
            <button
              type="button"
              id="btn-campaign-3day"
              onClick={() => startBulkReminderCampaign('3days')}
              className="bg-white hover:bg-slate-50 text-slate-755 flex items-center justify-between p-3 rounded-lg border border-slate-150 shadow-xs text-xs font-bold transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-left">Send 3-Day Reminder Campaign</span>
              </div>
              <span className="bg-blue-100 text-blue-800 font-mono text-[10px] px-2 py-0.5 rounded">
                {next3PendingCount} Pending
              </span>
            </button>
            <button
              type="button"
              id="btn-campaign-all"
              onClick={() => startBulkReminderCampaign('all')}
              className="bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-between p-3 rounded-lg border border-teal-700 shadow-xs text-xs font-bold transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-teal-200 shrink-0 animate-ping" />
                <span className="text-left">Send All Pending Campaign</span>
              </div>
              <span className="bg-teal-700 text-white font-mono text-[10px] px-2 py-0.5 rounded">
                {allPendingCount} Pending
              </span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between bg-slate-50 p-2 rounded-xl border border-slate-150">
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
            {[
              { id: 'all', label: 'All Upcoming' },
              { id: 'tomorrow', label: 'Tomorrow Only' },
              { id: '3days', label: 'Next 3 Days' },
              { id: '7days', label: 'Next 7 Days' },
              { id: '30days', label: 'Next 30 Days' }
            ].map((tab) => (
              <button
                key={tab.id}
                id={`upcoming-tab-${tab.id}`}
                onClick={() => setUpcomingFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  upcomingFilter === tab.id
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-550 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="upcoming-search-input"
              value={upcomingSearch}
              onChange={(e) => setUpcomingSearch(e.target.value)}
              placeholder="Search upcoming patient lists..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-400 text-xs placeholder-slate-450 font-medium"
            />
          </div>
        </div>

        {/* Upcoming Table */}
        {filteredUpcoming.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            No upcoming schedule slots found matching target filter. Please try adjusting filter conditions!
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-150 rounded-xl">
            <table className="min-w-full divide-y divide-slate-150 text-left text-xs bg-slate-50/30">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3 font-bold text-slate-550 text-[10px] uppercase">Patient Name</th>
                  <th className="p-3 font-bold text-slate-550 text-[10px] uppercase">treatment session</th>
                  <th className="p-3 font-bold text-slate-550 text-[10px] uppercase">Scheduled Info</th>
                  <th className="p-3 font-bold text-slate-550 text-[10px] uppercase">Session Status</th>
                  <th className="p-3 font-bold text-slate-550 text-[10px] uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white">
                {filteredUpcoming.map((appt: any) => {
                  const isToday = appt.next_visit === todayStr;
                  const isTomorrow = appt.next_visit === tomorrowStr;

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3">
                        <p className="font-extrabold text-slate-800">{appt.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold font-mono">{appt.phone}</p>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-black text-teal-800 bg-teal-50 border border-teal-150 px-2 py-0.5 rounded">
                          {appt.treatment || 'Consultation'}
                        </span>
                        {appt.doctor_name && (
                          <p className="text-[9.5px] text-slate-450 mt-1 font-medium flex items-center gap-0.5">
                            <Stethoscope size={10} className="text-teal-605" />
                            {appt.doctor_name}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-750">
                            {new Date(appt.next_visit).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          {isToday && (
                            <span className="text-[9px] font-extrabold px-1 py-0.2 bg-rose-50 text-rose-700 border border-rose-150 rounded uppercase animate-pulse">
                              Today
                            </span>
                          )}
                          {isTomorrow && (
                            <span className="text-[9px] font-extrabold px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-150 rounded uppercase">
                              Tomorrow
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold font-mono mt-0.5 flex items-center gap-0.5">
                          <Clock size={10} className="text-slate-400" />
                          {appt.appointment_time || 'General Slot'}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className={`text-[9.5px] font-extrabold px-2 py-0.5 border rounded-full uppercase ${
                          appt.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-150'
                            : appt.status === 'In Treatment'
                            ? 'bg-sky-50 text-sky-850 border-sky-150 shadow-2xs'
                            : appt.status === 'Cancelled'
                            ? 'bg-rose-50 text-rose-800 border-rose-150'
                            : 'bg-amber-50 text-amber-800 border-amber-150'
                        }`}>
                          {appt.status || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingAppt(appt)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-1 rounded border border-slate-205 shadow-3xs cursor-pointer transition"
                            title="View Overview"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditUpcomingAppt(appt)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-1 rounded border border-slate-205 shadow-3xs cursor-pointer transition"
                            title="Edit / Reschedule"
                          >
                            Edit
                          </button>
                          <a
                            href={`tel:${appt.phone}`}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-1 rounded border border-slate-205 shadow-3xs cursor-pointer transition flex items-center gap-0.5"
                            title="Call Patient"
                          >
                            Call
                          </a>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppSingle(appt)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded border border-emerald-150 shadow-3xs cursor-pointer transition flex items-center gap-0.5"
                            title="WhatsApp Reminder"
                          >
                            <Send size={10} />
                            Notify
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
                          
                          <button
                            onClick={() => openWhatsApp(item.phone, waText)}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-150 hover:bg-emerald-100 transition inline-flex items-center cursor-pointer"
                            title="Send WhatsApp Outreach"
                          >
                            <Send size={14} />
                          </button>

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

      {/* Edit Appointment Modal Overlay */}
      {editingAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-150 shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-blue-700 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CalendarPlus size={18} />
                <h4 className="font-extrabold text-xs uppercase tracking-wider">Edit Upcoming Appointment</h4>
              </div>
              <button onClick={() => setEditingAppt(null)} className="text-white/80 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUpcomingAppt} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Patient Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-505 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Phone Number</label>
                <input
                  type="text"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-505 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Treatment Procedure</label>
                <select
                  value={editForm.treatment}
                  onChange={(e) => setEditForm({ ...editForm, treatment: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-505 text-xs text-slate-800"
                >
                  <option value="">Select Treatment</option>
                  {TREATMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="General Checkup">General Checkup</option>
                  <option value="Consultation">Consultation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Appointment Date</label>
                  <input
                    type="date"
                    required
                    value={editForm.next_visit}
                    onChange={(e) => setEditForm({ ...editForm, next_visit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-505 text-xs text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Appointment Time</label>
                  <input
                    type="time"
                    required
                    value={editForm.appointment_time}
                    onChange={(e) => setEditForm({ ...editForm, appointment_time: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-505 text-xs text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Attending Doctor</label>
                <select
                  value={editForm.doctor_name}
                  onChange={(e) => setEditForm({ ...editForm, doctor_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-505 text-xs text-slate-800"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((d: any) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                  <option value="Dr. Bhavani">Dr. Bhavani</option>
                  <option value="Dr. Srilatha">Dr. Srilatha</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Appointment Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-505 text-xs text-slate-800 font-bold"
                >
                  <option value="Pending">Pending / Scheduled</option>
                  <option value="In Treatment">In Treatment / Active</option>
                  <option value="Completed">Completed / Handled</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Deleted">Deleted</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Session Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg focus:ring-1 focus:ring-blue-550 text-xs text-slate-800 resize-none"
                  placeholder="E.g., patient desires check-up before trip, requested afternoon slot"
                />
              </div>

              <div className="flex gap-2 pt-2 justify-end font-bold">
                <button
                  type="button"
                  onClick={() => setEditingAppt(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-655 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 shadow-sm transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Appointment Modal Overlay */}
      {viewingAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-150 shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-800 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <h4 className="font-extrabold text-xs uppercase tracking-wider">Appointment Overview</h4>
              </div>
              <button onClick={() => setViewingAppt(null)} className="text-white/80 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-black text-slate-905 text-base">{viewingAppt.name}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">Mobile: {viewingAppt.phone}</p>
                {viewingAppt.email && <p className="text-[11px] text-slate-500 font-mono">Email: {viewingAppt.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Scheduled Date</span>
                  <p className="font-bold font-mono text-slate-800 mt-0.5">{viewingAppt.next_visit}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Session Time</span>
                  <p className="font-bold font-mono text-slate-800 mt-0.5">{viewingAppt.appointment_time || 'General slot'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">treatment type</span>
                  <span className="inline-block mt-0.5 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-150 px-2 py-0.5 rounded">
                    {viewingAppt.treatment || 'Consultation'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Session Status</span>
                  <span className={`inline-block mt-0.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                    viewingAppt.status === 'Completed'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-150'
                      : viewingAppt.status === 'In Treatment'
                      ? 'bg-sky-50 text-sky-850 border-sky-150'
                      : viewingAppt.status === 'Cancelled'
                      ? 'bg-rose-50 text-rose-800 border-rose-150'
                      : 'bg-amber-50 text-amber-800 border-amber-150'
                  }`}>
                    {viewingAppt.status || 'Pending'}
                  </span>
                </div>
              </div>

              {viewingAppt.doctor_name && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">assigned clinical doctor</span>
                  <p className="font-bold text-slate-850 mt-0.5 flex items-center gap-1">
                    <Stethoscope size={12} className="text-teal-605" />
                    {viewingAppt.doctor_name}
                  </p>
                </div>
              )}

              {viewingAppt.notes && (
                <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
                  <span className="text-[9.5px] text-slate-450 font-bold uppercase tracking-wider block mb-1">administrative notes</span>
                  <p className="text-slate-650 leading-relaxed font-semibold">{viewingAppt.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2 justify-end font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setViewingAppt(null);
                    handleEditUpcomingAppt(viewingAppt);
                  }}
                  className="px-4 py-2 bg-blue-50 text-blue-750 border border-blue-150 rounded-lg hover:bg-blue-100 transition font-bold cursor-pointer"
                >
                  Modify Appointment
                </button>
                <button
                  type="button"
                  onClick={() => setViewingAppt(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="bg-white/40 p-1.5 rounded-3xl border border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* CHART 1: Revenue Trend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div>
              <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Revenue Trend</h4>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Clinical financial performance over the active tracking cycle</p>
            </div>
            <div className="h-52 mt-4">
              {weeklyCollectionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyCollectionsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 10 }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                    <Line type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={3} dot={{ fill: '#0f766e', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-[10px] font-semibold italic">🔐 Secured / No collections recorded.</div>
              )}
            </div>
          </div>

          {/* CHART 2: Treatment Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div>
              <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Treatment Distribution</h4>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Diagnosed therapies and clinical services rendered</p>
            </div>
            <div className="h-52 mt-4 flex flex-col justify-center space-y-3">
              {treatmentBreakdown.length > 0 ? (
                treatmentBreakdown.slice(0, 5).map(({ name, count }, i) => {
                  const max = treatmentBreakdown[0].count || 1;
                  const pct = Math.round((count / max) * 100);
                  const colors = ['bg-teal-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-cyan-600', 'bg-amber-500'];
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-650 truncate max-w-[180px]">{name}</span>
                        <span className="text-[11px] font-mono font-black text-slate-800">{count} visits</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">No treatment distribution recorded.</div>
              )}
            </div>
          </div>

          {/* CHART 3: Appointment Status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div>
              <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Appointment Status</h4>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Tracking daily clinical attendance patterns</p>
            </div>
            <div className="h-52 mt-4">
              {attendancePatterns7Days.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendancePatterns7Days} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 7, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} width={15} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 10 }} />
                    <Legend iconSize={6} iconType="circle" wrapperStyle={{ fontSize: 9, paddingTop: 6 }} />
                    <Bar dataKey="Attended" name="Attended" stackId="statusStack" fill="#10b981" />
                    <Bar dataKey="Pending / In Treatment" name="Pending" stackId="statusStack" fill="#cb5a07" />
                    <Bar dataKey="Missed / Cancelled" name="Cancelled" stackId="statusStack" fill="#f43f5e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">Bypassed status patterns.</div>
              )}
            </div>
          </div>

        </div>
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

      {/* Dashboard Bottom Flex-Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Recent Appointments */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-fit">
          <div className="px-5 py-3 border-b border-slate-150 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={14} className="text-teal-600" /> Recent Appointments
            </h3>
            <Link href="/crm/appointments">
              <span className="text-[10px] uppercase font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer">View all <ChevronRight size={11} /></span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100 pb-2">
            {recentAppointments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No appointments yet</div>
            ) : recentAppointments.slice(0, 5).map((a: any) => (
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
    </div>
  );
}
