import { useState, useRef } from 'react';
import { FileText, Award, Calendar, Printer, Download, MapPin, Sparkles, Building, User, Signpost, Send, Copy } from 'lucide-react';
import { clinicConfig } from '../../config/clinicConfig';

interface LetterTemplate {
  type: 'Referral' | 'Medical Certificate' | 'Fitness Certificate';
  title: string;
  patientName: string;
  ageGender: string;
  referredToDr?: string;
  referredToClinic?: string;
  startDate?: string;
  endDate?: string;
  diagnosis: string;
  content: string;
  doctorName: string;
  doctorCredentials: string;
  date: string;
}

const INITIAL_LETTER: LetterTemplate = {
  type: 'Medical Certificate',
  title: 'MEDICAL LEAVE CERTIFICATE',
  patientName: 'Devender Rawat',
  ageGender: '29 Yrs / Male',
  startDate: '2026-06-15',
  endDate: '2026-06-18',
  diagnosis: 'Acute Periapical Abscess with severe facial swelling',
  content: 'This is to certify that Mr. Devender Rawat is suffering from Acute Mandibular Abscess and has undergone emergency root canal drainage. He is advised absolute bed rest and dental rehabilitation. He is declared clinically unfit to attend duties during this therapeutic block.',
  doctorName: 'Dr. Jupalli Durga Bhavani',
  doctorCredentials: 'BDS, MDS · Chief Cosmetic Dental Surgeon & Implantologist (Regd: APDC-8092)',
  date: '2026-06-16'
};

