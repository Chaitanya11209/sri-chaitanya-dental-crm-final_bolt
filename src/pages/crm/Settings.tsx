import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, MessageSquare, Save, RefreshCw, HelpCircle, 
  CheckCircle2, Info, UserCheck, CalendarDays, FileSpreadsheet, Sparkles,
  Send, Smartphone
} from 'lucide-react';
import { useNotification } from '../../components/NotificationProvider';
import { 
  getSMSTemplates, saveSMSTemplates, DEFAULT_SMS_TEMPLATES, SMSTemplates,
  getSMSChannel, saveSMSChannel, SMSChannel 
} from '../../lib/sms';

export default function Settings() {
  const { notify } = useNotification();
  const [templates, setTemplates] = useState<SMSTemplates>(getSMSTemplates());
  const [smsChannel, setSmsChannel] = useState<SMSChannel>(getSMSChannel());
  const [isSaving, setIsSaving] = useState(false);

  // Active sub-tab for setting types
  const [activeTab, setActiveTab] = useState<'sms' | 'clinical'>('sms');

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

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      saveSMSTemplates(templates);
      saveSMSChannel(smsChannel);
      setIsSaving(false);
      notify('success', 'CRM Settings Updated', 'All customized communication templates & dispatch configurations updated successfully!');
    }, 800);
  };

  const handleReset = () => {
    const confirm = window.confirm('Are you sure you want to reset all SMS templates to their clinic default values?');
    if (confirm) {
      setTemplates(DEFAULT_SMS_TEMPLATES);
      saveSMSTemplates(DEFAULT_SMS_TEMPLATES);
      notify('info', 'Defaults Restored', 'SMS templates have been revert to internal clinic default formats.');
    }
  };

  const insertPlaceholder = (fieldName: keyof SMSTemplates, placeholder: string) => {
    setTemplates({
      ...templates,
      [fieldName]: templates[fieldName] + placeholder
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
          ) : (
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
          )}
        </div>

      </div>

    </div>
  );
}
