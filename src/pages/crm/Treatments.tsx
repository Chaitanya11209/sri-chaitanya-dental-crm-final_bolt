import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Stethoscope, Search, Plus, X, ClipboardList, CheckCircle2, Clock, FileText, PlusCircle, Trash2, Printer, Share2 } from 'lucide-react';
import DoctorSelect from '../../components/DoctorSelect';
import { openWhatsApp, followupMessage, paymentReminderMessage } from '../../utils/whatsapp';
import { useTreatmentsRealtime, useAppointmentsRealtime } from '../../hooks/useRealtimeHooks';

const TREATMENTS = ['Dental Implants', 'Root Canal', 'Teeth Whitening', 'Braces & Aligners', 'Scaling & Polishing', 'Tooth Extraction', 'Fillings', 'Crowns & Bridges', 'Pediatric Dentistry', 'Emergency Care', 'Consultation', 'Other'];
const STAGES = ['Assessment', 'Treatment Started', 'In Progress', 'Review', 'Completed'];

export default function Treatments() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ patient_name: '', phone: '', treatment_type: '', stage: 'Assessment', start_date: '', expected_end_date: '', total_sessions: '', sessions_done: '', treatment_notes: '', doctor_notes: '' });
  const [selectedDoctorName, setSelectedDoctorName] = useState('Dr. Sri Chaitanya');
  const [saving, setSaving] = useState(false);

  // States & helper procedures for PDF estimator/blueprint generation
  const [showPDFBuilder, setShowPDFBuilder] = useState(false);
  const [pdfPlanForm, setPdfPlanForm] = useState<any>({
    patient_name: '',
    phone: '',
    doctorName: 'Dr. Sri Chaitanya',
    date: new Date().toISOString().split('T')[0],
    notes: 'The proposed treatment scheme outlines clinical interventions aimed at restoring optimal oral health.',
    items: [
      { id: 'item-1', treatment_type: 'Scaling & Polishing', sessions: 1, cost: 1500, notes: 'Routine prophylactic scaling' }
    ]
  });

  const openNewPDFBuilder = () => {
    setPdfPlanForm({
      patient_name: '',
      phone: '',
      doctorName: 'Dr. Sri Chaitanya',
      date: new Date().toISOString().split('T')[0],
      notes: 'The proposed treatment scheme outlines clinical interventions aimed at restoring optimal oral health.',
      items: [
        { id: `item-${Date.now()}`, treatment_type: 'Consultation', sessions: 1, cost: 500, notes: 'Routine proposal consultation' }
      ]
    });
    setShowPDFBuilder(true);
  };

  const addPDFItem = () => {
    setPdfPlanForm((prev: any) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: `item-${Date.now()}`, treatment_type: 'Consultation', sessions: 1, cost: 500, notes: '' }
      ]
    }));
  };

  const removePDFItem = (id: string) => {
    if (pdfPlanForm.items.length <= 1) return;
    setPdfPlanForm((prev: any) => ({
      ...prev,
      items: prev.items.filter((item: any) => item.id !== id)
    }));
  };

  const updatePDFItem = (id: string, field: string, val: any) => {
    setPdfPlanForm((prev: any) => ({
      ...prev,
      items: prev.items.map((item: any) => {
        if (item.id === id) {
          return { ...item, [field]: val };
        }
        return item;
      })
    }));
  };

  const shareWhatsAppPlan = (plan: any) => {
    const totalAmount = plan.items.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0);
    const itemList = plan.items.map((it: any, i: number) => `*${i+1}. ${it.treatment_type}* - Rs. ${Number(it.cost).toLocaleString('en-IN')} (${it.notes || 'Proposed'})`).join('\n');
    const msg = `*SRI CHAITANYA MULTISPECIALITY DENTAL CARE*\n` +
                `*Proposed Dental Estimator & Treatment Plan*\n\n` +
                `*Patient:* ${plan.patient_name || 'Valued Patient'}\n` +
                `*Date:* ${new Date(plan.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n` +
                `*Specialist Dentist:* ${plan.doctorName}\n\n` +
                `*Planned Clinical Procedures:*\n${itemList}\n\n` +
                `*Total Estimate Budget:* Rs. *${totalAmount.toLocaleString('en-IN')}*\n\n` +
                `_Notes: ${plan.notes || 'Estimate valid for 30 consecutive days.'}_`;
    
    // Format cell phone number
    const processedPhone = (plan.phone || '').trim().replace(/[^0-9]/g, '');
    const finalPhone = processedPhone.length === 10 ? '91' + processedPhone : processedPhone;
    const url = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const generatePDFPlan = async (plan: any) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      
      const totalAmount = plan.items.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0);

      // Logo & Header Block matching SCDC clinical branding
      doc.setTextColor(15, 110, 110); // Brand Premium Teal #0F6E6E
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('SRI CHAITANYA MULTISPECIALITY DENTAL CARE', 15, 20);
      
      doc.setTextColor(29, 78, 216); // Brand Secondary Blue #1D4ED8
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Dr. J. Durga Bhavani, Cosmetic Dental Surgeon', 15, 26);
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'italic');
      doc.text('"We Care Your Smile"', 15, 31);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Ameenpur, Hyderabad  |  Ph: +91 8317575165', 15, 37);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTIMATED TREATMENT PLAN', 195, 20, { align: 'right' });

      // Brand Teal Divider line
      doc.setDrawColor(15, 110, 110);
      doc.setLineWidth(0.8);
      doc.line(15, 42, 195, 42);

      // Section 1: Demographics info
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PATIENT & CLINICAL DETAILS', 15, 50);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(15, 52, 195, 52);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text([
        `Patient Name: ${plan.patient_name || 'N/A'}`,
        `Contact No: ${plan.phone || 'N/A'}`,
        `Plan Proposal Date: ${new Date(plan.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      ], 15, 58);

      doc.text([
        `Attending Specialist: ${plan.doctorName || 'Dr. Sri Chaitanya'}`,
        `Clinical Folder ID: SDC-TX-${Math.floor(100000 + Math.random() * 900000)}`,
        `Estimate Validity: 30 consecutive days`
      ], 110, 58);

      // Section 2: Table of Procedures
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('RECOMMENDED PROCEDURES & COST ESTIMATES', 15, 80);
      doc.line(15, 82, 195, 82);

      const tableRows = plan.items.map((item: any, idx: number) => [
        idx + 1,
        item.treatment_type,
        item.sessions || 1,
        item.notes || 'Routine proposed service',
        `Rs. ${Number(item.cost).toLocaleString('en-IN')}`
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['Sl.', 'Proposed Medical Procedure', 'Planned Sessions', 'Tooth / Clinical Remarks', 'Estimate Cost']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 110, 110], fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          4: { fontStyle: 'bold', halign: 'right' },
          0: { cellWidth: 12 },
          2: { cellWidth: 32, halign: 'center' }
        },
        margin: { left: 15, right: 15 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 12;

      // Section 3: Summary Box & Clinical notes
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Clinical Summary & Estimate Terms:', 15, finalY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      
      const briefNotes = plan.notes || 'The proposed treatment scheme outlines clinical interventions aimed at restoring optimal oral health.';
      const notesLines = doc.splitTextToSize(briefNotes, 110);
      doc.text(notesLines, 15, finalY + 5);

      const termsStart = finalY + 5 + (notesLines.length * 4) + 2;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text([
        'Estimate Terms & Conditions:',
        '1. Estimates are valid for 30 days. Costs may be recalculated if treatment starts past this date.',
        '2. Some dental procedures require subsequent stages where actual material costs might deviate.',
        '3. Consult your attending clinical surgeon immediately for any postoperative feedback.'
      ], 15, termsStart);

      // Draw Summary Box on Right
      doc.setDrawColor(15, 110, 110);
      doc.setFillColor(240, 253, 250);
      doc.rect(130, finalY, 65, 30, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 110, 110);
      doc.text('GRAND TOTAL ESTIMATE', 135, finalY + 8);
      
      doc.setFontSize(14);
      doc.text(`Rs. ${totalAmount.toLocaleString('en-IN')}`, 135, finalY + 18);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('(Inclusive of all clinical visits)', 135, finalY + 25);

      // Footer signature lines
      const signatureY = Math.max(termsStart + 22, finalY + 45);
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('Dr. J. Durga Bhavani, Surgeon', 135, signatureY + 8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Authorized Signatory', 135, signatureY + 12);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.line(135, signatureY + 2, 185, signatureY + 2);

      // Save plan PDF file
      doc.save(`Treatment_Plan_${(plan.patient_name || 'Patient').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('[Treatments] Error compiling PDF:', err);
      alert('Could not compile PDF treatment estimate. See browser developer logs.');
    }
  };

  const { treatments: realtimeTreatments, loading: realtimeTreatmentsLoading, refetch: refetchTreatmentsHook } = useTreatmentsRealtime();
  const { appointments: realtimeAppointments, refetch: refetchAppointmentsHook } = useAppointmentsRealtime();

  useEffect(() => {
    fetch(false);
  }, [realtimeTreatments, realtimeAppointments]);

  // Sync treatment notes with local storage
  useEffect(() => {
    const saved = localStorage.getItem('sdc_treatment_notes_new_record_draft');
    if (saved) {
      setForm(prev => ({ ...prev, treatment_notes: saved }));
    }
  }, []);

  useEffect(() => {
    if (form.treatment_notes) {
      localStorage.setItem('sdc_treatment_notes_new_record_draft', form.treatment_notes);
    } else {
      localStorage.removeItem('sdc_treatment_notes_new_record_draft');
    }
  }, [form.treatment_notes]);

  const fetch = async (forceQuery = true) => {
    setLoading(true);
    try {
      if (forceQuery) {
        console.info("[Treatments] Force fetch active. Awaiting hooks update.");
        await Promise.all([
          refetchTreatmentsHook(),
          refetchAppointmentsHook()
        ]);
      }
      const treatmentsData = realtimeTreatments || [];
      const appointmentsData = realtimeAppointments || [];
      
      let finalRecords = [...treatmentsData];
      
      // If there are appointments with treatment that are not in treatmentsData, let's incorporate them
      if (appointmentsData && appointmentsData.length > 0) {
        appointmentsData.forEach(appt => {
          if (appt.treatment) {
            // Check if this treatment already exists under this patient name / phone and type
            const exists = finalRecords.some(r => 
              r.patient_name === appt.name && 
              r.phone === appt.phone && 
              r.treatment_type === appt.treatment
            );
            if (!exists) {
              finalRecords.push({
                id: `fallback-${appt.id}`,
                patient_name: appt.name,
                phone: appt.phone,
                treatment_type: appt.treatment,
                stage: appt.status === 'Completed' ? 'Completed' : (appt.status === 'Confirmed' ? 'In Progress' : 'Assessment'),
                start_date: appt.next_visit || appt.created_at?.split('T')[0] || '',
                total_sessions: 1,
                sessions_done: appt.status === 'Completed' ? 1 : 0,
                treatment_notes: appt.notes || 'Created via appointment booking',
                doctor_notes: appt.payment_notes || '',
                created_at: appt.created_at
              });
            }
          }
        });
      }
      
      setRecords(finalRecords);
    } catch (err) {
      console.error('Error fetching treatments:', err);
      setRecords([]);
    }
    setLoading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        doctor_notes: `Assigned Specialist: ${selectedDoctorName}\n${form.doctor_notes || ''}`.trim()
      };
      await supabase.from('treatments').insert([payload]);
      setShowModal(false);
      setForm({ patient_name: '', phone: '', treatment_type: '', stage: 'Assessment', start_date: '', expected_end_date: '', total_sessions: '', sessions_done: '', treatment_notes: '', doctor_notes: '' });
      localStorage.removeItem('sdc_treatment_notes_new_record_draft');
      fetch();
    } catch {}
    setSaving(false);
  };

  const updateStage = async (id: any, stage: string) => {
    if (typeof id === 'string' && id.startsWith('fallback-')) {
      alert("Note: This fallback record is generated dynamically from appointments data. Create a new formal treatment plan using the '+ Add' button to track custom multiple sessions or stages.");
      return;
    }
    try { await supabase.from('treatments').update({ stage }).eq('id', id); fetch(); } catch {}
  };

  const updateSessions = async (id: any, done: number, total: number) => {
    if (typeof id === 'string' && id.startsWith('fallback-')) {
      alert("Note: This fallback record is generated dynamically from appointments data. Create a new formal treatment plan using the '+ Add' button to track custom multiple sessions or stages.");
      return;
    }
    try {
      await supabase.from('treatments').update({ 
        sessions_done: done, 
        total_sessions: total 
      }).eq('id', id);
      fetch();
    } catch {}
  };

  const filtered = records.filter(r => {
    const s = search.toLowerCase();
    const m = !search || r.patient_name?.toLowerCase().includes(s) || r.phone?.includes(s) || r.treatment_type?.toLowerCase().includes(s);
    const f = filter === 'All' || r.stage === filter;
    return m && f;
  });

  const stageColor: Record<string, string> = {
    'Assessment': 'bg-slate-100 text-slate-600',
    'Treatment Started': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-amber-100 text-amber-700',
    'Review': 'bg-purple-100 text-purple-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
  };

  const stageIcon: Record<string, React.ReactNode> = {
    'Assessment': <ClipboardList size={12} />,
    'Treatment Started': <Clock size={12} />,
    'In Progress': <Clock size={12} />,
    'Review': <Clock size={12} />,
    'Completed': <CheckCircle2 size={12} />,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or treatment…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
          <option value="All">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => openNewPDFBuilder()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap cursor-pointer">
          <FileText size={16} /> Plan Blueprint (PDF)
        </button>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAGES.map(stage => {
          const count = records.filter(r => r.stage === stage).length;
          return (
            <div key={stage} className={`p-3 rounded-xl border text-center cursor-pointer transition ${filter === stage ? 'ring-2 ring-teal-500' : ''} ${stageColor[stage]}`}
              onClick={() => setFilter(filter === stage ? 'All' : stage)}>
              <p className="text-2xl font-black">{count}</p>
              <p className="text-xs font-medium mt-0.5">{stage}</p>
            </div>
          );
        })}
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Stethoscope size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm">No treatment records found</p>
            <p className="text-slate-300 text-xs mt-1">Note: requires a "treatments" table in Supabase</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(r => {
              // Calculate overall staging and session percentage
              const getOverallPercentage = (record: any) => {
                if (record.stage === 'Completed') return 100;
                if (record.total_sessions) {
                  const sessRatio = (Number(record.sessions_done) || 0) / Number(record.total_sessions);
                  return Math.round(sessRatio * 100);
                }
                const weights: Record<string, number> = {
                  'Assessment': 15,
                  'Treatment Started': 35,
                  'In Progress': 60,
                  'Review': 85
                };
                return weights[record.stage] || 10;
              };

              const overallPercent = getOverallPercentage(r);

              return (
                <div key={r.id} className="p-5 hover:bg-slate-50/75 transition cursor-pointer space-y-4" onClick={() => setSelected(r)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold flex-shrink-0">
                        {r.patient_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 text-sm">{r.patient_name}</p>
                          <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1 ${stageColor[r.stage]}`}>
                            {stageIcon[r.stage]}{r.stage}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mt-1">{r.treatment_type}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                          {r.start_date && <span>Started: {r.start_date}</span>}
                          {r.phone && <span>{r.phone}</span>}
                          <span>Total completion: <strong className="text-slate-700 font-extrabold">{overallPercent}%</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Stage Dropdown:</label>
                        <select value={r.stage} onChange={e => updateStage(r.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-lg font-semibold border border-slate-200 cursor-pointer ${stageColor[r.stage]}`}>
                          {STAGES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
                        <button
                          type="button"
                          onClick={() => {
                            const msg = followupMessage({
                              name: r.patient_name,
                              treatment: r.treatment_type,
                              followup_date: r.expected_end_date || r.start_date || new Date().toISOString().split('T')[0]
                            });
                            openWhatsApp(r.phone, msg);
                          }}
                          className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100/80 px-2 py-1 rounded-lg border border-teal-150 transition cursor-pointer"
                          title="Trigger WhatsApp Follow-up"
                        >
                          <svg className="w-3 h-3 fill-current text-teal-600" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.264 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.967C16.528 2.013 14.07 1.012 11.99 1.012c-5.437 0-9.862 4.37-9.866 9.801-.002 1.952.518 3.848 1.503 5.539l-.988 3.606 3.693-.97c1.55.845 3.01 1.258 4.315 1.272z"/></svg>
                          <span>Follow-up</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const parsedBalance = r.balance_amount || (r.id?.includes('fallback-') ? 1500 : 0); // fallback or 0
                            const msg = paymentReminderMessage({
                              name: r.patient_name,
                              treatment: r.treatment_type,
                              balance_amount: parsedBalance
                            });
                            openWhatsApp(r.phone, msg);
                          }}
                          className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100/80 px-2 py-1 rounded-lg border border-amber-150 transition cursor-pointer"
                          title="Trigger WhatsApp Payment Reminder"
                        >
                          <svg className="w-3 h-3 fill-current text-amber-600" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.264 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.967C16.528 2.013 14.07 1.012 11.99 1.012c-5.437 0-9.862 4.37-9.866 9.801-.002 1.952.518 3.848 1.503 5.539l-.988 3.606 3.693-.97c1.55.845 3.01 1.258 4.315 1.272z"/></svg>
                          <span>Remind Pay</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const estCost = r.id?.includes('fallback-') ? 1500 : 3000;
                            setPdfPlanForm({
                              patient_name: r.patient_name || '',
                              phone: r.phone || '',
                              doctorName: 'Dr. Sri Chaitanya',
                              date: new Date().toISOString().split('T')[0],
                              notes: `Proposed treatment plan compiled specifically for ${r.patient_name || 'the patient'}.`,
                              items: [
                                {
                                  id: `item-${Date.now()}`,
                                  treatment_type: r.treatment_type || 'Consultation',
                                  sessions: r.total_sessions ? Number(r.total_sessions) : 1,
                                  cost: estCost,
                                  notes: r.treatment_notes || 'Proposed dental procedure'
                                }
                              ]
                            });
                            setShowPDFBuilder(true);
                          }}
                          className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2 py-1 rounded-lg border border-indigo-150 transition cursor-pointer"
                          title="Generate Treatment Plan PDF"
                        >
                          <FileText size={11} className="text-indigo-600" />
                          <span>PDF Plan</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Multi-stage interactive status tracker stepper */}
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-150/80 space-y-3">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Procedure Path Tracker</span>
                      
                      {/* Interactive Session Done editor */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-slate-500 font-medium">
                          Sessions logged: <strong className="text-slate-800 font-bold">{r.sessions_done || 0}</strong> / {r.total_sessions || '∞'}
                        </span>
                        {r.total_sessions && (
                          <div className="flex items-center gap-1">
                            <button
                              title="Decrement session"
                              type="button"
                              onClick={() => {
                                const val = Math.max(0, (Number(r.sessions_done) || 0) - 1);
                                updateSessions(r.id, val, Number(r.total_sessions));
                              }}
                              className="w-5 h-5 bg-white border border-slate-250 text-slate-500 font-black text-xs rounded hover:bg-slate-100 flex items-center justify-center transition active:scale-90"
                            >
                              -
                            </button>
                            <button
                              title="Increment session"
                              type="button"
                              onClick={() => {
                                const nextVal = Math.min(Number(r.total_sessions), (Number(r.sessions_done) || 0) + 1);
                                updateSessions(r.id, nextVal, Number(r.total_sessions));
                                if (nextVal === Number(r.total_sessions) && r.stage !== 'Completed') {
                                  if (confirm("All planned sessions completed! Move stage to 'Completed'?")) {
                                    updateStage(r.id, 'Completed');
                                  }
                                }
                              }}
                              className="w-5 h-5 bg-white border border-slate-250 text-teal-600 font-black text-xs rounded hover:bg-slate-100 flex items-center justify-center transition active:scale-90"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Horizontal Line Stepper */}
                    <div className="flex items-center justify-between gap-1 py-1.5" onClick={e => e.stopPropagation()}>
                      {STAGES.map((s, idx) => {
                        const isCurrent = r.stage === s;
                        const currentIdx = STAGES.indexOf(r.stage);
                        const isPassed = STAGES.indexOf(s) <= currentIdx;
                        return (
                          <div key={s} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center relative">
                              <button
                                type="button"
                                onClick={() => updateStage(r.id, s)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                                  isCurrent ? 'bg-teal-600 text-white ring-4 ring-teal-100 scale-110 shadow-sm' :
                                  isPassed ? 'bg-teal-100 text-teal-800 border border-teal-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                                title={`Change stage to ${s}`}
                              >
                                {idx + 1}
                              </button>
                              <span className={`absolute top-8 whitespace-nowrap text-[9px] font-bold ${
                                isCurrent ? 'text-teal-700' : isPassed ? 'text-slate-600' : 'text-slate-350'
                              } max-sm:hidden`}>
                                {s}
                              </span>
                            </div>
                            {idx < STAGES.length - 1 && (
                              <div className={`h-1 flex-1 mx-2 rounded-full transition-colors ${
                                STAGES.indexOf(STAGES[idx + 1]) <= currentIdx ? 'bg-teal-400' : 'bg-slate-200'
                              }`} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Integrated visual double-gradient progress bar */}
                    <div className="pt-2 sm:pt-4">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                        <span>Overall Implementation:</span>
                        <span className="text-teal-600 font-black">{overallPercent}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-200/70 rounded-full overflow-hidden border border-slate-100">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${overallPercent}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Treatment Details</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div><span className="text-slate-400 text-xs">Patient</span><p className="font-semibold text-slate-800">{selected.patient_name}</p></div>
              <div><span className="text-slate-400 text-xs">Treatment</span><p className="text-slate-700">{selected.treatment_type}</p></div>
              <div><span className="text-slate-400 text-xs">Stage</span>
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${stageColor[selected.stage]}`}>{selected.stage}</span>
              </div>
              {selected.treatment_notes && <div><span className="text-slate-400 text-xs">Notes</span><p className="text-slate-600 mt-1">{selected.treatment_notes}</p></div>}
              {selected.doctor_notes && <div><span className="text-slate-400 text-xs">Doctor Notes</span><p className="text-slate-600 mt-1">{selected.doctor_notes}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Add Treatment Record</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Patient Name *</label>
                <input value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Treatment Type *</label>
                <select value={form.treatment_type} onChange={e => setForm(f => ({ ...f, treatment_type: e.target.value }))} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                  <option value="">Select</option>{TREATMENTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Total Sessions</label>
                  <input type="number" value={form.total_sessions} onChange={e => setForm(f => ({ ...f, total_sessions: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Sessions Done</label>
                  <input type="number" value={form.sessions_done} onChange={e => setForm(f => ({ ...f, sessions_done: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div><label className="text-xs font-medium text-slate-600 mb-1 block">Treatment Notes</label>
                <textarea value={form.treatment_notes} onChange={e => setForm(f => ({ ...f, treatment_notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none" />
              </div>
              
              {/* Reusable Doctor Selector */}
              <DoctorSelect
                selectedName={selectedDoctorName}
                required
                label="Assigned Dentist / Specialist"
                onChange={(doc) => setSelectedDoctorName(doc.name)}
              />
              <button type="submit" disabled={saving}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Treatment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PDF Estimator Plan Builder Modal */}
      {showPDFBuilder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-indigo-650">
                <FileText size={18} className="text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Treatment Plan Blueprint Generator</h3>
              </div>
              <button onClick={() => setShowPDFBuilder(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Patient and plan details block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Patient Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pdfPlanForm.patient_name}
                      onChange={e => setPdfPlanForm((prev: any) => ({ ...prev, patient_name: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                    {/* Autocomplete dropdown list of current treatment names */}
                    {pdfPlanForm.patient_name && !records.some(r => r.patient_name === pdfPlanForm.patient_name) && (
                      <div className="absolute z-10 left-0 right-0 mt-1 max-h-32 overflow-y-auto bg-white border border-slate-150 rounded-lg shadow-lg divide-y divide-slate-50">
                        {Array.from(new Set(records.map(r => r.patient_name)))
                          .filter(name => name?.toLowerCase().includes(pdfPlanForm.patient_name.toLowerCase()))
                          .map(name => {
                            const matchRec = records.find(r => r.patient_name === name);
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setPdfPlanForm((prev: any) => ({
                                  ...prev,
                                  patient_name: name,
                                  phone: matchRec?.phone || prev.phone
                                }))}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 font-medium text-slate-700"
                              >
                                {name} ({matchRec?.phone || 'No phone'})
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Phone / Mobile *</label>
                  <input
                    type="text"
                    value={pdfPlanForm.phone}
                    onChange={e => setPdfPlanForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Specialist Dentist *</label>
                  <select
                    value={pdfPlanForm.doctorName}
                    onChange={e => setPdfPlanForm((prev: any) => ({ ...prev, doctorName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
                  >
                    <option value="Dr. Sri Chaitanya">Dr. Sri Chaitanya (Implantologist)</option>
                    <option value="Dr. J. Durga Bhavani">Dr. J. Durga Bhavani (Cosmetic Surgeon)</option>
                    <option value="Dr. A. Madhavi">Dr. A. Madhavi (Endodontist)</option>
                    <option value="Dr. K. Prasad">Dr. K. Prasad (Orthodontist)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Plan Proposal Date</label>
                  <input
                    type="date"
                    value={pdfPlanForm.date}
                    onChange={e => setPdfPlanForm((prev: any) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
                  />
                </div>
              </div>

              {/* Proposed Line Items Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h4 className="text-xs font-black text-slate-850 uppercase tracking-wider">Planned Procedures Checklist</h4>
                  <button
                    type="button"
                    onClick={addPDFItem}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 cursor-pointer"
                  >
                    <PlusCircle size={12} /> Add Procedure Line
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {pdfPlanForm.items.map((item: any) => (
                    <div key={item.id} className="relative bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-2 z-10">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Procedure Type</label>
                          <select
                            value={item.treatment_type}
                            onChange={e => updatePDFItem(item.id, 'treatment_type', e.target.value)}
                            className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700"
                          >
                            {TREATMENTS.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase text-center block">Sessions</label>
                          <input
                            type="number"
                            min="1"
                            value={item.sessions}
                            onChange={e => updatePDFItem(item.id, 'sessions', Number(e.target.value) || 1)}
                            className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-center text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase text-right block">Estimate Cost (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={item.cost}
                            onChange={e => updatePDFItem(item.id, 'cost', Number(e.target.value) || 0)}
                            className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-right text-slate-700"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={item.notes}
                            placeholder="Enter specialized comments or tooth numbers... e.g. Tooth 24 RCT"
                            onChange={e => updatePDFItem(item.id, 'notes', e.target.value)}
                            className="w-full px-2.5 py-1 bg-white border border-slate-250 rounded text-[11px] text-slate-700"
                          />
                        </div>
                        {pdfPlanForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePDFItem(item.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            title="Remove item line"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* General Proposal remarks */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">General Treatment Strategy Notes & Terms</label>
                <textarea
                  value={pdfPlanForm.notes}
                  onChange={e => setPdfPlanForm((prev: any) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 resize-none"
                />
              </div>

              {/* Total Summary Footer bar */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">Grand Total Proposed Estimate</p>
                  <p className="text-xs text-indigo-600 font-medium mt-0.5">{pdfPlanForm.items.length} clinical procedures included</p>
                </div>
                <p className="text-base sm:text-lg font-black text-indigo-900 font-mono">
                  ₹{pdfPlanForm.items.reduce((sum: number, it: any) => sum + (Number(it.cost) || 0), 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="px-5 py-3 border-t bg-slate-50 flex items-center justify-between flex-shrink-0 z-20">
              <span className="text-[10.5px] italic text-slate-400 font-medium">Valid for 30 consecutive days</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => shareWhatsAppPlan(pdfPlanForm)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Share2 size={12} />
                  <span>WhatsApp Estimate</span>
                </button>
                <button
                  type="button"
                  onClick={() => generatePDFPlan(pdfPlanForm)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Printer size={12} />
                  <span>Download PDF Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