export default function Letters() {
  const [template, setTemplate] = useState<LetterTemplate>(INITIAL_LETTER);
  const [signatureText, setSignatureText] = useState('Dr_Jupalli_Durga_Bhavani_Secured_Sign');
  const printRef = useRef<HTMLDivElement>(null);
  
  // Custom templates list
  const loadPreset = (type: 'Referral' | 'Medical Certificate' | 'Fitness Certificate') => {
    if (type === 'Referral') {
      setTemplate({
        type: 'Referral',
        title: 'CLINICAL REFERRAL LETTER',
        patientName: 'Shalini Murthy',
        ageGender: '42 Yrs / Female',
        referredToDr: 'Dr. V. K. Deshmukh MDS (Orthodontics)',
        referredToClinic: 'Saraswati Orthodontic Care & Dentofacial Centre',
        diagnosis: 'Class II Division 2 Malocclusion with severe deep bite',
        content: 'Dear Dr. Deshmukh,\n\nI am referring Mrs. Shalini Murthy to your premium orthodontic specialty practice for comprehensive specialist evaluation. She presents with Class II skeletal relationship, severe anterior deep bite of 6.2mm, and mandibular crowding. I have completed dental oral prophylaxis and primary amalgam restorations here. Kindly proceed with corrective aligner/brackets rehabilitation.',
        doctorName: 'Dr. Jupalli Durga Bhavani',
        doctorCredentials: 'BDS, MDS · Chief Cosmetic Dental Surgeon & Implantologist (Regd: APDC-8092)',
        date: '2026-06-16'
      });
    } else if (type === 'Medical Certificate') {
      setTemplate({
        type: 'Medical Certificate',
        title: 'MEDICAL LEAVE CERTIFICATE',
        patientName: 'Devender Rawat',
        ageGender: '29 Yrs / Male',
        startDate: '2026-06-15',
        endDate: '2026-06-18',
        diagnosis: 'Acute Periapical Abscess with severe facial swelling',
        content: 'This is to certify that Mr. Devender Rawat is suffering from Acute Mandibular Abscess and has undergone emergency root canal drainage. He is advised absolute bed rest and dental rehabilitation. He is declared clinically unfit to attend duties during this therapeutic block.',
        doctorName: 'Dr. Jupalli Durga Bhavani',
        doctorCredentials: 'BDS, MDS · Chief Cosmetic Dental Surgeon & Implantologist (Regd: APDC-8092)',
        date: '2026-06-16'
      });
    } else {
      setTemplate({
        type: 'Fitness Certificate',
        title: 'CLINICAL FITNESS CERTIFICATE',
        patientName: 'Amanpreet Singh',
        ageGender: '35 Yrs / Male',
        diagnosis: 'Post-operative Healing of Fractured Maxillary Alveolus',
        content: 'This is to certify that I have conducted a detailed intra-oral examination of Mr. Amanpreet Singh following a 4-week healing block of conservative management. The surgical bony architecture shows excellent integration, healthy periodontal cuff, and free of purulent signs. He is declared clinically FIT to resume normal physical activities and regular heavy lifting work.',
        doctorName: 'Dr. Jupalli Durga Bhavani',
        doctorCredentials: 'BDS, MDS · Chief Cosmetic Dental Surgeon & Implantologist (Regd: APDC-8092)',
        date: '2026-06-16'
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-cyan-650 to-blue-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <FileText size={160} />
        </div>
        <div className="relative z-10">
          <span className="bg-white/20 text-white font-mono font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
            Clinical Documentation Suite
          </span>
          <h1 className="text-2xl font-black tracking-tight mt-2">Certificates & Referral Letters</h1>
          <p className="text-xs text-white/80 max-w-xl font-medium mt-1">
            Instantly format authorized dental medical leave clearances, referral handoffs, or clinical tooth soundness certificates complying with state healthcare guidelines.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Certificate Designer Control Panel (Col Span 5) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4 font-sans text-xs">
          <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Letter Template Settings
          </h2>

          <div className="grid grid-cols-3 gap-1.5">
            {(['Medical Certificate', 'Referral', 'Fitness Certificate'] as const).map((t) => (
              <button
                key={t}
                onClick={() => loadPreset(t)}
                className={`py-2 rounded-lg font-bold text-[10px] uppercase border text-center transition cursor-pointer ${
                  template.type === t 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {t.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Document Header Title</label>
              <input
                type="text"
                value={template.title}
                onChange={(e) => setTemplate({ ...template, title: e.target.value.toUpperCase() })}
                className="w-full h-9 border border-gray-200 px-3 rounded-lg font-extrabold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Patient Name</label>
                <input
                  type="text"
                  value={template.patientName}
                  onChange={(e) => setTemplate({ ...template, patientName: e.target.value })}
                  className="w-full h-9 border border-gray-200 px-3 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Age & Gender</label>
                <input
                  type="text"
                  value={template.ageGender || ''}
                  onChange={(e) => setTemplate({ ...template, ageGender: e.target.value })}
                  className="w-full h-9 border border-gray-200 px-3 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            {template.type === 'Referral' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Referred Doctor</label>
                  <input
                    type="text"
                    value={template.referredToDr || ''}
                    onChange={(e) => setTemplate({ ...template, referredToDr: e.target.value })}
                    className="w-full h-9 border border-gray-150 px-3 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Referred Practice</label>
                  <input
                    type="text"
                    value={template.referredToClinic || ''}
                    onChange={(e) => setTemplate({ ...template, referredToClinic: e.target.value })}
                    className="w-full h-9 border border-gray-150 px-3 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {template.type === 'Medical Certificate' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Leave Start Date</label>
                  <input
                    type="date"
                    value={template.startDate || ''}
                    onChange={(e) => setTemplate({ ...template, startDate: e.target.value })}
                    className="w-full h-9 border border-gray-150 px-3 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Leave Rest Till</label>
                  <input
                    type="date"
                    value={template.endDate || ''}
                    onChange={(e) => setTemplate({ ...template, endDate: e.target.value })}
                    className="w-full h-9 border border-gray-150 px-3 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Diagnosis / Clinical Finding</label>
              <input
                type="text"
                value={template.diagnosis}
                onChange={(e) => setTemplate({ ...template, diagnosis: e.target.value })}
                className="w-full h-9 border border-gray-200 px-3 rounded-lg font-semibold focus:ring-1 focus:ring-indigo-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Statement Content Body</label>
              <textarea
                rows={5}
                value={template.content}
                onChange={(e) => setTemplate({ ...template, content: e.target.value })}
                className="w-full border border-gray-200 p-3 rounded-lg font-medium leading-relaxed focus:ring-1 focus:ring-indigo-400 focus:outline-none"
              />
            </div>

            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Signatory Doctor</label>
                <input
                  type="text"
                  value={template.doctorName}
                  onChange={(e) => setTemplate({ ...template, doctorName: e.target.value })}
                  className="w-full h-9 border border-gray-200 px-3 rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Doc Credentials</label>
                <input
                  type="text"
                  value={template.doctorCredentials}
                  className="w-full h-9 border border-gray-200 px-3 rounded-lg font-semibold"
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Digital Stamp Signature Pin</label>
              <input
                type="text"
                placeholder="Secure validation hash..."
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                className="w-full h-9 border border-gray-150 px-3 rounded-lg font-mono text-[11px] font-bold text-gray-700 bg-slate-50"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handlePrint}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Print Document
              </button>
            </div>
          </div>
        </div>

        {/* Professional Letterhead Preview Canvas (Col Span 7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-xs font-black text-gray-600 uppercase tracking-widest flex items-center gap-1.5 font-sans">
              <Sparkles size={14} className="text-amber-500 animate-spin" /> Interactive Letterhead Canvas
            </span>
            <span className="text-[10px] text-gray-400 font-mono font-bold">Standard A4 Portrait Form-Factor</span>
          </div>

          {/* Letter container */}
          <div 
            ref={printRef}
            id="letter_preview_print" 
            className="bg-white p-10 rounded-2xl border border-gray-200 shadow-lg relative min-h-[640px] flex flex-col justify-between font-sans text-xs text-gray-800"
          >
            {/* Stamp Logo & Top clinic information */}
            <div>
              <div className="flex justify-between items-start border-b-2 border-blue-600 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-650 flex items-center justify-center text-white font-black text-base">
                      C
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-[#111827] tracking-tight uppercase">{clinicConfig.clinicName}</h2>
                      <p className="text-[10px] text-[#2F63E0] font-black uppercase tracking-wider">{clinicConfig.tagline}</p>
                    </div>
                  </div>
                  <p className="text-[9.5px] text-gray-500 leading-relaxed font-semibold">
                    {clinicConfig.address}<br/>
                    Contact: {clinicConfig.phone} | Email: {clinicConfig.email}
                  </p>
                </div>
                
                <div className="text-right">
                  <span className="inline-block bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase border border-blue-200">
                    Govt Regd Clinic
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">Reg No: APDC-8092</p>
                </div>
              </div>

              {/* Doc Body */}
              <div className="mt-8 space-y-6">
                {/* Title */}
                <div className="text-center">
                  <h3 className="text-base font-extrabold text-blue-700 tracking-wider underline decoration-2 decoration-blue-200">
                    {template.title}
                  </h3>
                </div>

                <div className="flex justify-between border-y border-dashed border-gray-200 py-3 text-[11px] font-sans">
                  <div className="space-y-1">
                    <p>Patient Name: <strong>{template.patientName}</strong></p>
                    <p>Age & Gender: <span className="font-semibold text-gray-700">{template.ageGender}</span></p>
                    <p>Diagnosis: <span className="text-rose-600 font-bold">{template.diagnosis}</span></p>
                  </div>
                  <div className="text-right space-y-1">
                    <p>Document Date: <strong className="font-mono">{template.date}</strong></p>
                    {template.type === 'Referral' && (
                      <>
                        <p>Referring To: <strong>{template.referredToDr}</strong></p>
                        <p>Facility: <strong>{template.referredToClinic}</strong></p>
                      </>
                    )}
                    {template.type === 'Medical Certificate' && (
                      <p>Clinical Leave Block: <strong className="text-blue-650">{template.startDate}</strong> to <strong className="text-blue-650">{template.endDate}</strong></p>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-xs leading-relaxed font-normal whitespace-pre-wrap text-gray-700">
                  {template.content}
                </div>
              </div>
            </div>

            {/* Signature Area (Doctor signature, verification stamp) */}
            <div className="flex justify-between items-end border-t border-gray-150 pt-5">
              <div className="text-[9.5px] text-gray-400 font-mono space-y-0.5">
                <p>Verify Document Hash:</p>
                <p className="font-bold uppercase tracking-wider text-slate-500">{signatureText || 'SDC-9023-F9'}</p>
                <p>© Sri Chaitanya EMR Documentation</p>
              </div>

              <div className="text-right space-y-1.5 font-sans flex flex-col items-end">
                {localStorage.getItem('doctor_signature_image') ? (
                  <img 
                    src={localStorage.getItem('doctor_signature_image') || ''} 
                    alt="Signature" 
                    className="max-h-12 max-w-[150px] object-contain mix-blend-multiply -mb-2"
                  />
                ) : (
                  signatureText && (
                    <div className="italic font-serif text-blue-600 text-sm font-bold border-b border-gray-100 pr-2">
                      {template.doctorName?.replace('Dr. ', '') || 'Durga Bhavani'} 
                    </div>
                  )
                )}
                <div className="text-right">
                  <h5 className="font-extrabold text-gray-900">{template.doctorName}</h5>
                  <p className="text-[9.5px] text-gray-500 font-bold">{template.doctorCredentials}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
