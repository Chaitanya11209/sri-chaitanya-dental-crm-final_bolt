import { useState, useRef } from 'react';
import { User, Award, MapPin, Phone, Mail, Signature, FileKey, ShieldCheck, Save, Clock, Check, X, ShieldAlert, FolderOpen, Trash2 } from 'lucide-react';
import { getRole } from '../../lib/auth';
import { useNotification } from '../../components/NotificationProvider';

export default function Profile() {
  const [name, setName] = useState('Dr. Jupalli Durga Bhavani');
  const [credentials, setCredentials] = useState('BDS, MDS · Chief Cosmetic Dental Surgeon');
  const [regNo, setRegNo] = useState('APDC-8092');
  const [phone, setPhone] = useState('+91 83175 75165');
  const [email, setEmail] = useState('contact@srichaitanyadental.com');
  const [fees, setFees] = useState('250');
  const [signLabel, setSignLabel] = useState('Dr_Durga_Bhavani_Secured_Sign');
  const [isSaved, setIsSaved] = useState(false);

  const { notify } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRole = getRole();
  const isAuthorized = activeRole === 'admin' || activeRole === 'doctor';

  const [signatureImage, setSignatureImage] = useState<string | null>(() => {
    return localStorage.getItem('doctor_signature_image');
  });
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        notify('error', 'Invalid File Type', 'Please upload a valid image file (PNG or JPG).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSignatureImage(base64String);
        localStorage.setItem('doctor_signature_image', base64String);
        notify('success', 'Signature Uploaded', 'Doctor signature image uploaded successfully and will reflect on custom printed documents!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSignature = () => {
    setSignatureImage(null);
    localStorage.removeItem('doctor_signature_image');
    notify('info', 'Signature Removed', 'Doctor signature image removed from internal cache.');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
    alert('Pracitioner professional profile successfully updated.');
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <User size={160} />
        </div>
        <div className="relative z-10">
          <span className="bg-white/20 text-white font-mono font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
            Professional Account Management
          </span>
          <h1 className="text-2xl font-black tracking-tight mt-2">Clinic practitioner profile info</h1>
          <p className="text-xs text-white/80 max-w-xl font-medium mt-1">
            Update MDS certifications, state registration numbers, consultancy charging slabs, and digital sign-stamps linked to automated prescriptions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Card: Account Card (Col Span 4) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-5 text-center font-sans text-xs">
          <div className="flex flex-col items-center">
            {/* Round Avatar initials */}
            <div className="w-20 h-20 rounded-full bg-blue-100 border-4 border-blue-50 text-blue-630 flex items-center justify-center font-black text-2xl">
              JB
            </div>
            <h3 className="font-extrabold text-sm mt-3 text-slate-900">{name}</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">{credentials}</p>
            <span className="mt-2 inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border border-green-200">
              <ShieldCheck size={11} /> Verified Practitioner
            </span>
          </div>

          <div className="border-t border-gray-100 pt-4 text-left space-y-2.5 font-sans">
            <div className="flex items-center gap-2.5 text-gray-700">
              <Phone size={13} className="text-gray-400 shrink-0" />
              <span className="font-semibold">{phone}</span>
            </div>
            <div className="flex items-center gap-2.5 text-gray-700">
              <Mail size={13} className="text-gray-400 shrink-0" />
              <span className="font-semibold truncate">{email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-gray-700">
              <MapPin size={13} className="text-gray-400 shrink-0" />
              <span className="font-semibold">Beeramguda, Patancheru</span>
            </div>
          </div>

          {/* Consultation details */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-left space-y-1.5 font-sans">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Consultation settings</span>
            <p className="text-xs text-slate-900 font-black">₹{fees} consultation fee</p>
            <p className="text-[10px] text-zinc-500">Linked directly onto Billing invoices and Patient portals.</p>
          </div>
        </div>

        {/* Right Card: Professional Details Form (Col Span 8) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-gray-100 pb-2.5 mb-4">
            Specialist profile details
          </h2>

          <form onSubmit={handleSave} className="space-y-4 font-sans text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Practitioner Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 border border-gray-200 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Specialization & Credentials</label>
                <div className="relative">
                  <Award size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={credentials}
                    onChange={(e) => setCredentials(e.target.value)}
                    className="w-full h-10 border border-gray-200 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">State Dental Counsel Reg No.</label>
                <div className="relative">
                  <FileKey size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    className="w-full h-10 border border-gray-200 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Consultation Fee slab (INR)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
                  <input
                    type="number"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    className="w-full h-10 border border-gray-200 pl-9 pr-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-black"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Contact Contact No</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Clinical Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-[10.5px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                <Signature size={13} className="text-[#8757EA]" /> Digital Prescription Autograph Code
              </h3>
              
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">E-Signature Label</label>
                <input
                  type="text"
                  value={signLabel}
                  onChange={(e) => setSignLabel(e.target.value)}
                  className="w-full h-9 border border-gray-150 px-3 rounded-lg font-mono text-[11px] font-bold text-gray-650 bg-slate-50"
                  placeholder="Hash tag for cryptographic signature check..."
                />
                <p className="text-[9.5px] text-gray-400 mt-1 font-sans italic">
                  This secure label is embedded automatically inside printable medical certificates & referral letters generated from the system.
                </p>
              </div>
            </div>

            {/* Signature Upload segment */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-[10.5px] font-black uppercase text-slate-800 flex items-center gap-1.5">
                <Signature size={13} className="text-blue-600" /> Authorized Clinical signature stamp
              </h3>
              
              {isAuthorized ? (
                <div id="sig-upload-active" className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-2xl gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Dynamic Signature Upload</h4>
                    <p className="text-[10px] text-slate-505 mt-0.5 font-sans leading-relaxed">Embeds your real hand-drawn signature directly onto printable clinical certificates, letterheads, and R<sub>x</sub> sheets.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSignatureModal(true)}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    ✍️ Manage Signature
                  </button>
                </div>
              ) : (
                <div id="sig-upload-locked" className="flex items-start gap-2.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <ShieldAlert size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Signature Management Blocked</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed font-sans">Your current staff role profile is <strong className="uppercase">{activeRole || 'unspecified'}</strong>. Authentic signature uploading, prescription sign-stamps, and print authorizations are restricted strictly to <strong>Doctors</strong> and <strong>Administrators</strong>.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider h-11 px-6 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSaved ? (
                  <>
                    <Check size={14} /> Profile Saved!
                  </>
                ) : (
                  <>
                    <Save size={14} /> Commit Profile Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ✍️ DOCTOR SIGNATURE POPUP MODAL */}
      {showSignatureModal && isAuthorized && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-slate-200 shadow-2xl relative animate-in zoom-in-95 duration-200 p-6 space-y-5 text-slate-800">
            {/* Hidden native input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-105 pb-3">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                ✍️ Doctor Signature
              </h2>
              <button 
                type="button"
                onClick={() => setShowSignatureModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Description */}
            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
              Upload a clear signature image for <strong className="text-slate-800">{name}</strong>. This will appear on printed letters and prescriptions.
            </p>

            {/* Image Preview Box */}
            <div className="border border-slate-200 bg-[#F8FAFC] rounded-2xl p-5 flex flex-col items-center justify-center min-h-[140px] text-center relative group">
              {signatureImage ? (
                <div className="relative w-full flex flex-col items-center">
                  <img 
                    src={signatureImage} 
                    alt="Doctor Signature Preview" 
                    className="max-h-24 max-w-full object-contain mix-blend-multiply transition duration-150"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="absolute -top-3 -right-3 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full border border-rose-100 shadow-xs opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Remove signature"
                  >
                    <Trash2 size={13} />
                  </button>
                  <span className="text-[9px] font-bold text-emerald-600 mt-2 block font-mono">✓ Active Prescription Autograph</span>
                </div>
              ) : (
                <div className="text-slate-400 text-xs font-bold font-sans">
                  No signature uploaded yet
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer font-sans"
              >
                <FolderOpen size={14} /> Upload Signature
              </button>
              
              {signatureImage && (
                <button
                  type="button"
                  onClick={handleRemoveSignature}
                  className="w-full h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-bold text-xs uppercase transition border border-slate-200 rounded-xl cursor-pointer font-sans"
                >
                  Clear Signature
                </button>
              )}
            </div>

            {/* Tip block */}
            <p className="text-[10px] text-slate-500 bg-amber-50/50 border border-amber-100/70 rounded-xl p-3 leading-relaxed font-sans flex items-start gap-1.5">
              <span>💡</span>
              <span>
                <strong>Tip:</strong> Use a white-background signature on a plain sheet of paper, photograph it, and upload. PNG or JPG works best.
              </span>
            </p>

          </div>
        </div>
      )}
    </div>
  );
}
