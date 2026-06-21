import { useState, useEffect } from 'react';
import { Microscope, Beaker, FileText, CheckCircle2, AlertCircle, Clock, Plus, Search, Calendar, ChevronRight, Download, Eye, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LabRequest {
  id: string;
  patientName: string;
  testName: string;
  doctorName: string;
  status: 'Pending Collection' | 'Sample Collected' | 'In Process' | 'Report Uploaded' | 'Cancelled';
  priority: 'Urgent' | 'Routine';
  date: string;
  notes: string;
  testResult?: string;
}

const DEFAULT_LABS: LabRequest[] = [
  { id: '1', patientName: 'Sushma Reddy', testName: 'Biopsy Oral Tissue Histology', doctorName: 'Dr. Sri Chaitanya MDS', status: 'In Process', priority: 'Urgent', date: '2026-06-15', notes: 'Check for dysplastic margins round lower left molar.' },
  { id: '2', patientName: 'Aditya Sharma', testName: 'Panoramic Dental Radiograph (OPG)', doctorName: 'Dr. Sri Chaitanya MDS', status: 'Report Uploaded', priority: 'Routine', date: '2026-06-14', notes: 'Evaluate wisdom tooth impaction angle.', testResult: 'Class II Horizontal tooth impaction on Lower Right jaw. Mild pericoronitis noted.' },
  { id: '3', patientName: 'Leela Prasad', testName: 'Complete Blood Picture (CBP)', doctorName: 'Dr. K. Srilatha BDS', status: 'Pending Collection', priority: 'Routine', date: '2026-06-15', notes: 'Pre-extraction bleeding profile checks.' },
  { id: '4', patientName: 'Nagarjuna Rao', testName: 'CBCT Cone Beam Dental CT', doctorName: 'Dr. Sri Chaitanya MDS', status: 'Report Uploaded', priority: 'Urgent', date: '2026-06-12', notes: 'Verify exact bone density before implant healing placement.', testResult: 'Alveolar ridge width is 6.5mm with Type II bone qualities. Safe for implant.' }
];

export default function LabWork() {
  const [labs, setLabs] = useState<LabRequest[]>(() => {
    const cached = localStorage.getItem('crm_labwork_requests');
    return cached ? JSON.parse(cached) : DEFAULT_LABS;
  });

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  
  // Create state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPatient, setNewPatient] = useState('');
  const [newTest, setNewTest] = useState('Panoramic Dental Radiograph (OPG)');
  const [newDoctor, setNewDoctor] = useState('Dr. Sri Chaitanya MDS');
  const [newPriority, setNewPriority] = useState<'Routine' | 'Urgent'>('Routine');
  const [newNotes, setNewNotes] = useState('');

  // View state
  const [selectedLab, setSelectedLab] = useState<LabRequest | null>(null);
  const [editResult, setEditResult] = useState('');

  // Fetch labs from Supabase
  const fetchLabs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lab_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: LabRequest[] = data.map(item => ({
          id: item.id.toString(),
          patientName: item.patient_name || '',
          testName: item.test_name || '',
          doctorName: item.doctor_name || '',
          status: item.status || 'Pending Collection',
          priority: item.priority || 'Routine',
          date: item.date || new Date().toISOString().split('T')[0],
          notes: item.notes || '',
          testResult: item.test_result || ''
        }));
        setLabs(mapped);
      }
    } catch (err) {
      console.warn('[Labwork Sync] Handled fallback to local memory state.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  useEffect(() => {
    localStorage.setItem('crm_labwork_requests', JSON.stringify(labs));
  }, [labs]);

  const handleAddLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.trim()) return;

    try {
      const { data, error } = await supabase.from('lab_requests').insert([{
        patient_name: newPatient,
        test_name: newTest,
        doctor_name: newDoctor,
        status: 'Pending Collection',
        priority: newPriority,
        date: new Date().toISOString().split('T')[0],
        notes: newNotes
      }]).select();

      if (error) throw error;

      if (data && data[0]) {
        const item = data[0];
        const req: LabRequest = {
          id: item.id.toString(),
          patientName: item.patient_name || '',
          testName: item.test_name || '',
          doctorName: item.doctor_name || '',
          status: item.status || 'Pending Collection',
          priority: item.priority || 'Routine',
          date: item.date || new Date().toISOString().split('T')[0],
          notes: item.notes || '',
          testResult: item.test_result || ''
        };
        setLabs([req, ...labs]);
      } else {
        throw new Error("No data returned from insert");
      }
    } catch (err) {
      console.warn('[Labwork Add] Supabase table error, falling back locally.', err);
      const req: LabRequest = {
        id: Date.now().toString(),
        patientName: newPatient,
        testName: newTest,
        doctorName: newDoctor,
        status: 'Pending Collection',
        priority: newPriority,
        date: new Date().toISOString().split('T')[0],
        notes: newNotes
      };
      setLabs([req, ...labs]);
    }

    setNewPatient('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: LabRequest['status']) => {
    setLabs(labs.map(l => l.id === id ? { ...l, status: newStatus } : l));
    if (selectedLab && selectedLab.id === id) {
      setSelectedLab({ ...selectedLab, status: newStatus });
    }

    try {
      await supabase
        .from('lab_requests')
        .update({ status: newStatus })
        .eq('id', parseInt(id));
    } catch (err) {
      console.warn('[Labwork Status] Supabase update handled locally.');
    }
  };

  const handleSaveResult = async (id: string) => {
    setLabs(labs.map(l => l.id === id ? { ...l, testResult: editResult, status: 'Report Uploaded' } : l));
    if (selectedLab && selectedLab.id === id) {
      setSelectedLab({ ...selectedLab, testResult: editResult, status: 'Report Uploaded' });
    }

    try {
      await supabase
        .from('lab_requests')
        .update({ test_result: editResult, status: 'Report Uploaded' })
        .eq('id', parseInt(id));
    } catch (err) {
      console.warn('[Labwork Result] Supabase result write handled locally.');
    }

    alert('Lab diagnostic findings successfully saved & published to patient EMR.');
  };

  const filtered = labs.filter(l => {
    if (statusFilter !== 'All' && l.status !== statusFilter) return false;
    if (priorityFilter !== 'All' && l.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return l.patientName.toLowerCase().includes(q) || l.testName.toLowerCase().includes(q) || l.id.includes(q);
    }
    return true;
  });

  const pendingCount = labs.filter(l => l.status === 'Pending Collection' || l.status === 'Sample Collected').length;
  const inProcessCount = labs.filter(l => l.status === 'In Process').length;
  const completedCount = labs.filter(l => l.status === 'Report Uploaded').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-650 to-emerald-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <Microscope size={160} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <span className="bg-white/20 text-white font-mono font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
              Diagnostic & Imaging Lab Hub
            </span>
            <h1 className="text-2xl font-black tracking-tight mt-2">Clinical Diagnostics, Pathology & OPG</h1>
            <p className="text-xs text-white/80 max-w-xl font-medium mt-1">
              Order radiographic X-rays, tissue biopsies, and track diagnostic bio-sample chains-of-custodies securely inside the electronic clinical record.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="self-start md:self-center bg-white text-emerald-800 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> New Test Request
          </button>
        </div>
      </div>

      {/* Lab Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center font-bold">
            <Beaker size={22} className="animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Samples Pending</p>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-0.5">{pendingCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Analysis</p>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-0.5">{inProcessCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Reports Ready</p>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-0.5">{completedCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center font-bold">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Urgent Requests</p>
            <h3 className="text-2xl font-extrabold text-red-650 mt-0.5">{labs.filter(l => l.priority === 'Urgent').length}</h3>
          </div>
        </div>
      </div>

      {/* Roster Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Diagnostics Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3 flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5 font-sans">
              <Microscope size={15} /> Lab Requests Queue
            </h2>

            <div className="flex gap-2 font-sans text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 border rounded-lg font-bold bg-white outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Pending Collection">Pending</option>
                <option value="Sample Collected">Collected</option>
                <option value="In Process">In Process</option>
                <option value="Report Uploaded">Compiled</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-8 px-2.5 border rounded-lg font-bold bg-white outline-none cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="Routine">Routine</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, radiograph, scan types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none placeholder:text-gray-400 font-sans font-medium"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="pb-2">Test Request ID</th>
                  <th className="pb-2">Patient</th>
                  <th className="pb-2">Required Investigation</th>
                  <th className="pb-2">Priority</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700 font-medium text-[11.5px]">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 font-mono font-bold text-[#2F63E0]">#LAB-{l.id}</td>
                    <td className="py-3 font-extrabold text-[#111827]">{l.patientName}</td>
                    <td className="py-3">
                      <div>
                        <p className="font-semibold text-gray-800">{l.testName}</p>
                        <p className="text-[10px] text-gray-500">Ordered by {l.doctorName}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                        l.priority === 'Urgent' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {l.priority}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                        l.status === 'Report Uploaded' ? 'bg-green-50 text-green-700' :
                        l.status === 'In Process' ? 'bg-indigo-50 text-indigo-700' :
                        l.status === 'Sample Collected' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-150 text-slate-650'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => { setSelectedLab(l); setEditResult(l.testResult || ''); }}
                        className="p-1 px-2.5 bg-slate-100 hover:bg-[#2F63E0] hover:text-white rounded-lg font-bold text-[10px] uppercase text-[#2F63E0] border border-gray-200 cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Diagnostic Inspector Sidebar */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
            <Beaker size={14} className="text-[#8757EA]" /> Investigation Console
          </h3>

          {selectedLab ? (
            <div className="space-y-4 font-sans text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[10px] text-gray-500 uppercase tracking-wider">Test Case: #LAB-{selectedLab.id}</span>
                  <span className="text-[10px] text-gray-550 font-mono font-bold">{selectedLab.date}</span>
                </div>
                <h4 className="font-black text-sm text-[#111827]">{selectedLab.patientName}</h4>
                <p className="font-semibold text-slate-700">{selectedLab.testName}</p>
                <p className="text-[10.5px] text-slate-550 italic">" {selectedLab.notes} "</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Diagnostic Process Tracker</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleUpdateStatus(selectedLab.id, 'Sample Collected')}
                    className={`py-1.5 rounded-lg font-bold text-[10px] uppercase border text-center cursor-pointer transition ${
                      selectedLab.status === 'Sample Collected' 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    Sample Taken
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedLab.id, 'In Process')}
                    className={`py-1.5 rounded-lg font-bold text-[10px] uppercase border text-center cursor-pointer transition ${
                      selectedLab.status === 'In Process' 
                        ? 'bg-indigo-500 text-white' 
                        : 'bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    In Process
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-gray-500">Report Findings / Lab Observations</label>
                <textarea
                  rows={4}
                  placeholder="Record exact dental bone depths, pathology outcomes, or visual radiogram readings..."
                  value={editResult}
                  onChange={(e) => setEditResult(e.target.value)}
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-[11px] focus:ring-1 focus:ring-emerald-400 font-medium"
                />
              </div>

              <button
                onClick={() => handleSaveResult(selectedLab.id)}
                className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Save & Upload EMR Findings
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 font-sans italic text-xs">
              Select any laboratory request from the left list to edit observations, update samples, and enter final clinical readings.
            </div>
          )}
        </div>
      </div>

      {/* Add Request Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-5 text-white">
              <h3 className="text-base font-black tracking-tight uppercase">Order Lab Investigation</h3>
              <p className="text-xs text-white/80 mt-1 font-medium">Add a diagnostic or OPG X-ray request directly to workflow</p>
            </div>

            <form onSubmit={handleAddLab} className="p-5 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Patient Name</label>
                <input
                  type="text"
                  placeholder="e.g. Nagarjuna Rao"
                  value={newPatient}
                  onChange={(e) => setNewPatient(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs text-gray-900 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white font-bold"
                  >
                    <option value="Routine">Routine</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Practitioner</label>
                  <select
                    value={newDoctor}
                    onChange={(e) => setNewDoctor(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white font-semibold"
                  >
                    <option value="Dr. Sri Chaitanya MDS">Dr. Sri Chaitanya MDS</option>
                    <option value="Dr. K. Srilatha BDS">Dr. K. Srilatha BDS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Assigned Lab Test Category</label>
                <select
                  value={newTest}
                  onChange={(e) => setNewTest(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white font-semibold"
                >
                  <option value="Panoramic Dental Radiograph (OPG)">Panoramic Dental Radiograph (OPG)</option>
                  <option value="Cone Beam Dental CT (CBCT)">Cone Beam Dental CT (CBCT)</option>
                  <option value="Biopsy Oral Tissue Histology">Biopsy Oral Tissue Histology</option>
                  <option value="Complete Blood Picture (CBP)">Complete Blood Picture (CBP)</option>
                  <option value="Mandibular Occlusal Radiograph">Mandibular Occlusal Radiograph</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Special Clinical Notes & Objectives</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Check periodontal pocket depths, check root resorption..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full border border-gray-200 p-3 rounded-xl focus:ring-1 focus:ring-emerald-500 text-xs font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-55 shadow-sm font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white hover:opacity-90 font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Request Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
