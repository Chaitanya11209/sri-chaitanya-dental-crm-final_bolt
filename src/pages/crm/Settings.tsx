import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, MessageSquare, Save, RefreshCw, HelpCircle, 
  CheckCircle2, Info, UserCheck, CalendarDays, FileSpreadsheet, Sparkles,
  Send, Smartphone, Database, UploadCloud, Globe, Lock, FileJson
} from 'lucide-react';
import { useNotification } from '../../components/NotificationProvider';
import { supabase } from '../../lib/supabase';
import { 
  getSMSTemplates, saveSMSTemplates, DEFAULT_SMS_TEMPLATES, SMSTemplates,
  getSMSChannel, saveSMSChannel, SMSChannel 
} from '../../lib/sms';
import {
  getClinicSignature,
  saveClinicSignature,
  getWhatsAppTemplates,
  saveWhatsAppTemplates,
  DEFAULT_WHATSAPP_TEMPLATES,
  WhatsAppTemplates
} from '../../utils/whatsapp';
import { clinicConfig } from '../../config/clinicConfig';

const WA_TEMPLATE_LABELS: Record<keyof WhatsAppTemplates, { title: string; category: string; description: string; placeholders: string[] }> = {
  appointment_confirmation: {
    title: 'Appointment Confirmation',
    category: 'Visits',
    description: 'Sent immediately when an appointment is booked.',
    placeholders: ['PatientName', 'ClinicAddress', 'Date', 'Time', 'Treatment', 'Signature']
  },
  appointment_reminder: {
    title: 'Appointment Reminder',
    category: 'Visits',
    description: 'Sent prior to scheduled appointment.',
    placeholders: ['PatientName', 'ClinicAddress', 'Date', 'Time', 'Treatment', 'Signature']
  },
  missed_appointment: {
    title: 'Missed Appointment alert',
    category: 'Visits',
    description: 'Sent to check in on patients who missed their scheduled visit.',
    placeholders: ['PatientName', 'Date', 'Treatment', 'Signature']
  },
  followup: {
    title: 'Follow-up Call reminder',
    category: 'Treatments',
    description: 'Reminder regarding upcoming custom clinical follow-up criteria.',
    placeholders: ['PatientName', 'ClinicName', 'Date', 'Treatment', 'NotesBlock', 'Notes', 'Signature']
  },
  thank_you: {
    title: 'Thank You post-visit',
    category: 'Treatments',
    description: 'Sent after a dental appointment/visit to thank patients.',
    placeholders: ['PatientName', 'ClinicName', 'Treatment', 'NextVisitBlock', 'NextVisitDate', 'Signature']
  },
  recall: {
    title: '6-Month Checkup recall',
    category: 'Treatments',
    description: 'Encourage routine exams if not seen for 6+ months.',
    placeholders: ['PatientName', 'ClinicName', 'Treatment', 'Signature']
  },
  treatment_completion: {
    title: 'Treatment Completed summary',
    category: 'Treatments',
    description: 'Official treatment completion summary and dental care dispatch.',
    placeholders: ['PatientName', 'ClinicName', 'Treatment', 'BalanceStatus', 'Balance', 'NextVisitBlock', 'NextVisitDate', 'Signature']
  },
  payment_reminder: {
    title: 'Payment/Pending alert',
    category: 'Billing',
    description: 'Friendly notification of outstanding accounts due balance.',
    placeholders: ['PatientName', 'ClinicName', 'Treatment', 'PendingAmount', 'Signature']
  },
  invoice: {
    title: 'Invoice / Paid receipt',
    category: 'Billing',
    description: 'Sent as confirmation invoice immediately after payment recording.',
    placeholders: ['PatientName', 'ClinicName', 'InvoiceNum', 'AmountReceived', 'BalanceStatus', 'Balance', 'Signature']
  },
  feedback_request: {
    title: 'Patient Feedback request',
    category: 'Engagement',
    description: 'Inquire regarding patient rating and clinical quality.',
    placeholders: ['PatientName', 'ClinicName', 'Treatment', 'Signature']
  },
  google_review: {
    title: 'Google Review Invitation',
    category: 'Engagement',
    description: 'Share a Google Business link requesting local support.',
    placeholders: ['PatientName', 'ClinicName', 'Treatment', 'ReviewUrl', 'Signature']
  },
  birthday: {
    title: 'Birthday Greetings card',
    category: 'Engagement',
    description: 'Send automated warmth on native birthdays.',
    placeholders: ['PatientName', 'Signature']
  }
};

