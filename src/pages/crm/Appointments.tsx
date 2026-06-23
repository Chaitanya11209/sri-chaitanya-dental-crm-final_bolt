import { useEffect, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { isAdmin } from '../../lib/auth';
import { 
  Plus, Search, X, Phone, Clock, Calendar, CheckSquare, 
  Send, CheckCircle2, AlertCircle, MessageSquare, Edit2, Trash2, HeartPulse, ShieldAlert,
  RefreshCw, Zap, Sparkles
} from 'lucide-react';
import { sendSMS, getSMSTemplates } from '../../lib/sms';
import { CLINIC_SIGNATURE, openWhatsApp, sanitizeWhatsAppMessage, getWhatsAppTemplates } from '../../utils/whatsapp';
import { clinicConfig } from '../../config/clinicConfig';
import { useNotification } from '../../components/NotificationProvider';
import { notifyAppointmentBooked } from '../../lib/email';
import { sendWhatsAppNotification, logWhatsAppDelivery, getWhatsAppLogs, WhatsAppLog, getWhatsAppMessageTypeIndicator } from '../../lib/whatsapp';
import DoctorSelect from '../../components/DoctorSelect';
import { broadcastQueueChange } from '../../hooks/useAppointmentSubscription';
import { useAppointmentsRealtime, usePatientsRealtime } from '../../hooks/useRealtimeHooks';
import { syncPatientStatus, syncPatientStatusByAppointment } from '../../utils/syncPatientStatus';

const STATUS_OPTIONS = ['Pending', 'Confirmed', 'Reminder Sent', 'Completed', 'Cancelled', 'No Show'];
const TREATMENTS = [
  'Consultation', 'OP', 'Composite Fillings', 'Scaling', 'RCT', 
  'RCT Post Endodontic Restoration', 'Crown', 'Extraction', 
  'Surgical Extraction', 'Denture', 'Implant', 'Disposables', 'Other'
];

const FALLBACK_DOCTORS = [
  { id: 1, name: 'Dr. Bhavani', phone: '918317575165', qualification: 'BDS, MDS', specialization: 'Chief Implantologist Roster' },
  { id: 2, name: 'Dr. A. K. Verma', phone: '919988776655', qualification: 'BDS', specialization: 'Consultant Surgeon' }
];

const WAITING_LIST_QUEUE = [
  { id: 'w1', name: 'Karan Malhotra', phone: '9865412354', treatment: 'Tooth Extraction', preferred_time: 'Evening', age: 28 },
  { id: 'w2', name: 'Sonia Sharma', phone: '9432109875', treatment: 'Root Canal', preferred_time: 'Morning', age: 34 },
  { id: 'w3', name: 'Rahul Jain', phone: '9123456789', treatment: 'Scaling & Polishing', preferred_time: 'Afternoon', age: 41 },
  { id: 'w4', name: 'Priya Patel', phone: '9567890123', treatment: 'Dental Implants', preferred_time: 'Anytime', age: 22 }
];

const WHATSAPP_TEMPLATES = {
  reminder: `Hello [Name], this is a friendly reminder for your upcoming [Treatment] session scheduled with [Doctor] on [Date] at [Time]. Please reply to confirm or reschedule.`,
  due: `Hello [Name], this is a gentle reminder regarding your outstanding due of ₹[Balance] for your treatment with [Doctor]. Kindly settle the balance during your next visit or online. Thank you!`,
  custom: `Hello [Name], we hope you are having a pleasant day! Just a note regarding your oral hygiene and routine examination.`
};

function getAppointmentDateTime(next_visit: string, appointment_time: string): Date | null {
  if (!next_visit) return null;
  const parts = next_visit.split('-');
  let year = new Date().getFullYear();
  let month = new Date().getMonth();
  let day = new Date().getDate();
  if (parts.length === 3) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    const d = new Date(next_visit);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    } else {
      return null;
    }
  }

  let hours = 9; // Default 9 AM
  let minutes = 0;
  if (appointment_time) {
    const cleanTime = appointment_time.trim().toLowerCase();
    const match = cleanTime.match(/(\d+):(\d+)\s*(am|pm)?/);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3];
      if (ampm === 'pm' && hours < 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
    } else {
      const matchOnlyHour = cleanTime.match(/(\d+)\s*(am|pm)/);
      if (matchOnlyHour) {
        hours = parseInt(matchOnlyHour[1], 10);
        const ampm = matchOnlyHour[2];
        if (ampm === 'pm' && hours < 12) {
          hours += 12;
        } else if (ampm === 'am' && hours === 12) {
          hours = 0;
        }
      }
    }
  }

  const dt = new Date(year, month, day, hours, minutes, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

function replaceTokens(template: string, appt: any, defaultDocName = 'Dr. Bhavani'): string {
  const doctor = appt.doctor_name || defaultDocName;
  const name = appt.name || 'Patient';
  const treatment = appt.treatment || 'Consultation';
  const date = appt.next_visit || appt.appointment_date || '';
  const time = appt.appointment_time || 'General slot';
  const balance = appt.balance_amount || '0';

  const rDate = new Date();
  rDate.setMonth(rDate.getMonth() + 6);
  const recallDateStr = rDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const signature = `Thanks & Regards,

${clinicConfig.clinicName}
${clinicConfig.address}

📞 ${clinicConfig.phone}

📍 Location:
${clinicConfig.googleReviewUrl}

"We Care Your Smile"`;

  const replaced = template
    .replace(/\[Name\]/gi, name)
    .replace(/\[Doctor\]/gi, doctor)
    .replace(/\[Treatment\]/gi, treatment)
    .replace(/\[Date\]/gi, date)
    .replace(/\[Time\]/gi, time)
    .replace(/\[Balance\]/gi, balance)
    .replace(/\[RecallDate\]/gi, recallDateStr)
    // Settings configuration placeholders format mapping
    .replaceAll('{PatientName}', name)
    .replaceAll('{ClinicName}', clinicConfig.clinicName)
    .replaceAll('{ClinicAddress}', clinicConfig.address)
    .replaceAll('{Date}', date)
    .replaceAll('{Time}', time)
    .replaceAll('{Treatment}', treatment)
    .replaceAll('{Balance}', balance)
    .replaceAll('{Signature}', signature);

  if (replaced.includes(clinicConfig.phone.replace(/\s+/g, '')) || replaced.includes(clinicConfig.clinicName)) {
    return replaced;
  }
  return `${replaced.trim()}\n\n${signature}`;
}

export default function Appointments() {
  const admin = isAdmin();
  const { notify } = useNotification();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'time' | 'patient_name'>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [todayOnly, setTodayOnly] = useState(false);
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [isHistorical, setIsHistorical] = useState(false);

  // States for checkbox-based bulk sending
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<'reminder' | 'due' | 'custom'>('reminder');
  const [bulkWhatsAppMessage, setBulkWhatsAppMessage] = useState(WHATSAPP_TEMPLATES.reminder);
  const [individualStatuses, setIndividualStatuses] = useState<Record<number, 'pending' | 'sending' | 'success' | 'failed' | 'opened'>>({});

  // Post-saving notification alerts modal
  const [savedWhatsAppAlerts, setSavedWhatsAppAlerts] = useState<any | null>(null);
  const [isAlertingPatient, setIsAlertingPatient] = useState(false);
  const [isAlertingDoctor, setIsAlertingDoctor] = useState(false);
  const [isSendingScheduled, setIsSendingScheduled] = useState<Record<number, boolean>>({});

  // Waiting list vacancy reallocation state
  const [vacantSlotNotification, setVacantSlotNotification] = useState<any>(null);

  // Searchable Doctor variables
  const [doctorSearch, setDoctorSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Existing Patient Auto-fill states
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Automated WhatsApp Queue Scheduler Rules & States
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedulerRules, setSchedulerRules] = useState(() => {
    const saved = localStorage.getItem('whatsapp_scheduled_rules');
    return saved ? JSON.parse(saved) : {
      dayBeforeEnabled: true,
      dayBeforeTime: '09:00',
      dayBeforeTemplate: 'tomorrow_reminder',
      sameDayEnabled: false,
      sameDayTime: '08:00',
      sameDayTemplate: 'appointment_reminder'
    };
  });
  const [dispatchedReminderIds, setDispatchedReminderIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('whatsapp_dispatched_reminder_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [schedulerSearchQuery, setSchedulerSearchQuery] = useState('');
  const [customPatientTemplates, setCustomPatientTemplates] = useState<Record<string, string>>({});
  const [schedulerPatientTypeFilter, setSchedulerPatientTypeFilter] = useState('All');
  const [filterOnlyDue, setFilterOnlyDue] = useState(false);
  const [isSmartBatchSending, setIsSmartBatchSending] = useState(false);
  const [whatsappDbMessages, setWhatsappDbMessages] = useState<any[]>([]);

  const fetchWhatsappDbMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select(`
          id,
          phone,
          message,
          status,
          created_at,
          patient_id,
          patients ( name )
        `)
        .order('id', { ascending: false })
        .limit(100);
      if (!error && data) {
        setWhatsappDbMessages(data);
      }
    } catch (e) {
      console.error('Error fetching whatsapp messages:', e);
    }
  };

  useEffect(() => {
    fetchWhatsappDbMessages();

    const channel = supabase
      .channel('whatsapp-messages-realtime-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => {
        console.info('[Appointments] [Realtime] whatsapp_messages changed, updating delivery tracker...');
        fetchWhatsappDbMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveSchedulerRules = (updated: any) => {
    setSchedulerRules(updated);
    localStorage.setItem('whatsapp_scheduled_rules', JSON.stringify(updated));
    notify('success', 'Rules Saved', 'Automatic WhatsApp scheduler preferences saved.');
  };

  const handleDispatchReminder = async (appt: any, type: 'dayBefore' | 'sameDay') => {
    const key = `${appt.id}-${type}`;
    if (dispatchedReminderIds.includes(key)) {
      notify('info', 'Already Dispatched', `${appt.name}'s reminder has already been processed.`);
      return;
    }

    const templateSelection = customPatientTemplates[appt.id] || (type === 'dayBefore' ? schedulerRules.dayBeforeTemplate : schedulerRules.sameDayTemplate);
    
    // Choose appropriate message body
    const templates = getWhatsAppTemplates();
    let rawText = '';
    if (templateSelection === 'tomorrow_reminder') {
      rawText = templates.appointment_reminder || 'Hi [Name], quick reminder that you have a dental check-up tomorrow at [Time] for [Treatment].';
    } else if (templateSelection === 'appointment_reminder') {
      rawText = templates.appointment_reminder || 'Hi [Name], this is a reminder for your upcoming clinical slot with [Doctor] on [Date] at [Time] for [Treatment].';
    } else if (templateSelection === 'others') {
      rawText = templates.recall || 'Hello [Name], we wish you a pleasant day! Just a friendly note regarding your routine check-up recall.';
    } else {
      rawText = templates.appointment_reminder || 'Hi [Name], we are here to remind you of your clinical visit scheduled with [Doctor] on [Date] at [Time] for [Treatment].';
    }

    const defaultDocName = (doctors && doctors[0]?.name) || 'Dr. Bhavani';
    const message = replaceTokens(rawText, appt, defaultDocName);
    const formattedPhone = formatWhatsAppPhone(appt.phone);

    setIndividualStatuses(prev => ({ ...prev, [appt.id]: 'sending' }));

    const twilioSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER;

    if (twilioSid && twilioAuthToken && twilioWhatsAppNumber) {
      try {
        const res = await window.fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            bg: true,
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: `whatsapp:+${formattedPhone}`,
              From: twilioWhatsAppNumber.startsWith('whatsapp:') ? twilioWhatsAppNumber : `whatsapp:${twilioWhatsAppNumber}`,
              Body: message,
            }),
          } as any
        );

        if (res.ok) {
          const nextDispatched = [...dispatchedReminderIds, key];
          setDispatchedReminderIds(nextDispatched);
          localStorage.setItem('whatsapp_dispatched_reminder_ids', JSON.stringify(nextDispatched));
          setIndividualStatuses(prev => ({ ...prev, [appt.id]: 'success' }));
          logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Scheduled Queue', 'Sent', message, appt.patient_id, appt.id);
          notify('success', 'Reminder Transmitted', `Successfully dispatched automated reminder to ${appt.name} via Twilio.`);
          await updateStatus(appt.id, 'Reminder Sent');
          setTimeout(() => { fetchWhatsappDbMessages(); }, 1000);
        } else {
          throw new Error();
        }
      } catch {
        setIndividualStatuses(prev => ({ ...prev, [appt.id]: 'failed' }));
        notify('error', 'API Dispatch Failed', `Twilio API failed for ${appt.name}. URL click fallback enabled.`);
      }
    } else {
      setIndividualStatuses(prev => ({ ...prev, [appt.id]: 'sending' }));
      try {
        await logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Scheduled Queue', 'Sent', message, appt.patient_id, appt.id);
      } catch (err) {
        console.error("Failed to log WhatsApp delivery:", err);
      }
      
      openWhatsApp(appt.phone, message);
      
      const nextDispatched = [...dispatchedReminderIds, key];
      setDispatchedReminderIds(nextDispatched);
      localStorage.setItem('whatsapp_dispatched_reminder_ids', JSON.stringify(nextDispatched));
      
      setIndividualStatuses(prev => ({ ...prev, [appt.id]: 'opened' }));
      notify('success', 'WhatsApp Click Opened', `Link initialized for ${appt.name}`);
      await updateStatus(appt.id, 'Reminder Sent');
      setTimeout(() => { fetchWhatsappDbMessages(); }, 1000);
    }
  };

  const clearQueueState = () => {
    setDispatchedReminderIds([]);
    localStorage.removeItem('whatsapp_dispatched_reminder_ids');
    notify('success', 'Queue Reset', 'Automatic reminder queue history cleared.');
  };

  const handleSmartSendAllDue = async (dueAppts: any[]) => {
    if (dueAppts.length === 0) {
      notify('info', 'No Reminders Due', 'There are no outstanding appointments due for reminder at this time.');
      return;
    }

    const twilioSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER;
    const isTwilioActive = !!(twilioSid && twilioAuthToken && twilioWhatsAppNumber);

    if (!isTwilioActive) {
      const confirmManual = window.confirm(
        `Twilio API is not configured. Web-browser WhatsApp fallback will trigger. We will open the custom template message for each of the ${dueAppts.length} due patient(s) one-by-one. Proceed?`
      );
      if (!confirmManual) return;
    } else {
      const confirmTwilio = window.confirm(
        `Twilio Cloud API is active! This will instantly transmit automated WhatsApp messages to all ${dueAppts.length} due patient(s) in background slots. Proceed?`
      );
      if (!confirmTwilio) return;
    }

    setIsSmartBatchSending(true);
    let successCount = 0;

    for (let i = 0; i < dueAppts.length; i++) {
      const appt = dueAppts[i];
      const type = appt.isDayBeforeDue ? 'dayBefore' : 'sameDay';
      try {
        await handleDispatchReminder(appt, type);
        successCount++;
        // Grace period for browser window popup triggers or Cloud rate limits
        await new Promise(resolve => setTimeout(resolve, isTwilioActive ? 400 : 2500));
      } catch (err) {
        console.error("Smart send failed for appointment:", appt.id, err);
      }
    }

    setIsSmartBatchSending(false);
    notify('success', 'Smart Send Executed', `Successfully dispatched ${successCount} out of ${dueAppts.length} scheduled reminders.`);
  };

  const [syncingTemplates, setSyncingTemplates] = useState(false);

  const handleSyncAllTemplates = () => {
    setSyncingTemplates(true);
    try {
      const liveTemplates = getWhatsAppTemplates();
      notify('success', 'Templates Synced Successfully', 'All automated scheduler configurations, review invite links, and branding parameters are synchronized.');
    } catch (e) {
      notify('error', 'Sync Failed', 'Failed to synchronize communication settings.');
    } finally {
      setTimeout(() => setSyncingTemplates(false), 500);
    }
  };

  const handleAlertPatient = async () => {
    if (!savedWhatsAppAlerts) return;
    setIsAlertingPatient(true);
    const msg = constructWhatsAppMessage(savedWhatsAppAlerts);
    try {
      await logWhatsAppDelivery(
        savedWhatsAppAlerts.patientName,
        savedWhatsAppAlerts.patientPhone,
        'Patient',
        'Roster Scheduled Alert',
        'Sent',
        msg,
        savedWhatsAppAlerts.patient_id || null,
        savedWhatsAppAlerts.id || null
      );
    } catch (e) {
      console.error(e);
    } finally {
      openWhatsApp(savedWhatsAppAlerts.patientPhone, msg);
      setIsAlertingPatient(false);
    }
  };

  const handleAlertDoctor = async () => {
    if (!savedWhatsAppAlerts) return;
    setIsAlertingDoctor(true);
    const msg = constructWhatsAppMessage(savedWhatsAppAlerts);
    try {
      await logWhatsAppDelivery(
        savedWhatsAppAlerts.doctorName,
        savedWhatsAppAlerts.doctorPhone || '918317575165',
        'Doctor',
        'Roster Scheduled Alert',
        'Sent',
        msg,
        null,
        savedWhatsAppAlerts.id || null
      );
    } catch (e) {
      console.error(e);
    } finally {
      openWhatsApp(savedWhatsAppAlerts.doctorPhone || '918317575165', msg);
      setIsAlertingDoctor(false);
    }
  };

  const handleSendScheduledWhatsApp = async (appt: any) => {
    setIsSendingScheduled(prev => ({ ...prev, [appt.id]: true }));
    const defaultDocName = (doctors && doctors[0]?.name) || 'Dr. Bhavani';
    const msg = `Sri Chaitanya Dental Care\n\nAppointment scheduled successfully\n\nPatient:\n${appt.name}\n\nDoctor:\n${appt.doctor_name || defaultDocName}\n\nDate:\n${appt.next_visit}\n\nTime:\n${appt.appointment_time || 'General'}\n\nTreatment:\n${appt.treatment}\n\nStatus:\nScheduled`;
    try {
      await logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Appointment Scheduled', 'Sent', msg, appt.patient_id, appt.id);
    } catch (e) {
      console.error(e);
    } finally {
      openWhatsApp(appt.phone, msg);
      setIsSendingScheduled(prev => ({ ...prev, [appt.id]: false }));
    }
  };

  const fetchAllPatients = async () => {
    console.info("[Database → Query → Hook] Refetching patients via Hook from Appointments.tsx");
    await refetchPatients();
  };

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

  const { appointments: realtimeAppointments, loading: realtimeAppointmentsLoading, refetch: refetchAppointments } = useAppointmentsRealtime();
  const { patients: realtimePatients, refetch: refetchPatients } = usePatientsRealtime();

  useEffect(() => {
    fetchActiveDoctors();
  }, []);

  useEffect(() => {
    if (realtimeAppointments) {
      console.info("[Appointments] [UI] Reacting to updated realtimeAppointments from Hook.", realtimeAppointments.length);
      setAppointments(realtimeAppointments);
      setLoading(realtimeAppointmentsLoading);
    }
  }, [realtimeAppointments, realtimeAppointmentsLoading]);

  // Refactored scheduler active appointments query
  // Explicitly filters out 'Completed', 'Cancelled', 'No Show', and 'Deleted' to prevent them from appearing in active reminder queues
  const schedulerActiveAppointments = useMemo(() => {
    return appointments.filter(a => {
      const status = a.status || '';
      
      // 1. Explicitly filter out Completed, Cancelled, No Show, and Deleted statuses
      if (
        status === 'Completed' ||
        status === 'Cancelled' ||
        status === 'No Show' ||
        status === 'Deleted'
      ) {
        return false;
      }
      
      // 2. Only permit active Pending, Confirmed, and Reminder Sent statuses
      const isStatusOk = status === 'Pending' || status === 'Confirmed' || status === 'Reminder Sent';
      if (!isStatusOk) return false;

      // 3. Ensure only active, future-dated or today's appointments appear in the queue
      const targetDateStr = a.next_visit || '';
      if (!targetDateStr) return false;

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const apptDate = (() => {
        const parts = targetDateStr.split('-');
        if (parts.length === 3) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
        return new Date(targetDateStr);
      })();
      if (isNaN(apptDate.getTime())) return false;
      apptDate.setHours(0, 0, 0, 0);

      if (apptDate < todayDate) {
        return false;
      }

      return true;
    });
  }, [appointments]);

  // Pre-calculate full scheduler info, including optimal reminder times (24h before) and due states
  const processedSchedulerAppointments = useMemo(() => {
    return schedulerActiveAppointments.map(a => {
      const targetDateStr = a.next_visit || '';
      const timeStr = a.appointment_time || '';

      const apptDateObj = (() => {
        if (!targetDateStr) return null;
        const parts = targetDateStr.split('-');
        if (parts.length === 3) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
        return new Date(targetDateStr);
      })();
      if (apptDateObj) {
        apptDateObj.setHours(0, 0, 0, 0);
      }

      const exactApptDt = getAppointmentDateTime(targetDateStr, timeStr);

      const isDayBeforeDispatched = dispatchedReminderIds.includes(`${a.id}-dayBefore`);
      const isSameDayDispatched = dispatchedReminderIds.includes(`${a.id}-sameDay`);

      const needsDayBefore = schedulerRules.dayBeforeEnabled && !isDayBeforeDispatched;
      const needsSameDay = schedulerRules.sameDayEnabled && !isSameDayDispatched;

      // Optimal reminder time is 24 hours before the exact appointment date and time
      const optimalReminderTime = exactApptDt ? new Date(exactApptDt.getTime() - 24 * 60 * 60 * 1000) : null;

      const now = new Date();
      const isDayBeforeDue = needsDayBefore && optimalReminderTime && now >= optimalReminderTime;
      const isSameDayDue = needsSameDay && apptDateObj && now >= apptDateObj;

      const isDueForReminder = isDayBeforeDue || isSameDayDue;

      return {
        ...a,
        apptDateObj,
        exactApptDt,
        optimalReminderTime,
        isDayBeforeDispatched,
        isSameDayDispatched,
        needsDayBefore,
        needsSameDay,
        isDayBeforeDue,
        isSameDayDue,
        isDueForReminder,
        optimalTimeStr: optimalReminderTime ? optimalReminderTime.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A'
      };
    });
  }, [schedulerActiveAppointments, dispatchedReminderIds, schedulerRules]);

  const dueAppointmentsInView = useMemo(() => {
    return processedSchedulerAppointments.filter(a => {
      if (schedulerPatientTypeFilter !== 'All') {
        const isNew = a.visit_type === 'New' || (!a.visit_type && (!a.visit_count || Number(a.visit_count) <= 1));
        const isReturning = a.visit_type === 'Returning' || (a.visit_count && Number(a.visit_count) > 1);
        if (schedulerPatientTypeFilter === 'New' && !isNew) return false;
        if (schedulerPatientTypeFilter === 'Returning' && !isReturning) return false;
      }
      if (schedulerSearchQuery.trim()) {
        const query = schedulerSearchQuery.toLowerCase().trim();
        const name = (a.name || '').toLowerCase();
        const phone = (a.phone || '').toLowerCase();
        if (!name.includes(query) && !phone.includes(query)) return false;
      }
      return a.isDueForReminder;
    });
  }, [processedSchedulerAppointments, schedulerPatientTypeFilter, schedulerSearchQuery]);

  useEffect(() => {
    if (realtimePatients) {
      console.info("[Appointments] [UI] Reacting to updated realtimePatients from Hook.", realtimePatients.length);
      setAllPatients(realtimePatients);
    }
  }, [realtimePatients]);

  const fetchActiveDoctors = async () => {
    try {
      if (!isSupabaseConfigured) {
        const stored = localStorage.getItem('sandbox_doctors');
        if (stored) {
          const list = JSON.parse(stored);
          setDoctors(list.filter((d: any) => d.status === 'Active'));
        } else {
          setDoctors(FALLBACK_DOCTORS);
        }
        return;
      }

      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('status', 'Active')
        .order('name', { ascending: true });

      if (error) throw error;
      setDoctors(data && data.length > 0 ? data : FALLBACK_DOCTORS);
    } catch (e) {
      console.warn("Doctors table fetching bypassed. Standard roster utilized.");
      const stored = localStorage.getItem('sandbox_doctors');
      if (stored) {
        const list = JSON.parse(stored);
        setDoctors(list.filter((d: any) => d.status === 'Active'));
      } else {
        setDoctors(FALLBACK_DOCTORS);
      }
    }
  };

  const fetch = async () => {
    setSyncing(true);
    console.info("[Database → Query → Hook] Refetching appointments and patients via realtime Hooks from Appointments.tsx");
    await Promise.all([
      refetchAppointments(),
      refetchPatients()
    ]);
    setSyncing(false);
  };

  const updateStatus = async (id: number, status: string) => {
    // Keep back-up of appointments before state update
    const previousAppointments = [...appointments];

    // Optimistic Update: Reflect new status inside local state instantly
    setAppointments((prev) =>
      prev.map((appt) => (appt.id === id ? { ...appt, status } : appt))
    );

    try {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;

      await syncPatientStatusByAppointment(id);

      if (status === 'Cancelled') {
        const cancelledAppt = previousAppointments.find(a => a.id === id);
        if (cancelledAppt) {
          setVacantSlotNotification({
            id: cancelledAppt.id,
            date: cancelledAppt.next_visit,
            time: cancelledAppt.appointment_time,
            treatment: cancelledAppt.treatment
          });
        }
      }

      // Broadcast if status matches Ready
      if (status === 'Ready') {
        const targetAppt = previousAppointments.find((a) => a.id === id);
        if (targetAppt) {
          broadcastQueueChange('status-ready', targetAppt.name);
        }
      }

      fetch();
    } catch (err: any) {
      console.error('[Appointments] Status update error:', err);
      // Rollback to backup
      setAppointments(previousAppointments);
      notify('error', 'Update Failed', 'Failed to update appointment status.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to dismiss and delete this appointment?")) return;
    try {
      const { error } = await supabase.from('appointments').update({ status: 'Deleted' }).eq('id', id);
      if (error) throw error;
      await syncPatientStatusByAppointment(id);
      notify('success', 'Appointment Deleted', 'Appointment successfully deleted on patient schedule.');
      fetch();
    } catch (err: any) {
      notify('error', 'Execution Error', 'Failed to remove appointment.');
    }
  };

  const handleAssignSlot = async (candidate: any) => {
    if (!vacantSlotNotification) return;

    // Retrieve or register patient by matching both Name and Phone
    const { data: existingPatients } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', candidate.phone)
      .eq('name', candidate.name);
    
    let patientId = existingPatients?.[0]?.id;
    if (!patientId) {
      // Fallback: search for any patient matching this phone number as raw fallback
      const { data: fallbackPatients } = await supabase
        .from('patients')
        .select('id')
        .eq('phone', candidate.phone);
      patientId = fallbackPatients?.[0]?.id;
    }

    if (!patientId) {
      const { data: nps } = await supabase.from('patients').insert([{
        name: candidate.name,
        phone: candidate.phone,
        age: candidate.age,
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
      if (patientId) {
        await syncPatientStatus(patientId);
      } else if (scheduledAppt?.[0]?.patient_id) {
        await syncPatientStatus(scheduledAppt[0].patient_id);
      }

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

  // ── AUTOMATED REMINDERS TRIGGER ENGINE (1-HOUR & 24-HOUR) ──
  useEffect(() => {
    const parseAppointmentDateTime = (dateStr: string, timeStr?: string): Date | null => {
      if (!dateStr) return null;
      let d: Date;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        d = new Date(dateStr);
      }
      if (isNaN(d.getTime())) return null;

      let hours = 10; // Default to 10 AM
      let minutes = 0;

      if (timeStr) {
        const match12 = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (match12) {
          hours = parseInt(match12[1], 10);
          minutes = parseInt(match12[2], 10);
          const ampm = match12[3].toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        } else {
          const match24 = timeStr.match(/(\d+):(\d+)/);
          if (match24) {
            hours = parseInt(match24[1], 10);
            minutes = parseInt(match24[2], 10);
          }
        }
      }

      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const handleScheduledReminders = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayString = `${year}-${month}-${day}`;

      appointments.forEach(a => {
        // --- 1. Automated 1-Hour Prior Reminders ---
        if (a.next_visit === todayString && a.appointment_time && a.status === 'Confirmed') {
          const appointmentDate = parseAppointmentDateTime(a.next_visit, a.appointment_time);
          if (appointmentDate) {
            const timeDiffMs = appointmentDate.getTime() - now.getTime();
            const timeDiffMins = timeDiffMs / (1000 * 60);

            if (timeDiffMins > 0 && timeDiffMins <= 60) {
              const reminderKey = `reminder_1hr_sent_${a.id}`;
              if (!localStorage.getItem(reminderKey)) {
                localStorage.setItem(reminderKey, 'true');

                const reminderText = `Appointment Confirmed

Patient: ${a.name}
Doctor: ${a.doctor_name || 'Assigned Specialist'}
Date: ${a.next_visit}
Time: ${a.appointment_time}

Sri Chaitanya Dental Care`;

                logWhatsAppDelivery(a.name, a.phone, 'Patient', '1-Hour Automated Reminder', 'Sent', reminderText, a.patient_id, a.id);
                if (a.doctor_name) {
                  logWhatsAppDelivery(a.doctor_name, '918317575165', 'Doctor', '1-Hour Automated Reminder', 'Sent', reminderText, null, a.id);
                }

                notify('info', 'Automated Reminder Sent', `1-Hour automated WhatsApp reminder sent to ${a.name} & ${a.doctor_name || 'Doctor'}`);
              }
            }
          }
        }

        // --- 2. Automated 24-Hour Prior Reminders ---
        if (a.status === 'Confirmed' || a.status === 'Pending') {
          const apptDate = parseAppointmentDateTime(a.next_visit, a.appointment_time);
          if (apptDate) {
            const timeDiffMs = apptDate.getTime() - now.getTime();
            const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

            // If scheduled in the next 24 hours (and is in the future)
            if (timeDiffHours > 0 && timeDiffHours <= 24) {
              const reminder24hKey = `reminder_24h_sent_${a.id}`;
              if (!localStorage.getItem(reminder24hKey)) {
                localStorage.setItem(reminder24hKey, 'true');

                // Map doctor phone if possible
                const mappedDoc = doctors.find(doc => String(doc.id) === String(a.doctor_id));
                const docPhone = mappedDoc?.phone || '918317575165';

                const params = {
                  patientName: a.name,
                  patientPhone: a.phone,
                  doctorName: a.doctor_name || 'Assigned Specialist',
                  doctorPhone: docPhone,
                  date: a.next_visit,
                  time: a.appointment_time || '',
                  treatment: a.treatment || 'Consultation',
                  status: 'Confirmed'
                };

                sendWhatsAppNotification(params).then(() => {
                  notify('info', '24-Hour Reminder Sent', `Automated 24-hour WhatsApp reminder sent to patient ${a.name}.`);
                }).catch(err => {
                  console.error('Error sending 24h WhatsApp notification:', err);
                });
              }
            }
          }
        }
      });
    };

    const intervalId = setInterval(handleScheduledReminders, 25000);
    return () => clearInterval(intervalId);
  }, [appointments, doctors]);

  const handleOpenBookModal = () => {
    setEditingAppt(null);
    setSelectedPatientId(null);
    setPatientSearchQuery('');
    setShowPatientSuggestions(false);
    setIsHistorical(false);
    const initialDoc = doctors[0] || FALLBACK_DOCTORS[0];
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
      doctor_id: initialDoc?.id?.toString() || '1',
      doctor_name: initialDoc?.name || FALLBACK_DOCTORS[0].name
    });
    setDoctorSearch(initialDoc?.name || FALLBACK_DOCTORS[0].name);
    setDropdownOpen(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (a: any) => {
    setEditingAppt(a);
    setSelectedPatientId(a.patient_id || null);
    setIsHistorical(a.status === 'Completed');
    
    // Find patient code or name to set search query cleanly
    const matchedP = allPatients.find(p => p.id === a.patient_id);
    if (matchedP) {
      setPatientSearchQuery(`${matchedP.name} (${matchedP.patient_code || matchedP.id})`);
    } else {
      setPatientSearchQuery('');
    }
    setShowPatientSuggestions(false);

    const docName = a.doctor_name || doctors.find(d => d.id.toString() === a.doctor_id?.toString())?.name || doctors[0]?.name || FALLBACK_DOCTORS[0].name;
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
      doctor_name: docName
    });
    setDoctorSearch(docName);
    setDropdownOpen(false);
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.treatment || !form.next_visit) {
      notify('error', 'Fields Incomplete', 'Provide name, mobile connection, treatment and visit date.');
      return;
    }

    let isPastDate = false;
    if (form.next_visit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apptDate = new Date(form.next_visit);
      apptDate.setHours(0, 0, 0, 0);
      isPastDate = apptDate < today;
    }
    const isActuallyHistorical = isHistorical || isPastDate;

    let previousAppointments: any[] = [];
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

      let matchedPatientId = selectedPatientId || matchedPatients?.[0]?.id;

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
      
      // ── DOCTOR AVAILABILITY CONFLICT DETECTION (PREVENT DOUBLE-BOOKING) ──
      if (form.next_visit && form.appointment_time) {
        const hasConflict = appointments.some(a => 
          a.doctor_id?.toString() === selectedDocObj.id.toString() &&
          a.next_visit === form.next_visit &&
          a.appointment_time === form.appointment_time &&
          a.status !== 'Cancelled' &&
          a.status !== 'Deleted' &&
          a.status !== 'No Show' &&
          (!editingAppt || a.id !== editingAppt.id)
        );

        if (hasConflict) {
          notify('error', 'Doctor Overlap Conflict', `Dr. ${selectedDocObj.name} already has an active appointment at ${form.appointment_time} on ${form.next_visit}. Please choose a different slot.`);
          setSaving(false);
          return;
        }
      }

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

      if (isActuallyHistorical) {
        payload.status = 'Completed';
      }

      // Backup appointments for rollback fallback
      previousAppointments = [...appointments];

      // Optimistic update representation
      const tempId = -Math.floor(Math.random() * 90000 + 10000);
      const optimisticPayload = {
        id: tempId,
        ...payload,
        status: isActuallyHistorical ? 'Completed' : (editingAppt ? (editingAppt.status || 'Pending') : 'Pending'),
        created_at: new Date().toISOString()
      };

      // Optimistically update inside local React state immediately
      if (editingAppt) {
        setAppointments(prev => prev.map(a => a.id === editingAppt.id ? { ...a, ...payload } : a));
      } else {
        setAppointments(prev => [optimisticPayload, ...prev]);
      }

      if (editingAppt) {
        // Update
        const { error } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', editingAppt.id);

        if (error) throw error;
        await syncPatientStatusByAppointment(editingAppt.id);
        notify('success', 'Roster Rescheduled', `Successfully rescheduled and updated Dr. ${selectedDocObj.name} consulting hours.`);
      } else {
        // Insert
        const { data: insertedData, error } = await supabase
          .from('appointments')
          .insert([payload])
          .select();

        if (error) {
          if (error.code === '23505') {
            notify('error', 'Duplicate Slot Alert', 'This patient already carries an appointment at this exact date & time.');
            // Roll back status
            setAppointments(previousAppointments);
            setSaving(false);
            return;
          }
          throw error;
        }
        if (insertedData?.[0]?.patient_id) {
          await syncPatientStatus(insertedData[0].patient_id);
        }
        notify('success', 'Appointment Set', `Successfully scheduled appointment with Dr. ${selectedDocObj.name}`);
        
        // Post-mutation hook broadcast - a new patient has joined the queue
        broadcastQueueChange('new-patient', payload.name);
      }

      if (!isActuallyHistorical) {
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
      } else {
        setSavedWhatsAppAlerts(null);
      }

      setShowModal(false);
      fetch();
      fetchAllPatients();
    } catch (err: any) {
      console.error(err);
      // Roll back to previous backup on error
      setAppointments(previousAppointments);
      notify('error', 'Booking Error', err.message || 'Operation failed. Please check network.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = appointments.filter(a => {
    const s = search.toLowerCase();
    const matchSearch = !search || a.name?.toLowerCase().includes(s) || a.phone?.includes(s) || a.treatment?.toLowerCase().includes(s) || a.doctor_name?.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    
    // YYYY-MM-DD
    const todayString = new Date().toLocaleDateString('en-CA');
    const matchDate = todayOnly ? (a.next_visit === todayString) : (!dateFilter || a.next_visit === dateFilter);
    
    return matchSearch && matchStatus && matchDate;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'default') return 0;
    
    let valA = '';
    let valB = '';
    
    if (sortBy === 'patient_name') {
      valA = (a.name || '').toLowerCase();
      valB = (b.name || '').toLowerCase();
    } else if (sortBy === 'time') {
      valA = a.appointment_time || '99:99';
      valB = b.appointment_time || '99:99';
    }
    
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleAll = () => {
    if (selectedIds.length === sortedFiltered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedFiltered.map(a => a.id));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const triggerBulkReminders = () => {
    if (selectedIds.length === 0) return;
    const initialStatuses: Record<number, 'pending' | 'sending' | 'success' | 'failed' | 'opened'> = {};
    selectedIds.forEach(id => {
      initialStatuses[id] = 'pending';
    });
    setIndividualStatuses(initialStatuses);
    setBulkFeedback([]);
    setShowBulkModal(true);
    setBulkSending(false);
  };

  const handleSendWhatsAppSingle = async (apptId: number) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;

    setIndividualStatuses(prev => ({ ...prev, [apptId]: 'sending' }));

    const defaultDocName = (doctors && doctors[0]?.name) || 'Dr. Bhavani';
    const customMessage = replaceTokens(bulkWhatsAppMessage, appt, defaultDocName);
    const formattedPhone = formatWhatsAppPhone(appt.phone);

    // Check configuration
    const twilioSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER;

    if (twilioSid && twilioAuthToken && twilioWhatsAppNumber) {
      try {
        const res = await window.fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            bg: true,
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: `whatsapp:+${formattedPhone}`,
              From: twilioWhatsAppNumber.startsWith('whatsapp:') ? twilioWhatsAppNumber : `whatsapp:${twilioWhatsAppNumber}`,
              Body: customMessage,
            }),
          } as any
        );

        if (res.ok) {
          setIndividualStatuses(prev => ({ ...prev, [apptId]: 'success' }));
          setBulkFeedback(prev => [...prev, `[SUCCESS] Automatically sent to ${appt.name} (${appt.phone})!`]);
          logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Bulk Alert', 'Sent', customMessage, appt.patient_id, appt.id);
        } else {
          throw new Error(`API returned ${res.status}`);
        }
      } catch (err: any) {
        setIndividualStatuses(prev => ({ ...prev, [apptId]: 'failed' }));
        setBulkFeedback(prev => [...prev, `[FAILED] Twilio error for ${appt.name}: ${err.message || 'Error'}`]);
      }
    } else {
      try {
        await logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Bulk Alert', 'Sent', customMessage, appt.patient_id, appt.id);
      } catch (err) {
        console.error("Failed to log WhatsApp delivery:", err);
      }
      
      openWhatsApp(appt.phone, customMessage);
      setIndividualStatuses(prev => ({ ...prev, [apptId]: 'opened' }));
      setBulkFeedback(prev => [...prev, `[SUCCESS] Opened click-to-chat window for ${appt.name}`]);
    }
  };

  const handleBlastAllAuto = async () => {
    setBulkSending(true);
    const idsToDispatch = [...selectedIds];

    for (const id of idsToDispatch) {
      if (individualStatuses[id] === 'success' || individualStatuses[id] === 'opened') continue;

      setIndividualStatuses(prev => ({ ...prev, [id]: 'sending' }));
      const appt = appointments.find(a => a.id === id);
      if (appt) {
        const defaultDocName = (doctors && doctors[0]?.name) || 'Dr. Bhavani';
        const customMessage = replaceTokens(bulkWhatsAppMessage, appt, defaultDocName);
        const formattedPhone = formatWhatsAppPhone(appt.phone);

        const twilioSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
        const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
        const twilioWhatsAppNumber = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER;

        if (twilioSid && twilioAuthToken && twilioWhatsAppNumber) {
          try {
            const res = await window.fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuthToken}`),
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  To: `whatsapp:+${formattedPhone}`,
                  From: twilioWhatsAppNumber.startsWith('whatsapp:') ? twilioWhatsAppNumber : `whatsapp:${twilioWhatsAppNumber}`,
                  Body: customMessage,
                }),
              }
            );

            if (res.ok) {
              setIndividualStatuses(prev => ({ ...prev, [id]: 'success' }));
              setBulkFeedback(prev => [...prev, `[SUCCESS] Automatically sent to ${appt.name} via Twilio.`]);
              logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Bulk Alert', 'Sent', customMessage, appt.patient_id, appt.id);
            } else {
              throw new Error();
            }
          } catch {
            setIndividualStatuses(prev => ({ ...prev, [id]: 'failed' }));
            setBulkFeedback(prev => [...prev, `[FAILED] Twilio error for ${appt.name}`]);
          }
        } else {
          try {
            await logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Bulk Alert', 'Sent', customMessage, appt.patient_id, appt.id);
          } catch (err) {
            console.error("Failed to log WhatsApp delivery:", err);
          }
          
          openWhatsApp(appt.phone, customMessage);
          setIndividualStatuses(prev => ({ ...prev, [id]: 'opened' }));
          setBulkFeedback(prev => [...prev, `[SUCCESS] Opened link for ${appt.name}`]);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    }
    setBulkSending(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold',
      Pending: 'bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold',
      Confirmed: 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold',
      'Reminder Sent': 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold',
      Cancelled: 'bg-rose-50 text-rose-600 border border-rose-200/60 font-semibold',
      'No Show': 'bg-slate-100 text-slate-600 border border-slate-300 font-semibold',
    };
    return map[status] || 'bg-slate-50 text-slate-600 border border-slate-200';
  };

  const matchedSuggestions = allPatients.filter(p => {
    const q = patientSearchQuery.trim().toLowerCase();
    if (!q) return false;
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.patient_code && p.patient_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setTodayOnly(false); }} placeholder="Search patient name, phone, specialist, treatment…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTodayOnly(p => !p)}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer select-none ${
              todayOnly 
                ? 'bg-teal-50 border-teal-300 text-teal-700 ring-2 ring-teal-500/10' 
                : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
            }`}
            title="Toggle today's appointments only"
          >
            <Calendar size={15} className={todayOnly ? 'text-teal-600' : 'text-slate-400'} />
            <span>Today's Apps</span>
          </button>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white cursor-pointer">
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          {!todayOnly && (
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white" />
          )}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white cursor-pointer font-medium text-slate-700">
            <option value="default">Sort: Default</option>
            <option value="time">Sort: Time</option>
            <option value="patient_name">Sort: Patient Name</option>
          </select>
          {sortBy !== 'default' && (
            <button
               type="button"
              onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-600 flex items-center gap-1 transition cursor-pointer"
              title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              <span>{sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}</span>
            </button>
          )}
          {syncing && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 bg-teal-50 px-3 py-2.5 rounded-xl border border-teal-150 animate-pulse">
              <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <span className="max-sm:hidden">Syncing data...</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowScheduler(p => !p)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold shadow-xs transition whitespace-nowrap cursor-pointer ${
              showScheduler 
                ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-150'
            }`}
          >
            <Clock size={15} className={showScheduler ? 'text-white' : 'text-emerald-700'} />
            <span>Reminders Scheduler</span>
          </button>
          <button onClick={handleOpenBookModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap cursor-pointer">
            <Plus size={16} /> Book Appointment
          </button>
        </div>
      </div>

      {showScheduler && (
        <div id="scdc-whatsapp-scheduler-panel" className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight">Sri Chaitanya Dental Care WhatsApp Scheduler</h3>
                <p className="text-xs text-slate-300 font-medium">Configure automated clinical appointment queues & reminders</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearQueueState}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-350 text-xs font-bold rounded-lg transition border border-rose-500/20 cursor-pointer"
                title="Reset dispatch history logs for dry running different tests"
              >
                Reset Queue Logs
              </button>
              <button
                type="button"
                onClick={handleSyncAllTemplates}
                disabled={syncingTemplates}
                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-350 text-xs font-bold rounded-lg transition border border-emerald-500/20 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                title="Synchronize templates and signature parameters with Settings"
              >
                <RefreshCw size={12} className={syncingTemplates ? 'animate-spin' : ''} />
                <span>Sync All Templates</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScheduler(false)}
                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Rules form */}
            <div className="lg:col-span-5 bg-white/5 p-5 rounded-xl border border-white/5 space-y-4">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 border-b border-white/5 pb-2 font-mono uppercase tracking-wider select-none">
                ⚙️ Automation Settings
              </h4>

              {/* Day Before Rule toggle */}
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group select-none">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-200 group-hover:text-white transition">Day-Before 24hr Reminder</p>
                    <p className="text-[10px] text-slate-400">Dispatch clinical check-up alert a day prior</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={schedulerRules.dayBeforeEnabled}
                    onChange={e => saveSchedulerRules({ ...schedulerRules, dayBeforeEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 bg-white/10 border-white/15 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>
                
                {schedulerRules.dayBeforeEnabled && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 pl-4 border-l border-white/10">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1 font-semibold">Delivery Time</p>
                      <input
                        type="time"
                        value={schedulerRules.dayBeforeTime}
                        onChange={e => saveSchedulerRules({ ...schedulerRules, dayBeforeTime: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1 font-semibold">Template Choice</p>
                      <select
                        value={schedulerRules.dayBeforeTemplate}
                        onChange={e => saveSchedulerRules({ ...schedulerRules, dayBeforeTemplate: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="tomorrow_reminder">Reminder Theme</option>
                        <option value="appointment_reminder">Standard Template</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Same Day Rule toggle */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <label className="flex items-center justify-between cursor-pointer group select-none">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-200 group-hover:text-white transition">Same-Day Scheduled Alert</p>
                    <p className="text-[10px] text-slate-400">Queue & send alert on actual appointment day</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={schedulerRules.sameDayEnabled}
                    onChange={e => saveSchedulerRules({ ...schedulerRules, sameDayEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 bg-white/10 border-white/15 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>

                {schedulerRules.sameDayEnabled && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 pl-4 border-l border-white/10">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1 font-semibold font-mono">Delivery Time</p>
                      <input
                        type="time"
                        value={schedulerRules.sameDayTime}
                        onChange={e => saveSchedulerRules({ ...schedulerRules, sameDayTime: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1 font-semibold">Template Choice</p>
                      <select
                        value={schedulerRules.sameDayTemplate}
                        onChange={e => saveSchedulerRules({ ...schedulerRules, sameDayTemplate: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="appointment_reminder">Standard Template</option>
                        <option value="tomorrow_reminder">Reminder Theme</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Live Active Queue Container */}
            <div className="lg:col-span-7 bg-white/5 p-5 rounded-xl border border-white/5 flex flex-col h-[400px]">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-mono uppercase tracking-wider select-none">
                  📋 Live Delivery Queue
                </h4>
                <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase font-mono">
                  Active Feed
                </span>
              </div>

              {/* Search Bar & Patient Type Filters */}
              <div className="mb-3 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={schedulerSearchQuery}
                    onChange={e => setSchedulerSearchQuery(e.target.value)}
                    placeholder="Search queue by patient name or phone..."
                    className="w-full bg-slate-900/90 border border-white/10 rounded-lg pl-8 pr-12 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-sans"
                    id="scheduler-search-input"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search size={13} />
                  </div>
                  {schedulerSearchQuery && (
                    <button
                      onClick={() => setSchedulerSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer text-[10px] font-bold border-0 bg-transparent"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="w-full sm:w-44">
                  <select
                    value={schedulerPatientTypeFilter}
                    onChange={e => setSchedulerPatientTypeFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer font-sans"
                    id="scheduler-patient-type-select"
                  >
                    <option value="All">All Patient Types</option>
                    <option value="New">New Patients</option>
                    <option value="Returning">Returning Patients</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Smart Send & Filter Controls */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950/40 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setFilterOnlyDue(prev => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    filterOnlyDue 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/5' 
                      : 'bg-slate-900 text-slate-300 border-white/5 hover:bg-slate-800'
                  }`}
                  title="Filter only appointments whose calculated optimal reminder schedule is past or current"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${filterOnlyDue ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span>Due for Reminder Only ({dueAppointmentsInView.length})</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleSmartSendAllDue(dueAppointmentsInView)}
                  disabled={dueAppointmentsInView.length === 0 || isSmartBatchSending}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-450 focus:outline-none disabled:opacity-40 text-slate-950 text-[11px] font-extrabold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/5 disabled:pointer-events-none"
                  title="Sequentially trigger optimal WhatsApp templates for all currently due items"
                >
                  <Zap size={10} className="fill-current" />
                  <span>Smart Send All Due ({dueAppointmentsInView.length})</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {(() => {
                  let activeAppts = processedSchedulerAppointments.filter(a => {
                    // Filter by patient type
                    if (schedulerPatientTypeFilter !== 'All') {
                      const isNew = a.visit_type === 'New' || (!a.visit_type && (!a.visit_count || Number(a.visit_count) <= 1));
                      const isReturning = a.visit_type === 'Returning' || (a.visit_count && Number(a.visit_count) > 1);
                      if (schedulerPatientTypeFilter === 'New' && !isNew) return false;
                      if (schedulerPatientTypeFilter === 'Returning' && !isReturning) return false;
                    }
                    
                    // Does it require at least one enabled reminder that has not been processed yet?
                    if (!a.needsDayBefore && !a.needsSameDay) {
                      return false;
                    }

                    // Filter only due
                    if (filterOnlyDue && !a.isDueForReminder) {
                      return false;
                    }

                    return true;
                  });

                  if (schedulerSearchQuery.trim()) {
                    const query = schedulerSearchQuery.toLowerCase().trim();
                    activeAppts = activeAppts.filter(a => {
                      const name = (a.name || '').toLowerCase();
                      const phone = (a.phone || '').toLowerCase();
                      return name.includes(query) || phone.includes(query);
                    });
                  }

                  if (activeAppts.length === 0) {
                    if (schedulerSearchQuery.trim() || schedulerPatientTypeFilter !== 'All') {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-1 py-10 select-none animate-in fade-in duration-300">
                          <p className="text-xs font-bold">No matching patients in queue</p>
                          <p className="text-[10px]">Try adjusting your search query, selecting another patient type, or clear filters.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-1 py-10 select-none">
                        <p className="text-xs font-bold">No active clinical bookings</p>
                        <p className="text-[10px]">Your active delivery queue will auto-calculate target times here once appointments are booked.</p>
                      </div>
                    );
                  }

                  return activeAppts.map(appt => {
                    const targetDateStr = appt.next_visit || '';
                    if (!targetDateStr) return null;
                    
                    const todayDate = new Date();
                    todayDate.setHours(0,0,0,0);
                    
                    const apptDate = (() => {
                      const parts = targetDateStr.split('-');
                      if (parts.length === 3) {
                        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                      }
                      return new Date(targetDateStr);
                    })();
                    apptDate.setHours(0,0,0,0);
                    
                    const dayBeforeTarget = new Date(apptDate);
                    dayBeforeTarget.setDate(dayBeforeTarget.getDate() - 1);
                    
                    const formattedDayBefore = dayBeforeTarget.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                    const isDayBeforeReady = todayDate >= dayBeforeTarget;
                    const isDayBeforeDispatched = dispatchedReminderIds.includes(`${appt.id}-dayBefore`);

                    const isSameDayReady = todayDate >= apptDate;
                    const isSameDayDispatched = dispatchedReminderIds.includes(`${appt.id}-sameDay`);

                    // Display display reasoning
                    const reasons: string[] = [];
                    const balance = parseFloat(appt.balance_amount || '0');
                    const isPaymentReminder = balance > 0;

                    const treatmentLower = (appt.treatment || '').toLowerCase();
                    const notesLower = (appt.notes || '').toLowerCase();
                    const isFollowUp = treatmentLower.includes('follow-up') || 
                                       treatmentLower.includes('follow up') || 
                                       treatmentLower.includes('followup') || 
                                       treatmentLower.includes('review') || 
                                       treatmentLower.includes('check-up') ||
                                       treatmentLower.includes('checkup') ||
                                       treatmentLower.includes('check up') ||
                                       notesLower.includes('follow-up') ||
                                       notesLower.includes('follow up') ||
                                       notesLower.includes('followup') ||
                                       notesLower.includes('review') ||
                                       notesLower.includes('check-up') ||
                                       notesLower.includes('check up');

                    if (isFollowUp) {
                      reasons.push("Follow-up Reminder");
                    }
                    if (isPaymentReminder) {
                      reasons.push("Payment Reminder");
                    }
                    if (reasons.length === 0) {
                      reasons.push("Appointment Reminder");
                    }

                    const lastContactedStamp = (() => {
                      const dbMatches = whatsappDbMessages.filter(m => 
                        (appt.patient_id && m.patient_id === appt.patient_id) || 
                        (m.appointment_id === appt.id) || 
                        (m.phone && m.phone.replace(/\D/g, '').slice(-10) === appt.phone.replace(/\D/g, '').slice(-10))
                      );

                      const localMatches = getWhatsAppLogs().filter(l => 
                        (l.recipientPhone && l.recipientPhone.replace(/\D/g, '').slice(-10) === appt.phone.replace(/\D/g, '').slice(-10)) ||
                        (l.recipientName && l.recipientName.toLowerCase() === appt.name.toLowerCase())
                      );

                      let latest = 0;
                      dbMatches.forEach(m => {
                        const t = new Date(m.sent_at || m.created_at).getTime();
                        if (t > latest) latest = t;
                      });
                      localMatches.forEach(l => {
                        const t = new Date(l.timestamp).getTime();
                        if (t > latest) latest = t;
                      });

                      if (latest > 0) {
                        return new Date(latest).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        });
                      }
                      return null;
                    })();

                    const isNewPatient = appt.visit_type === 'New' || (!appt.visit_type && (!appt.visit_count || Number(appt.visit_count) <= 1));

                    const isDue = appt.isDueForReminder;

                    return (
                      <div key={appt.id} className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition duration-350 font-sans ${isDue ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900/40 border-amber-500/45 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20' : 'bg-slate-900/60 border-white/5 hover:border-slate-700'}`}>
                        <div className="space-y-0.5 text-left w-full sm:w-auto">
                          <div className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                            <span>{appt.name}</span>
                            <span className="text-[10px] font-medium text-slate-400 font-mono">({appt.phone})</span>
                            <span className={`text-[8px] font-sans font-semibold px-1.5 py-0.5 rounded leading-none ${isNewPatient ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20' : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'}`}>
                              {isNewPatient ? 'New' : 'Returning'}
                            </span>
                            {lastContactedStamp && (
                              <span className="text-[8.5px] font-sans font-semibold px-1.5 py-0.5 rounded leading-none bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" title="Prevents duplicate reminder messaging">
                                Last Contacted: {lastContactedStamp}
                              </span>
                            )}
                            {isDue && (
                              <span className="text-[8.5px] font-sans font-semibold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 flex items-center gap-0.5 font-mono font-black animate-pulse uppercase leading-none" title="Optimal delivery window is current or past">
                                <Zap size={8} className="fill-current" /> Due Support
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-350">{appt.treatment} with {appt.doctor_name || 'Dr. Bhavani'}</p>
                          <p className="text-[9px] text-slate-400 flex flex-wrap items-center gap-x-2">
                            <span>Slot Hour: <strong>{appt.appointment_time || 'General'}</strong> on <strong>{appt.next_visit}</strong></span>
                            {appt.optimalReminderTime && (
                              <span className="text-amber-400/90 font-medium flex items-center gap-0.5">
                                <Clock size={9} /> (Optimal: {appt.optimalTimeStr})
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-white/5">
                            {reasons.map((r, rIdx) => {
                              let badgeColor = "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
                              if (r === "Follow-up Reminder") badgeColor = "bg-purple-600/20 text-purple-300 border-purple-500/30";
                              if (r === "Payment Reminder") badgeColor = "bg-rose-600/20 text-rose-350 border-rose-500/30";
                              return (
                                <span key={rIdx} className={`text-[8.5px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border ${badgeColor}`}>
                                  {r}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center justify-end">
                          {/* Quick Template Switcher Dropdown */}
                          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-white/5">
                            <span className="text-[9px] text-slate-400 pl-1 uppercase font-semibold">Template:</span>
                            <select
                              value={customPatientTemplates[appt.id] || ''}
                              onChange={e => setCustomPatientTemplates(prev => ({ ...prev, [appt.id]: e.target.value }))}
                              className="bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer font-sans"
                              title="Override template for this specific patient on the fly"
                            >
                              <option value="" className="text-slate-400">Auto (Default)</option>
                              <option value="tomorrow_reminder">Reminder Theme</option>
                              <option value="appointment_reminder">Standard Template</option>
                              <option value="others">General Greeting</option>
                            </select>
                          </div>

                          {/* Quick Reply Actions */}
                          <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-lg border border-white/5">
                            <span className="text-[9px] text-slate-400 pl-1 uppercase font-semibold">Quick:</span>
                            <button
                              type="button"
                              onClick={async () => {
                                const rawStr = "Hi [Name], please reply with 'Confirm' or 'Yes' to confirm your upcoming [Treatment] slot with [Doctor] on [Date] at [Time]. Thank you!";
                                const doc = appt.doctor_name || 'Dr. Bhavani';
                                const msg = replaceTokens(rawStr, appt, doc);
                                openWhatsApp(appt.phone, msg);
                                await logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Quick Link: Confirm', 'Sent', msg, appt.patient_id, appt.id);
                                setTimeout(() => fetchWhatsappDbMessages(), 1000);
                              }}
                              className="bg-emerald-600/35 hover:bg-emerald-600 hover:text-white text-emerald-350 px-2 py-0.5 rounded text-[9.5px] font-bold transition cursor-pointer border-0 leading-none"
                              title="Send Confirm link instantly"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const rawStr = "Hi [Name], we have some scheduling adjustments. Would you like to reschedule your upcoming [Treatment] slot with [Doctor] on [Date] at [Time]? Please reply to confirm.";
                                const doc = appt.doctor_name || 'Dr. Bhavani';
                                const msg = replaceTokens(rawStr, appt, doc);
                                openWhatsApp(appt.phone, msg);
                                await logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Quick Link: Reschedule', 'Sent', msg, appt.patient_id, appt.id);
                                setTimeout(() => fetchWhatsappDbMessages(), 1000);
                              }}
                              className="bg-amber-600/35 hover:bg-amber-600 hover:text-white text-amber-300 hover:text-white px-2 py-0.5 rounded text-[9.5px] font-bold transition cursor-pointer border-0 leading-none"
                              title="Send Reschedule link instantly"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                // Update 'Thank You' template to suggest a 6-month recall date
                                const rDate = new Date();
                                rDate.setMonth(rDate.getMonth() + 6);
                                const recallDateStr = rDate.toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                });
                                const rawStr = `Hi [Name], 🙏 Thank You for Visiting! We appreciate you choosing our clinic for your [Treatment]. Your next suggested preventive dental check-up recall is on ${recallDateStr} (6 months from now). For any concerns, contact us!`;
                                const doc = appt.doctor_name || 'Dr. Bhavani';
                                const msg = replaceTokens(rawStr, appt, doc);
                                openWhatsApp(appt.phone, msg);
                                await logWhatsAppDelivery(appt.name, appt.phone, 'Patient', 'Quick Link: Thank You', 'Sent', msg, appt.patient_id, appt.id);
                                setTimeout(() => fetchWhatsappDbMessages(), 1000);
                              }}
                              className="bg-blue-600/35 hover:bg-blue-600 hover:text-white text-blue-350 px-2 py-0.5 rounded text-[9.5px] font-bold transition cursor-pointer border-0 leading-none"
                              title="Send Thank You link instantly"
                            >
                              Thank You
                            </button>
                          </div>

                          {/* Day-before queue chip */}
                          {schedulerRules.dayBeforeEnabled && (
                            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-white/5">
                              <span className="text-[9px] text-slate-400">Day-Before ({formattedDayBefore}):</span>
                              {isDayBeforeDispatched ? (
                                <span className="bg-blue-500/20 text-blue-300 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">Sent</span>
                              ) : isDayBeforeReady ? (
                                <button
                                  type="button"
                                  disabled={individualStatuses[appt.id] === 'sending'}
                                  onClick={() => handleDispatchReminder(appt, 'dayBefore')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider cursor-pointer transition disabled:opacity-50"
                                >
                                  {individualStatuses[appt.id] === 'sending' ? 'Sending...' : 'Ready (Send)'}
                                </button>
                              ) : (
                                <span className="bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider animate-pulse">Queued</span>
                              )}
                            </div>
                          )}

                          {/* Same day queue chip */}
                          {schedulerRules.sameDayEnabled && (
                            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-white/5">
                              <span className="text-[9px] text-slate-400">Same-Day:</span>
                              {isSameDayDispatched ? (
                                <span className="bg-blue-500/25 text-blue-300 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">Sent</span>
                              ) : isSameDayReady ? (
                                <button
                                  type="button"
                                  disabled={individualStatuses[appt.id] === 'sending'}
                                  onClick={() => handleDispatchReminder(appt, 'sameDay')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider cursor-pointer transition disabled:opacity-50"
                                >
                                  {individualStatuses[appt.id] === 'sending' ? 'Sending...' : 'Ready (Send)'}
                                </button>
                              ) : (
                                <span className="bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">Queued</span>
                              )}
                            </div>
                          )}

                          {isDue && (
                            <button
                              type="button"
                              disabled={isSmartBatchSending || individualStatuses[appt.id] === 'sending'}
                              onClick={() => {
                                const type = appt.isDayBeforeDue ? 'dayBefore' : 'sameDay';
                                handleDispatchReminder(appt, type);
                              }}
                              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-450 text-slate-950 font-black rounded-lg text-[9px] uppercase tracking-wider cursor-pointer shadow-md shadow-amber-500/15 transition flex items-center gap-1 border-0"
                              title="Instantly dispatch the due reminder template using optimal scheduling"
                            >
                              <Zap size={10} className="fill-current" />
                              <span>Smart Send</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <p className="font-bold text-slate-800">
                    {candidate.name} {candidate.age ? `(Age: ${candidate.age})` : ''}
                  </p>
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
        ) : sortedFiltered.length === 0 ? (
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
                        checked={selectedIds.length === sortedFiltered.length && sortedFiltered.length > 0}
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
                <tbody className="divide-y text-slate-700">
                  {sortedFiltered.map(a => (
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
                          <p className="font-semibold text-slate-700 text-xs">{a.doctor_name || (doctors && doctors[0]?.name) || 'Dr. Bhavani'}</p>
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
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
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
                          <button
                            type="button"
                            onClick={() => handleSendScheduledWhatsApp(a)}
                            disabled={isSendingScheduled[a.id]}
                            className="text-xs text-teal-650 hover:underline font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer border-none bg-transparent p-0"
                            title="Launch WhatsApp Web Alert"
                          >
                            {isSendingScheduled[a.id] ? (
                              <>
                                <svg className="animate-spin h-3 w-3 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Logging...</span>
                              </>
                            ) : (
                              <>
                                <Send size={11} className="text-teal-500" /> WhatsApp
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {sortedFiltered.map(a => (
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
                    <p className="text-[11px] text-slate-500 font-bold">{a.doctor_name || (doctors && doctors[0]?.name) || 'Dr. Bhavani'}</p>
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
                    <button
                      type="button"
                      onClick={() => handleSendScheduledWhatsApp(a)}
                      disabled={isSendingScheduled[a.id]}
                      className="text-xs text-teal-655 hover:underline font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer border-none bg-transparent p-0"
                    >
                      {isSendingScheduled[a.id] ? (
                        <>
                          <svg className="animate-spin h-3 w-3 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span>Logging...</span>
                        </>
                      ) : (
                        <>
                          <Send size={11} className="text-teal-555" /> WhatsApp
                        </>
                      )}
                    </button>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Visual Tracking & Administrative Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4">
        {/* WhatsApp Delivery Logs Log Tracker */}
        <div className="bg-white rounded-2xl border border-slate-205/70 p-5 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-teal-600" />
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">WhatsApp Delivery Logs</h3>
            </div>
            <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-100 uppercase animate-pulse">
              Active Tracker
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(() => {
              const joinedLogs: any[] = [];
              whatsappDbMessages.forEach((msg: any) => {
                let tType = 'Reminder';
                if (msg.message.includes('confirmed') || msg.message.includes('Confirmed') || msg.message.includes('confirm')) {
                  tType = 'Confirmation';
                } else if (msg.message.includes('rescheduled') || msg.message.includes('Rescheduled')) {
                  tType = 'Rescheduled';
                } else if (msg.message.includes('review') || msg.message.includes('Google')) {
                  tType = 'Review Request';
                } else if (msg.message.includes('feedback') || msg.message.includes('How was your')) {
                  tType = 'Feedback Survey';
                }

                let recipientName = msg.patients?.name || '';
                if (!recipientName) {
                  const matchName = msg.message.match(/Hi\s+([^,]+),/i) || msg.message.match(/Patient:\s+([^\n]+)/i);
                  recipientName = matchName ? matchName[1].trim() : 'Patient';
                }
                
                joinedLogs.push({
                  id: 'db-' + msg.id,
                  recipientName,
                  recipientPhone: msg.phone,
                  role: 'Patient',
                  type: tType,
                  status: msg.status || 'Sent',
                  message: msg.message,
                  timestamp: msg.created_at || new Date().toISOString()
                });
              });

              getWhatsAppLogs().forEach((localLog: any) => {
                const isDupe = joinedLogs.some(dbLog => 
                  dbLog.recipientPhone === localLog.recipientPhone && 
                  dbLog.message.substring(0, 30) === localLog.message.substring(0, 30)
                );
                if (!isDupe) {
                  joinedLogs.push({
                    id: localLog.id,
                    recipientName: localLog.recipientName,
                    recipientPhone: localLog.recipientPhone,
                    role: localLog.role || 'Patient',
                    type: localLog.type || 'Reminder',
                    status: localLog.status || 'Sent',
                    message: localLog.message,
                    timestamp: localLog.timestamp
                  });
                }
              });

              joinedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

              if (joinedLogs.length === 0) {
                return (
                  <div className="py-8 text-center text-slate-400 italic text-xs font-medium">
                    No notifications logged yet. Check appointments or schedule reminders.
                  </div>
                );
              }

              return joinedLogs.map((log: any) => {
                const indicator = getWhatsAppMessageTypeIndicator(log.type);
                return (
                  <div key={log.id} className={`p-3 bg-white border ${indicator.borderColor} rounded-xl flex flex-col gap-1 text-xs shadow-2xs transition-all duration-150 hover:shadow-xs`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-semibold">{log.role}</span>
                        <span>{log.recipientName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-semibold">{new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 font-mono flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md border ${indicator.bgColor} ${indicator.textColor} ${indicator.borderColor} font-bold flex items-center gap-1 text-[9px] uppercase tracking-wider`}>
                        <span>{indicator.icon}</span>
                        <span>{log.type}</span>
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{log.recipientPhone}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 text-[9px] font-bold">✔ {log.status}</span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 italic bg-slate-50/50 border border-slate-100/80 p-1.5 rounded mt-1 font-mono whitespace-pre-line leading-relaxed">{log.message}</p>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Database Backup & export container for admins only */}
        <div className="bg-white rounded-2xl border border-slate-205/70 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <HeartPulse size={18} className="text-indigo-600" />
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Admin Action Hub</h3>
            </div>
            {admin ? (
              <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                Authorized
              </span>
            ) : (
              <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 uppercase">
                View Only
              </span>
            )}
          </div>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Admins can initiate full state hot-backup of patient profiles, consultation histories, and ledger schemas.
            </p>

            {admin ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const backupData = {
                        version: '1.2_SriChaitanya_CRM',
                        timestamp: new Date().toISOString(),
                        appointments: appointments,
                        doctors: doctors,
                        whatsapp_logs: getWhatsAppLogs()
                      };
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `Sri_Chaitanya_CRM_Database_Backup_${new Date().toISOString().split('T')[0]}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                      notify('success', 'Backup Export Generated', 'Database hot-backup file generated, validated, and downloaded successfully.');
                    } catch (e: any) {
                      notify('error', 'Execution Error', 'Backup aggregation failed.');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer shadow-sm transition active:scale-98"
                >
                  <Send size={13} className="rotate-90" /> Download Database Backup
                </button>
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-[10px] text-slate-500 font-medium leading-relaxed">
                  Backup consists of full relational table streams (JSON format). Recommended before run-level server updates.
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-amber-100 text-amber-800 rounded-xl p-3.5 text-xs flex gap-2 items-start font-semibold zoom-in-95 animate-in">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Only System Administrators carry credentials authorized to generate full schema hot-backups or clinical logs download.
                </p>
              </div>
            )}
          </div>
        </div>
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
              {/* Existing Patient Search Panel */}
              <div className="bg-teal-50/50 rounded-xl p-3 border border-teal-100/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 block">Existing Patient Search (Auto-fill)</label>
                  {selectedPatientId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(null);
                        setForm(f => ({ ...f, name: '', phone: '', email: '', location: '' }));
                        setPatientSearchQuery('');
                      }}
                      className="text-[10px] font-black text-rose-600 uppercase hover:underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={12} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by Name, Phone, or Patient ID..."
                    value={patientSearchQuery}
                    onChange={(e) => {
                      setPatientSearchQuery(e.target.value);
                      setShowPatientSuggestions(true);
                    }}
                    onFocus={() => setShowPatientSuggestions(true)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                  
                  {/* Suggestions Dropdown */}
                  {showPatientSuggestions && patientSearchQuery.trim() && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {matchedSuggestions.length === 0 ? (
                        <p className="text-slate-400 text-[11px] italic p-3 text-center">No matching patients found. Type to search or book as a new patient below.</p>
                      ) : (
                        matchedSuggestions.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              setForm(f => ({
                                ...f,
                                name: p.name || '',
                                phone: p.phone || '',
                                email: p.email || '',
                                location: p.location || ''
                              }));
                              setPatientSearchQuery(`${p.name} (${p.patient_code || p.id})`);
                              setShowPatientSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-none flex justify-between items-center"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{p.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{p.patient_code} | {p.phone}</p>
                            </div>
                            {p.location && (
                              <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 max-w-[80px] truncate">{p.location}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedPatientId && (
                  <div className="flex items-center gap-1.5 text-[10px] text-teal-600 font-bold bg-white/60 p-1.5 rounded-lg border border-teal-100/25">
                    <CheckCircle2 size={11} /> Link validated with patient card database
                  </div>
                )}
              </div>

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

              {/* Standardized Doctor Select */}
              <DoctorSelect
                selectedId={form.doctor_id}
                selectedName={form.doctor_name}
                required
                label="Consulting Dental Specialist"
                onChange={(doc) => {
                  setForm(f => ({ ...f, doctor_id: doc.id.toString(), doctor_name: doc.name }));
                  setDoctorSearch(doc.name);
                }}
              />

              {/* Treatments dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Treatment Procedure *</label>
                <select value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))} required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-teal-500">
                  <option value="">Select treatment</option>
                  {TREATMENTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Historical Record Entry Toggle */}
              <div className="flex items-center gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/40">
                <input
                  type="checkbox"
                  id="is_historical_appt"
                  checked={isHistorical}
                  onChange={(e) => setIsHistorical(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <label htmlFor="is_historical_appt" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Historical Record Entry <span className="text-[10px] text-amber-600 font-normal">(Documentation; past dates allowed; defaults to Completed)</span>
                </label>
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
              
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-slate-700 text-[10.5px] font-mono whitespace-pre-line leading-relaxed select-all" title="Click to copy message">
                {`Sri Chaitanya Dental Care\n\nNew Appointment Scheduled\n\nPatient:\n${savedWhatsAppAlerts.patientName}\n\nPhone:\n${savedWhatsAppAlerts.patientPhone}\n\nDoctor:\n${savedWhatsAppAlerts.doctorName}\n\nDate:\n${savedWhatsAppAlerts.date}\n\nTime:\n${savedWhatsAppAlerts.time || 'General'}\n\nTreatment:\n${savedWhatsAppAlerts.treatment}\n\nStatus:\n${savedWhatsAppAlerts.status}`}
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Broadcast Action (Dual Roster alerts)</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleAlertPatient}
                    disabled={isAlertingPatient}
                    className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-150 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition disabled:opacity-50"
                  >
                    {isAlertingPatient ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-teal-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Logging...</span>
                      </>
                    ) : (
                      <>
                        <Send size={12} className="text-teal-600" /> Notify Patient
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleAlertDoctor}
                    disabled={isAlertingDoctor}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition disabled:opacity-50"
                  >
                    {isAlertingDoctor ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Logging...</span>
                      </>
                    ) : (
                      <>
                        <Send size={12} className="text-slate-400" /> Notify Doctor
                      </>
                    )}
                  </button>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
              <div className="flex items-center gap-2.5 text-left">
                <CheckSquare size={18} className="text-teal-400 animate-pulse" />
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">WhatsApp Reminders Campaign</h3>
                  <p className="text-[10px] text-slate-400 font-bold font-sans">Sri Chaitanya Dental Practice Portal</p>
                </div>
              </div>
              {!bulkSending && (
                <button 
                  onClick={() => setShowBulkModal(false)} 
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Template Selector Section */}
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 block">Select Reminder Template</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('reminder');
                      setBulkWhatsAppMessage(WHATSAPP_TEMPLATES.reminder);
                    }}
                    className={`px-3 py-2.5 rounded-xl border transition text-center cursor-pointer ${
                      selectedTemplate === 'reminder'
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 font-extrabold text-xs'
                        : 'border-slate-250 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold'
                    }`}
                  >
                    Appt Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('due');
                      setBulkWhatsAppMessage(WHATSAPP_TEMPLATES.due);
                    }}
                    className={`px-3 py-2.5 rounded-xl border transition text-center cursor-pointer ${
                      selectedTemplate === 'due'
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 font-extrabold text-xs'
                        : 'border-slate-250 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold'
                    }`}
                  >
                    Outstanding Due
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('custom');
                      setBulkWhatsAppMessage(WHATSAPP_TEMPLATES.custom);
                    }}
                    className={`px-3 py-2.5 rounded-xl border transition text-center cursor-pointer ${
                      selectedTemplate === 'custom'
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 font-extrabold text-xs'
                        : 'border-slate-250 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold'
                    }`}
                  >
                    Custom Hygienics
                  </button>
                </div>
              </div>

              {/* Master Text Area Field */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Write Master Template Body</span>
                  <span className="text-[9px] font-bold text-slate-400">Tokens: [Name], [Doctor], [Treatment], [Date], [Time], [Balance]</span>
                </div>
                <textarea
                  value={bulkWhatsAppMessage}
                  onChange={(e) => setBulkWhatsAppMessage(e.target.value)}
                  disabled={bulkSending}
                  rows={4}
                  className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 focus:outline-none leading-relaxed text-slate-755 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="Enter custom template body..."
                />
              </div>

              {/* Recipient Queue Grid List */}
              <div className="space-y-2 text-left">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Recipient Dispatch Queue ({selectedIds.length})</label>
                  <span className="text-[10px] text-teal-605 font-bold font-mono">
                    {Object.values(individualStatuses).filter(s => s === 'success' || s === 'opened').length} / {selectedIds.length} Processed
                  </span>
                </div>

                <div className="border border-slate-150 rounded-2xl divide-y divide-slate-100 max-h-64 overflow-y-auto bg-slate-50">
                  {selectedIds.map(apptId => {
                    const appt = appointments.find(a => a.id === apptId);
                    if (!appt) return null;
                    const defaultDocName = (doctors && doctors[0]?.name) || 'Dr. Bhavani';
                    const replacedText = replaceTokens(bulkWhatsAppMessage, appt, defaultDocName);
                    const status = individualStatuses[apptId] || 'pending';

                    return (
                      <div key={apptId} className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-white hover:bg-slate-50/50 transition duration-150">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-xs block">{appt.name}</span>
                            <span className="text-[10.5px] text-slate-450 font-semibold font-mono block">({appt.phone})</span>
                          </div>
                          <p className="text-[11px] text-slate-550 leading-relaxed italic pr-2 font-medium bg-slate-50 border border-slate-100 p-2 rounded-xl">
                            {replacedText}
                          </p>
                        </div>

                        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 flex-shrink-0">
                          {/* Status code badges */}
                          {status === 'pending' && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">Draft</span>
                          )}
                          {status === 'sending' && (
                            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">Delivering…</span>
                          )}
                          {status === 'success' && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded-md">Sent ✔</span>
                          )}
                          {status === 'opened' && (
                            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">Opened ↗</span>
                          )}
                          {status === 'failed' && (
                            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">Failed ✖</span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppSingle(apptId)}
                            disabled={bulkSending || status === 'sending'}
                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-800 text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 font-extrabold rounded-lg text-[10.5px] cursor-pointer transition uppercase"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress feedback logger */}
              {bulkFeedback.length > 0 && (
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-left max-h-32 overflow-y-auto space-y-1 scrollbar-thin">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Process telemetry</span>
                  {bulkFeedback.slice(-4).map((f, i) => (
                    <p key={i} className={`text-[10.5px] font-mono leading-relaxed font-bold break-words ${f.startsWith('[SUCCESS]') ? 'text-emerald-700' : 'text-slate-650'}`}>
                      {f}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 flex-shrink-0">
              <span className="text-[10px] text-slate-400 font-bold text-left block max-w-sm">
                * Note: Individual Web Links open WA Click-To-Chat windows sequentially.
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  disabled={bulkSending}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBlastAllAuto}
                  disabled={bulkSending || selectedIds.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md disabled:bg-indigo-350 transition"
                >
                  {bulkSending ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Blasting Queue...</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Blast All Selected</span>
                    </>
                  )}
                </button>
              </div>
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
