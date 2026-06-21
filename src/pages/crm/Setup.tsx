import { useState } from 'react';
import { Settings, Percent, MessageSquare, Clock, ShieldAlert, Save, Building, BellRing, Smartphone, Check } from 'lucide-react';

export default function Setup() {
  const [clinicName, setClinicName] = useState('Smile Dental Clinic & Maxillofacial Centre');
  const [cgst, setCgst] = useState('9');
  const [sgst, setSgst] = useState('9');
  const [slotSize, setSlotSize] = useState('15');
  const [enableWhatsapp, setEnableWhatsapp] = useState(true);
  const [enableSms, setEnableSms] = useState(true);
  const [enableEmail, setEnableEmail] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
    alert('Global Clinic Settings saved & updated across the SaaS environment.');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#2F63E0] to-[#1FA0DD] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <Settings size={160} />
        </div>
        <div className="relative z-10">
          <span className="bg-white/20 text-white font-mono font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
            Clinic global setup options
          </span>
          <h1 className="text-2xl font-black tracking-tight mt-2">Clinic configuration & custom taxes</h1>
          <p className="text-xs text-white/80 max-w-xl font-medium mt-1">
            Re-adjust your medical tax codes (GST/CGST), operating scheduling intervals, WhatsApp webhook alerts, and booking reminders.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Help box (Col Span 4) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4 font-sans text-xs text-gray-700 leading-relaxed">
          <h3 className="font-extrabold text-[#111827] uppercase tracking-tight flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <ShieldAlert size={14} className="text-amber-500" /> SaaS Configurations Guides
          </h3>
          <p>
            Configure tax multipliers to safely compute consultation or dental implantation receipts matching statutory mandates.
          </p>
          <div className="border-l-2 border-indigo-400 pl-3 py-1 bg-slate-50 text-[11px] italic font-medium">
            "We default to standard 9% CGST + 9% SGST representing standard clinical healthcare tax structure."
          </div>
          <p>
            Calendar slot size controls the timing intervals on the appointments booking calendar dashboard (Defaults to 15-minute consultations).
          </p>
        </div>

        {/* Configuration forms (Col Span 8) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2.5 mb-4">
            Clinic parameters & GST setting
          </h2>

          <form onSubmit={handleSave} className="space-y-5 font-sans text-xs">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5 font-sans">Corporate Clinic Name (Letterhead Header)</label>
              <div className="relative">
                <Building size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full h-10 border border-gray-200 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 font-extrabold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">CGST Multiplier Percentage (%)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                  <input
                    type="number"
                    value={cgst}
                    onChange={(e) => setCgst(e.target.value)}
                    className="w-full h-10 border border-gray-200 pl-8 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 font-black"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">SGST Multiplier Percentage (%)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                  <input
                    type="number"
                    value={sgst}
                    onChange={(e) => setSgst(e.target.value)}
                    className="w-full h-10 border border-gray-200 pl-8 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 font-black"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Calendar Booking Slot Size</label>
                <select
                  value={slotSize}
                  onChange={(e) => setSlotSize(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:ring-1 focus:ring-indigo-400 bg-white font-extrabold text-xs"
                >
                  <option value="15">15 Minutes (Express Slot)</option>
                  <option value="30">30 Minutes (Standard Checkup)</option>
                  <option value="45">45 Minutes (Surgical Extraction)</option>
                  <option value="60">60 Minutes (Premium Ortho Implant)</option>
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2.5">
                <Clock size={16} className="text-[#2F63E0] shrink-0" />
                <p className="text-[10.5px] text-gray-500 leading-normal font-sans">
                  Controls the schedule granularity on your appointments booking calendar slots.
                </p>
              </div>
            </div>

            {/* Notification triggers */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-[10.5px] font-black uppercase text-slate-800 flex items-center gap-1.5 border-b border-gray-50 pb-2">
                <BellRing size={13} className="text-[#8757EA]" /> Automated Reminders & Alerts Triggers
              </h3>

              <div className="space-y-2.5 font-sans">
                <label className="flex items-center gap-3 font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableWhatsapp}
                    onChange={(e) => setEnableWhatsapp(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Dispatch WhatsApp Notifications (Auto-confirmed Bookings, PDFs)</span>
                </label>

                <label className="flex items-center gap-3 font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSms}
                    onChange={(e) => setEnableSms(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Dispatch Telecommunication SMS Alerts (Dues & OTP login parameters)</span>
                </label>

                <label className="flex items-center gap-3 font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableEmail}
                    onChange={(e) => setEnableEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Dispatch E-Mail Clinical Summary (Consultancy notes, test bookings)</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                className="bg-blue-650 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider h-11 px-6 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer animate-fade-in"
              >
                {isSaved ? (
                  <>
                    <Check size={14} /> Settings Saved!
                  </>
                ) : (
                  <>
                    <Save size={14} /> Commit Clinic Setup
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