export default function Settings() {
  const { notify } = useNotification();
  const [templates, setTemplates] = useState<SMSTemplates>(getSMSTemplates());
  const [smsChannel, setSmsChannel] = useState<SMSChannel>(getSMSChannel());
  const [clinicSignature, setClinicSignature] = useState(getClinicSignature());
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplates>(getWhatsAppTemplates());
  const [selectedWATemplate, setSelectedWATemplate] = useState<keyof WhatsAppTemplates>('appointment_confirmation');
  const [isSaving, setIsSaving] = useState(false);

  // Active sub-tab for setting types
  const [activeTab, setActiveTab] = useState<'sms' | 'whatsapp' | 'clinical' | 'backup'>('sms');

  // Cloud Backup States
  const [driveToken, setDriveToken] = useState<string | null>(() => {
    const cachedToken = localStorage.getItem('gdrive_backup_token');
    const cachedExpiry = localStorage.getItem('gdrive_backup_token_expiry');
    if (cachedToken && cachedExpiry && Date.now() < Number(cachedExpiry)) {
      return cachedToken;
    }
    return null;
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('gdrive_last_backup_time');
  });
  const [backupFilesCount, setBackupFilesCount] = useState<number>(() => {
    return Number(localStorage.getItem('gdrive_backup_count') || '0');
  });

  // Listener for Google Drive Implicit OAuth Token in Route Hash Redirects
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=') && hash.includes('state=gdrive_backup')) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const token = params.get('access_token');
      const expiresIn = params.get('expires_in');
      if (token) {
        localStorage.setItem('gdrive_backup_token', token);
        localStorage.setItem('gdrive_backup_token_expiry', String(Date.now() + Number(expiresIn || 3600) * 1000));
        // Remove hash from window URL redirect without reloading
        window.history.replaceState(null, '', window.location.pathname);
        setDriveToken(token);
        setActiveTab('backup');
        notify('success', 'Google Drive Protected Connection', 'Your clinical workspace has successfully connected to your Google account folder!');
      }
    }
  }, []);

  const openGoogleOAuthPopup = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '854519965857-mockclientid.apps.googleusercontent.com';
    const redirectUri = window.location.origin + '/crm/settings';
    const scope = 'https://www.googleapis.com/auth/drive.file';
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&state=gdrive_backup`;
    
    // Open login consent frame
    const width = 500;
    const height = 610;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    
    window.open(oauthUrl, 'GoogleOAuthPopup', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const disconnectGoogleDrive = () => {
    localStorage.removeItem('gdrive_backup_token');
    localStorage.removeItem('gdrive_backup_token_expiry');
    setDriveToken(null);
    notify('info', 'Google Drive Disconnected', 'Logged out and cleared active security tokens from local session storage.');
  };

  const runBackupToGoogleDrive = async () => {
    setIsBackingUp(true);
    try {
      const token = driveToken || localStorage.getItem('gdrive_backup_token');
      if (!token) {
        setIsBackingUp(false);
        openGoogleOAuthPopup();
        return;
      }

      notify('info', 'Backup compilation started', 'Fetching and compiling complete clinic database aggregates...');

      // Retrieve full data collections from Supabase
      const [ptsRes, apptsRes, treatRes] = await Promise.all([
        supabase.from('patients').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('treatments').select('*')
      ]);

      if (ptsRes.error) throw new Error(`Patients fetch failure: ${ptsRes.error.message}`);
      if (apptsRes.error) throw new Error(`Appointments fetch failure: ${apptsRes.error.message}`);
      if (treatRes.error) throw new Error(`Treatments fetch failure: ${treatRes.error.message}`);

      const backupPayload = {
        clinic: 'Sri Chaitanya Multispeciality Dental Care',
        exportedAt: new Date().toISOString(),
        schemaVersion: '1.2_cloud_backup',
        data: {
          patientsCount: ptsRes.data?.length || 0,
          appointmentsCount: apptsRes.data?.length || 0,
          treatmentsCount: treatRes.data?.length || 0,
          patients: ptsRes.data || [],
          appointments: apptsRes.data || [],
          treatments: treatRes.data || []
        }
      };

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const filename = `Sri_Chaitanya_Dental_Care_Backup_${dateStr}_${Date.now().toString().slice(-4)}.json`;

      // Formulate a RFC-compliant Multipart Upload payload for Google Drive files endpoint
      const metadata = {
        name: filename,
        mimeType: 'application/json',
        description: `Automated database secure snapshot compiled for Sri Chaitanya Multispeciality Dental Care. Contains full patients database and diagnostic workflows.`
      };

      const boundary = 'scdc_drive_backup_multipart_segment_boundary';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody = 
        `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
        `${delimiter}Content-Type: application/json\r\n\r\n${JSON.stringify(backupPayload)}` +
        `${closeDelimiter}`;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('gdrive_backup_token');
          setDriveToken(null);
          throw new Error('Google security authorization token has expired. Please connect and authenticates again.');
        }
        const errDetail = await response.json().catch(() => ({}));
        throw new Error(errDetail?.error?.message || `Google Drive API returned status: ${response.status}`);
      }

      const timestamp = new Date().toLocaleString('en-IN', { hour12: true });
      localStorage.setItem('gdrive_last_backup_time', timestamp);
      const nextCount = backupFilesCount + 1;
      localStorage.setItem('gdrive_backup_count', String(nextCount));

      setLastBackupTime(timestamp);
      setBackupFilesCount(nextCount);

      notify('success', 'Clinical Data Backed Up', 'All patients records, schedules ledger & logs securely archived to your connected Google Drive account!');
    } catch (err: any) {
      console.error('[Google Drive Backup] Fail:', err);
      notify('error', 'Google Backup Failed', err.message || 'Unable to execute cloud transmission.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Preview simulations state
  const mockPatient = {
    name: 'Chaitanya Kumar',
    treatment: 'Root Canal Therapy',
    date: '2026-06-12',
    time: '11:30 AM',
    total: '8,500',
    paid: '5,000',
    balance: '3,500',
    message: 'Please avoid chewing solid foods for 2 hours post treatment '
  };

  const getAppointmentPreview = () => {
    return templates.appointment
      .replace('[Name]', mockPatient.name)
      .replace('[Treatment]', mockPatient.treatment)
      .replace('[Date]', mockPatient.date)
      .replace('[Time]', mockPatient.time);
  };

  const getPaymentPreview = () => {
    return templates.payment
      .replace('[Name]', mockPatient.name)
      .replace('[Treatment]', mockPatient.treatment)
      .replace('[Total]', mockPatient.total)
      .replace('[Paid]', mockPatient.paid)
      .replace('[Balance]', mockPatient.balance);
  };

  const getGeneralPreview = () => {
    return templates.general
      .replace('[Name]', mockPatient.name)
      .replace('[Message]', mockPatient.message);
  };

  const getWhatsAppPreview = (key: keyof WhatsAppTemplates) => {
    const template = whatsappTemplates[key];
    const signature = clinicSignature;

    const valueMap: Record<string, string> = {
      PatientName: mockPatient.name,
      ClinicAddress: clinicConfig.address,
      ClinicName: clinicConfig.clinicName,
      Date: new Date(mockPatient.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      Time: mockPatient.time,
      Treatment: mockPatient.treatment,
      PendingAmount: mockPatient.balance,
      AmountReceived: mockPatient.paid,
      InvoiceNum: 'INV-482910',
      ReviewUrl: clinicConfig.googleReviewUrl,
      NotesBlock: '\nNotes: Patient requested late evening checkups.',
      Notes: 'Patient requested late evening checkups.',
      NextVisitBlock: `\nNext Visit: ${new Date('2026-06-30').toLocaleDateString('en-IN')}`,
      NextVisitDate: new Date('2026-06-30').toLocaleDateString('en-IN'),
      BalanceStatus: Number(mockPatient.balance.replace(/,/g, '')) > 0 ? `🔴 Balance Due: Rs. ${mockPatient.balance}/-` : '✅ Payment Complete',
      Balance: mockPatient.balance,
      Signature: signature
    };

    let rendered = template;
    for (const [k, val] of Object.entries(valueMap)) {
      rendered = rendered.replaceAll(`{${k}}`, val);
    }
    return rendered;
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      saveSMSTemplates(templates);
      saveSMSChannel(smsChannel);
      saveClinicSignature(clinicSignature);
      saveWhatsAppTemplates(whatsappTemplates);
      setIsSaving(false);
      notify('success', 'CRM Settings Updated', 'All customized communication templates, clinic signatures & dispatch configurations updated successfully!');
    }, 800);
  };

  const handleReset = () => {
    const confirm = window.confirm('Are you sure you want to restore clinic default templates and signatures?');
    if (confirm) {
      if (activeTab === 'sms') {
        setTemplates(DEFAULT_SMS_TEMPLATES);
        saveSMSTemplates(DEFAULT_SMS_TEMPLATES);
        notify('info', 'Defaults Restored', 'SMS templates have been reverted to internal clinic default formats.');
      } else if (activeTab === 'whatsapp') {
        const DEFAULT_SIG = `Thanks & Regards,

Sri Chaitanya Dental Care
Ameenpur, Hyderabad

📞 8317575165

📍 Location:
https://maps.app.goo.gl/LZxFuzZ8ZuHJUjrt7

"We Care For Your Smile"`;
        setClinicSignature(DEFAULT_SIG);
        setWhatsappTemplates(DEFAULT_WHATSAPP_TEMPLATES);
        saveClinicSignature(DEFAULT_SIG);
        saveWhatsAppTemplates(DEFAULT_WHATSAPP_TEMPLATES);
        notify('info', 'Defaults Restored', 'WhatsApp templates and clinic signature have been reverted to default settings.');
      } else {
        notify('info', 'No templates to reset', 'No reset templates for clinical threshold rules.');
      }
    }
  };

  const insertPlaceholder = (fieldName: keyof SMSTemplates, placeholder: string) => {
    setTemplates({
      ...templates,
      [fieldName]: templates[fieldName] + placeholder
    });
  };

  const insertWAPlaceholder = (fieldName: keyof WhatsAppTemplates, placeholder: string) => {
    setWhatsappTemplates({
      ...whatsappTemplates,
      [fieldName]: whatsappTemplates[fieldName] + `{${placeholder}}`
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <SettingsIcon size={20} className="animate-spin-slow" />
            </div>
            <h1 className="text-xl font-black tracking-tight font-sans">CRM System Configurations</h1>
          </div>
          <p className="text-xs text-indigo-200 mt-1.5 leading-relaxed max-w-xl">
            Configure automated patient communication templates, placeholder triggers, and custom workflow rules for Sri Chaitanya Dental Clinic.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-750 text-xs font-semibold cursor-pointer transition"
            title="Reset default clinical parameters"
          >
            <RefreshCw size={13} />
            <span>Reset Defaults</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Navigation / Information Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-3xl border border-slate-200/85 p-5 shadow-xs">
            <h3 className="text-slate-900 font-bold text-sm tracking-tight mb-3">Settings Categories</h3>
            <div className="space-y-1.5">
              <button 
                onClick={() => setActiveTab('sms')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-black transition cursor-pointer text-left ${
                  activeTab === 'sms' 
                    ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-indigo-600" />
                  SMS Messaging Templates
                </span>
                <span className="text-[10px] bg-indigo-100 px-2 py-0.5 rounded-full text-indigo-700">Configured</span>
              </button>
              <button 
                onClick={() => setActiveTab('whatsapp')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-black transition cursor-pointer text-left ${
                  activeTab === 'whatsapp' 
                    ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Send size={14} className="text-emerald-600" />
                  WhatsApp & Clinic Signatures
                </span>
                <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full text-emerald-700">Dynamic</span>
              </button>
              <button 
                onClick={() => setActiveTab('clinical')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-black transition cursor-pointer text-left ${
                  activeTab === 'clinical' 
                    ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <UserCheck size={14} className="text-slate-400" />
                  Clinical Threshold Rules
                </span>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Standard</span>
              </button>
              <button 
                onClick={() => setActiveTab('backup')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-black transition cursor-pointer text-left ${
                  activeTab === 'backup' 
                    ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Database size={14} className="text-blue-600" />
                  Google Drive Backup
                </span>
                <span className="text-[10px] bg-blue-100 px-2 py-0.5 rounded-full text-blue-750 font-bold">Secure</span>
              </button>
            </div>
          </div>

          <div className="bg-amber-50/75 border border-amber-200/80 rounded-3xl p-5 space-y-3.5">
            <h4 className="font-extrabold text-amber-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={15} className="text-amber-600" />
              Dynamic Variable Keys
            </h4>
            <p className="text-[11px] leading-relaxed text-amber-900-75 font-medium text-slate-600">
              When customizing SMS bodies, copy or write the exact brackets keywords. The CRM engine will automatically fill them with real values at delivery time:
            </p>
            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/40">
                <p className="font-black text-[10px] text-amber-950 uppercase tracking-wide">For Appointments</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Name]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Treatment]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Date]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Time]</code>
                </div>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/40">
                <p className="font-black text-[10px] text-amber-950 uppercase tracking-wide">For Payments & Billing</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Name]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Treatment]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Total]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Paid]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Balance]</code>
                </div>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/40">
                <p className="font-black text-[10px] text-amber-950 uppercase tracking-wide">For Custom Bulk SMS</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Name]</code>
                  <code className="text-[10px] font-mono bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded-md font-bold">[Message]</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Templates Interface */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'sms' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Dispatch Channel Config */}
              <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 shadow-sm space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <Smartphone size={16} />
                    </div>
                    <span className="font-extrabold text-xs text-white uppercase tracking-wider">Preferred Messaging dispatch method</span>
                  </div>
                  <p className="text-[11px] text-slate-350 leading-relaxed mt-1.5">
                    Clicking the <strong className="text-white">"SMS"</strong> or <strong className="text-white">"Message"</strong> alert triggers inside the CRM will instantly route through your choice below. Select any <strong>100% Free</strong> option to bypass costly SMS packages!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* WhatsApp Direct */}
                  <div 
                    onClick={() => setSmsChannel('whatsapp')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col gap-3 justify-between ${
                      smsChannel === 'whatsapp' 
                        ? 'bg-emerald-950/45 border-emerald-500 text-white' 
                        : 'bg-slate-850 border-slate-750 text-slate-400 hover:border-slate-650'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Send size={18} className={smsChannel === 'whatsapp' ? 'text-emerald-400' : 'text-slate-500'} />
                        <span className="text-[9px] font-black uppercase bg-emerald-500/25 text-emerald-350 px-2 py-0.5 rounded-full">
                          100% Free
                        </span>
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-100 font-sans">WhatsApp Direct</h4>
                      <p className="text-[10px] leading-relaxed font-semibold text-slate-400">
                        Opens patient's WhatsApp pre-filled with the message template. Unlimited & free!
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                      <div className={`w-1.5 h-1.5 rounded-full ${smsChannel === 'whatsapp' ? 'bg-emerald-400' : 'bg-slate-650'}`} />
                      <span>{smsChannel === 'whatsapp' ? 'Selected Method' : 'Tap to select'}</span>
                    </div>
                  </div>

                  {/* Device Native */}
                  <div 
                    onClick={() => setSmsChannel('device')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col gap-3 justify-between ${
                      smsChannel === 'device' 
                        ? 'bg-indigo-950/45 border-indigo-500 text-white' 
                        : 'bg-slate-850 border-slate-750 text-slate-400 hover:border-slate-650'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Smartphone size={18} className={smsChannel === 'device' ? 'text-indigo-400' : 'text-slate-500'} />
                        <span className="text-[9px] font-black uppercase bg-indigo-500/25 text-indigo-350 px-2 py-0.5 rounded-full">
                          Free via SIM
                        </span>
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-100 font-sans">Device Native SMS</h4>
                      <p className="text-[10px] leading-relaxed font-semibold text-slate-400">
                        Launches your phone or PC's built-in SMS composer. Uses your mobile/SIM plan.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                      <div className={`w-1.5 h-1.5 rounded-full ${smsChannel === 'device' ? 'bg-indigo-400' : 'bg-slate-650'}`} />
                      <span>{smsChannel === 'device' ? 'Selected Method' : 'Tap to select'}</span>
                    </div>
                  </div>

                  {/* Cloud API */}
                  <div 
                    onClick={() => setSmsChannel('cloud')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col gap-3 justify-between ${
                      smsChannel === 'cloud' 
                        ? 'bg-sky-950/45 border-sky-500 text-white' 
                        : 'bg-slate-850 border-slate-750 text-slate-400 hover:border-slate-650'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <MessageSquare size={18} className={smsChannel === 'cloud' ? 'text-sky-400' : 'text-slate-500'} />
                        <span className="text-[9px] font-black uppercase bg-slate-750 text-slate-400 px-2 py-0.5 rounded-full">
                          Paid API Plan
                        </span>
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-100 font-sans">Cloud SMS Gateway</h4>
                      <p className="text-[10px] leading-relaxed font-semibold text-slate-400">
                        Automated silent background dispatch via Twilio interface or custom API servers.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                      <div className={`w-1.5 h-1.5 rounded-full ${smsChannel === 'cloud' ? 'bg-sky-400' : 'bg-slate-650'}`} />
                      <span>{smsChannel === 'cloud' ? 'Selected Method' : 'Tap to select'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointment template card */}
              <div className="bg-white rounded-3xl border border-slate-200/85 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <CalendarDays size={16} />
                    </div>
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Appointment Confirmation SMS</span>
                  </div>
                  <span className="text-[10px] bg-slate-150 text-slate-500 px-2 py-0.5 rounded-full font-bold">Category: Visits</span>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Message Body</label>
                  <textarea
                    value={templates.appointment}
                    onChange={(e) => setTemplates({ ...templates, appointment: e.target.value })}
                    rows={3}
                    className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-none leading-relaxed text-slate-700"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 py-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Insert Key:</span>
                    {['[Name]', '[Treatment]', '[Date]', '[Time]'].map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => insertPlaceholder('appointment', k)}
                        className="text-[10px] font-mono bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 hover:border-slate-350 px-2 py-0.5 rounded-md transition cursor-pointer"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview block */}
                <div className="bg-indigo-950/5 border border-indigo-100 rounded-2xl p-4.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-700 [letter-spacing:1.2px]">
                    <Sparkles size={11} className="text-indigo-600 animate-pulse" />
                    Live Clinical Preview
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-2xs">
                    <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                      {getAppointmentPreview()}
                    </p>
                    <div className="flex items-center justify-between border-t border-slate-50 mt-2.5 pt-2 text-[9px] font-mono text-slate-400 font-bold">
                      <span>Total characters: {getAppointmentPreview().length} chars</span>
                      <span className="text-indigo-600">Standard single SMS billing boundary (160)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment template card */}
              <div className="bg-white rounded-3xl border border-slate-200/85 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <FileSpreadsheet size={16} />
                    </div>
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Billing & Payment Summary SMS</span>
                  </div>
                  <span className="text-[10px] bg-slate-150 text-slate-500 px-2 py-0.5 rounded-full font-bold">Category: Receipts</span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Message Body</label>
                  <textarea
                    value={templates.payment}
                    onChange={(e) => setTemplates({ ...templates, payment: e.target.value })}
                    rows={3}
                    className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-none leading-relaxed text-slate-700"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 py-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Insert Key:</span>
                    {['[Name]', '[Treatment]', '[Total]', '[Paid]', '[Balance]'].map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => insertPlaceholder('payment', k)}
                        className="text-[10px] font-mono bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 hover:border-slate-350 px-2 py-0.5 rounded-md transition cursor-pointer"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview block */}
                <div className="bg-indigo-950/5 border border-indigo-100 rounded-2xl p-4.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-700 [letter-spacing:1.2px]">
                    <Sparkles size={11} className="text-indigo-600 animate-pulse" />
                    Live Clinical Preview
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-2xs">
                    <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                      {getPaymentPreview()}
                    </p>
                    <div className="flex items-center justify-between border-t border-slate-50 mt-2.5 pt-2 text-[9px] font-mono text-slate-400 font-bold">
                      <span>Total characters: {getPaymentPreview().length} chars</span>
                      <span className="text-indigo-600 font-bold">Requires multi-segment concatenation ({Math.ceil(getPaymentPreview().length/160)} parts)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* General template card */}
              <div className="bg-white rounded-3xl border border-slate-200/85 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <MessageSquare size={16} />
                    </div>
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">General & Mass Broadcast SMS</span>
                  </div>
                  <span className="text-[10px] bg-slate-150 text-slate-500 px-2 py-0.5 rounded-full font-bold">Category: Promotional</span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Message Body</label>
                  <textarea
                    value={templates.general}
                    onChange={(e) => setTemplates({ ...templates, general: e.target.value })}
                    rows={3}
                    className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-none leading-relaxed text-slate-700"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 py-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Insert Key:</span>
                    {['[Name]', '[Message]'].map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => insertPlaceholder('general', k)}
                        className="text-[10px] font-mono bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 hover:border-slate-350 px-2 py-0.5 rounded-md transition cursor-pointer"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview block */}
                <div className="bg-indigo-950/5 border border-indigo-100 rounded-2xl p-4.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-700 [letter-spacing:1.2px]">
                    <Sparkles size={11} className="text-indigo-600 animate-pulse" />
                    Live Clinical Preview
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-2xs">
                    <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                      {getGeneralPreview()}
                    </p>
                    <div className="flex items-center justify-between border-t border-slate-50 mt-2.5 pt-2 text-[9px] font-mono text-slate-400 font-bold">
                      <span>Total characters: {getGeneralPreview().length} chars</span>
                      <span className="text-indigo-600">Standard single SMS template</span>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          ) : activeTab === 'whatsapp' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Clinic Signature Card */}
              <div className="bg-white rounded-3xl border border-slate-200/85 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <SettingsIcon size={16} />
                    </div>
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Dynamic Clinic Signature</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Appended Automatically</span>
                </div>
                
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Modify the global clinic signature which is automatically included at the bottom of all automated WhatsApp/SMS notifications where the <code className="font-mono text-emerald-600 font-bold">{'{Signature}'}</code> variable key is placed.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Signature Text</label>
                    <textarea
                      value={clinicSignature}
                      onChange={(e) => setClinicSignature(e.target.value)}
                      rows={8}
                      className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-none leading-relaxed text-slate-750"
                    />
                  </div>
                  
                  {/* Signature Preview */}
                  <div className="bg-slate-50 border border-slate-200/65 rounded-2xl p-4.5 flex flex-col justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Live Signature Preview</div>
                      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-2xs text-[11px] text-slate-850 font-sans font-medium whitespace-pre-line leading-relaxed border-l-4 border-indigo-500">
                        {clinicSignature}
                      </div>
                    </div>
                    <div className="text-[9px] font-mono text-slate-450 font-bold pt-2 border-t border-slate-200/50 mt-4 flex justify-between">
                      <span>Length: {clinicSignature.length} characters</span>
                      <span className="text-emerald-600">Dynamic Variable Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Templates Card */}
              <div className="bg-white rounded-3xl border border-slate-200/85 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <MessageSquare size={16} />
                    </div>
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Dynamic Outgoing Notification Templates</span>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">12 Active Templates</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Sidebar: Select Template */}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 border-r border-[#ece5dd]/50">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Select Message Template</span>
                    {Object.entries(WA_TEMPLATE_LABELS).map(([key, item]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedWATemplate(key as keyof WhatsAppTemplates)}
                        className={`w-full text-left p-2.5 rounded-xl transition text-[11px] font-bold flex flex-col gap-1 cursor-pointer border ${
                          selectedWATemplate === key
                            ? 'bg-indigo-50 border-indigo-250 border-l-4 border-l-indigo-600 text-indigo-900 shadow-2xs'
                            : 'bg-white border-transparent hover:bg-slate-50 text-slate-600 border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 w-full">
                          <span className="truncate pr-1">{item.title}</span>
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full font-extrabold uppercase shrink-0">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium line-clamp-1">
                          {item.description}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Right Area: Template Editor */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 font-sans uppercase tracking-wider">
                          {WA_TEMPLATE_LABELS[selectedWATemplate].title} (Editor)
                        </h4>
                        <span className="text-[10px] text-slate-400 font-semibold font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                          {selectedWATemplate}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {WA_TEMPLATE_LABELS[selectedWATemplate].description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">Template Body</label>
                      <textarea
                        value={whatsappTemplates[selectedWATemplate]}
                        onChange={(e) => setWhatsappTemplates({ ...whatsappTemplates, [selectedWATemplate]: e.target.value })}
                        rows={7}
                        className="w-full p-3.5 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-none leading-relaxed text-slate-755"
                        placeholder="Enter template text..."
                      />
                      
                      <div className="flex flex-wrap items-center gap-1.5 py-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Insert Placeholder:</span>
                        {WA_TEMPLATE_LABELS[selectedWATemplate].placeholders.map(placeholder => (
                          <button
                            key={placeholder}
                            type="button"
                            onClick={() => insertWAPlaceholder(selectedWATemplate, placeholder)}
                            className="text-[10px] font-mono bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 hover:border-slate-350 px-2 py-0.5 rounded-md transition cursor-pointer"
                          >
                            {`{${placeholder}}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic WhatsApp Preview Block */}
                    <div className="bg-indigo-950/5 border border-indigo-100 rounded-2xl p-4.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-700 [letter-spacing:1.2px]">
                        <Sparkles size={11} className="text-indigo-600 animate-pulse" />
                        Live WhatsApp Preview
                      </div>
                      <div className="bg-[#e5ddd5] border border-slate-250 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col items-start min-h-[120px] justify-center" style={{ backgroundImage: 'radial-gradient(#dfdcd6 12%, transparent 0)', backgroundSize: '12px 12px' }}>
                        {/* Whatsapp chat speech-bubble styled card */}
                        <div className="bg-white text-slate-800 text-[11px] leading-relaxed font-semibold rounded-2xl p-3.5 shadow-sm max-w-[90%] border-t border-slate-50 ml-1.5 relative">
                          {/* Chat bubble tail */}
                          <div className="absolute top-0 -left-1 w-3 h-3 bg-white transform rotate-45 rounded-xs" />
                          <p className="whitespace-pre-wrap text-[11px] relative z-10 text-slate-800 leading-relaxed font-sans">
                            {getWhatsAppPreview(selectedWATemplate)}
                          </p>
                          <div className="flex items-center justify-end mt-1 text-[9px] text-slate-400 font-bold select-none h-3">
                            <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                            <span className="text-[#34b7f1] ml-1 text-xs">✓✓</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'clinical' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200/85 p-6 shadow-xs space-y-6"
            >
              <div className="space-y-2 text-center py-8 text-slate-500">
                <Info size={35} className="text-indigo-500 mx-auto animate-bounce-slow" />
                <h4 className="font-bold text-slate-700 text-sm mt-3">Clinical Rules Threshold</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Advanced validation metrics for diagnosing high risk clinical procedures or patient waiting queues are locked under Sri Chaitanya practice standards.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
              id="google-drive-backup-panel"
            >
              <div className="bg-white rounded-3xl border border-slate-200/85 p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2 justify-between flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <Database size={18} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Google Drive Backup Engine</h4>
                      <p className="text-[10px] text-slate-400 font-semibold">SECURE CLOUD-HOSTED ARCHIVAL SYSTEM</p>
                    </div>
                  </div>
                  {driveToken ? (
                    <span className="text-[10px] bg-emerald-50 border border-emerald-150 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Google Drive Sandbox Mounted
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-bold">
                      Connection Closed
                    </span>
                  )}
                </div>

                <div className="border-t border-slate-100 my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Explanatory notes */}
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      Establish an interactive sync with your medical database directory. Clicking the launcher trigger compiles complete clinic structures (active patients lists, scheduled appointments, custom treatments profiles) into a single secured JSON snapshot, then pushes it directly to your target Google Drive account.
                    </p>
                    
                    <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-4 space-y-3">
                      <div className="flex items-center gap-1.5 font-bold text-[10.5px] text-blue-900 uppercase tracking-widest">
                        <Lock size={12} className="text-blue-600" />
                        Disaster Recovery & Protection
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                        Backups are written using sandbox scopes restrictively, meaning this CRM can never read or modify other files on your Google Drive. Each backup is saved with a detailed, human-inspectable database schema.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {driveToken ? (
                        <>
                          <button
                            onClick={runBackupToGoogleDrive}
                            disabled={isBackingUp}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md select-none border-0"
                          >
                            {isBackingUp ? (
                              <>
                                <RefreshCw size={13} className="animate-spin" />
                                <span>Exporting clinical ledger...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud size={13} />
                                <span>Compile & Back Up Now</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={disconnectGoogleDrive}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs px-4 py-3 rounded-2xl transition duration-150 cursor-pointer select-none border border-slate-200"
                          >
                            Change Account
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={openGoogleOAuthPopup}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md select-none border-0"
                        >
                          <Globe size={13} />
                          <span>Link with Google Workspace</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Backup Health Stats */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200/65 p-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <span className="block text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Storage Health Indicators</span>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-3xs">
                          <span className="block text-[8px] text-slate-400 uppercase font-black">Authorized State</span>
                          <span className={`text-[11px] font-extrabold flex items-center gap-1.5 mt-0.5 ${driveToken ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {driveToken ? 'Authorized' : 'Disconnected'}
                          </span>
                        </div>
                        <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-3xs">
                          <span className="block text-[8px] text-slate-400 uppercase font-black">Clinical Collections</span>
                          <span className="text-[11px] font-extrabold text-slate-800 mt-0.5">3 Tables Verified</span>
                        </div>
                        <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-2xs">
                          <span className="block text-[8px] text-slate-400 uppercase font-black text-rose-500">Backups Executed</span>
                          <span className="text-[11px] font-extrabold text-slate-800 font-mono mt-0.5">{backupFilesCount} completed</span>
                        </div>
                        <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-2xs">
                          <span className="block text-[8px] text-slate-400 uppercase font-black">Transmission Path</span>
                          <span className="text-[11px] font-extrabold text-slate-800 font-mono mt-0.5">Google REST v3</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="block text-[8px] text-slate-400 uppercase font-black">Last successful sync-point:</span>
                        <p className="text-[11px] font-extrabold text-slate-700 mt-0.5 flex items-center gap-1">
                          {lastBackupTime ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-500" />
                              {lastBackupTime}
                            </>
                          ) : (
                            'No backups executed in current browser environment profile.'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-[9px] font-mono text-slate-400 font-semibold pt-4 border-t border-slate-200/50 mt-4 flex items-center gap-1.5 leading-relaxed">
                      <FileJson size={11} className="text-slate-400 shrink-0" />
                      <span>Saved File Format: Sri_Chaitanya_Dental_Care_Backup_[DATE].json</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

      </div>

    </div>
  );
}
