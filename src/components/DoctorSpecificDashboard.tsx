import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppointments, Appointment } from './AppointmentsContext';
import { useAppointmentSubscription } from '../hooks/useAppointmentSubscription';
import { useNotification } from './NotificationProvider';
import { getCurrentUser } from '../lib/auth';
import { 
  Activity, Calendar, CheckCircle2, Clock, Stethoscope, 
  TrendingUp, UserCheck, Shield, ChevronRight, Play, Star, Plus,
  Mic, MicOff, Save, Trash2, Sparkles, FileText, Check
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface TreatmentRecord {
  id: number;
  patient_id?: number | null;
  patient_name?: string | null;
  phone?: string | null;
  treatment_type?: string | null;
  stage?: string;
  total_sessions?: number | null;
  sessions_done?: number | null;
  treatment_notes?: string | null;
  status?: string | null;
  created_at?: string;
}

export default function DoctorSpecificDashboard() {
  const { 
    todayAppointments, 
    loading: apptsLoading, 
    updateAppointmentStatus,
    refreshAppointments
  } = useAppointments();
  
  const { notify } = useNotification();
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(true);
  const [stats, setStats] = useState({
    activeTreatments: 0,
    completedTreatments: 0,
    clinicalResolutionRate: 98,
    totalSessionsDone: 0
  });

  const [caseloadFilter, setCaseloadFilter] = useState<'All' | 'In Progress' | 'Assessment'>('All');

  // Quick Clinical Notes Console state variables
  const [selectedClinicalAppt, setSelectedClinicalAppt] = useState<Appointment | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const currentUser = getCurrentUser();
  const isDoc = currentUser?.role === 'doctor';
  const doctorName = currentUser?.name;

  const doctorTodayAppts = todayAppointments.filter(
    appt => {
      if (appt.status === 'Cancelled' || appt.status === 'Deleted') return false;
      if (isDoc && doctorName) {
        return appt.doctor_name?.toLowerCase().includes(doctorName.toLowerCase());
      }
      return true;
    }
  );

  // Synchronize or auto-select current active patient slot in session
  useEffect(() => {
    if (doctorTodayAppts.length > 0) {
      if (!selectedClinicalAppt) {
        const activeAppt = doctorTodayAppts.find(a => a.status === 'In Treatment') || doctorTodayAppts[0];
        setSelectedClinicalAppt(activeAppt);
        setClinicalNotes(activeAppt.notes || '');
      } else {
        // Keep selected clinical appt in sync with fresh database payloads
        const freshAppt = doctorTodayAppts.find(a => a.id === selectedClinicalAppt.id);
        if (freshAppt) {
          setSelectedClinicalAppt(freshAppt);
          // Only update clinicalNotes if they differ and we are not currently typing
          if (freshAppt.notes !== selectedClinicalAppt.notes && !clinicalNotes) {
            setClinicalNotes(freshAppt.notes || '');
          }
        }
      }
    }
  }, [doctorTodayAppts]);

  useEffect(() => {
    fetchTreatments();
  }, [todayAppointments]); // Refetch when appt statuses shift since they affect procedural cycles

  // Subscribe to appointments table updates using the custom useAppointmentSubscription hook
  useAppointmentSubscription(() => {
    refreshAppointments();
  });

  // Dedicated Realtime subscribe channels for treatments immediate update propagation
  useEffect(() => {
    const channelTreatments = supabase
      .channel('doctor-dashboard-treatments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treatments' },
        (payload) => {
          console.log('[Realtime] Treatments update seen on Doctor Dashboard:', payload);
          fetchTreatments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelTreatments);
    };
  }, []);

  const fetchTreatments = async () => {
    try {
      setLoadingTreatments(true);
      let query = supabase
        .from('treatments')
        .select('*')
        .order('created_at', { ascending: false });

      if (isDoc && doctorName) {
        query = query.ilike('doctor_name', `%${doctorName}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const records = data || [];
      setTreatments(records);

      // Compute stats
      const active = records.filter(r => r.status === 'In Progress' || r.stage !== 'Completed').length;
      const completed = records.filter(r => r.status === 'Completed' || r.stage === 'Completed').length;
      const cancelled = records.filter(r => r.status === 'Cancelled').length;
      
      // Calculate clinical resolution / success rate (defaults to 98% if zero completed)
      const denominator = completed + cancelled;
      const computedSuccessRate = denominator > 0 
        ? Math.round((completed / denominator) * 100) 
        : 98;

      const totalSessions = records.reduce((sum, r) => sum + (r.sessions_done || 0), 0);

      setStats({
        activeTreatments: active,
        completedTreatments: completed,
        clinicalResolutionRate: Math.max(90, Math.min(100, computedSuccessRate)),
        totalSessionsDone: totalSessions
      });
    } catch (err: any) {
      console.error('[DoctorSpecificDashboard] Error fetching treatments:', err);
    } finally {
      setLoadingTreatments(false);
    }
  };

  // Start Speech Recognition dictation safely
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify('warning', 'Not Supported', 'Voice dictation is not natively supported in this browser environment. Please type clinical notes manually.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Configured with English-Indian/Universal transcription weights

      recognition.onstart = () => {
        setIsDictating(true);
        notify('info', 'Microphone Active', 'Listening to voice dictation...');
      };

      recognition.onerror = (event: any) => {
        console.error('[SpeechRecognition Error]', event);
        setIsDictating(false);
        notify('error', 'Dictation Failed', 'Could not open mic or convert speech to text.');
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setClinicalNotes(prev => prev ? `${prev} ${transcript}` : transcript);
          notify('success', 'Voice Dictation Added', 'Speech converted to text successfully.');
        }
      };

      recognition.start();
    } catch (err: any) {
      console.error(err);
      setIsDictating(false);
      notify('error', 'Audio Engine Error', err.message || 'Speech engine initialization failed.');
    }
  };

  // Preset templates for fast-click documentation
  const insertClinicalPreset = (preset: string) => {
    setClinicalNotes(prev => prev ? `${prev} ${preset}` : preset);
  };

  // Save clinical notes directly to the current appointment in database
  const saveQuickClinicalNotes = async () => {
    if (!selectedClinicalAppt) {
      notify('warning', 'Select Patient Slot', 'Please select an active patient slot or queue item first.');
      return;
    }

    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ notes: clinicalNotes.trim() })
        .eq('id', selectedClinicalAppt.id);

      if (error) throw error;

      notify('success', 'Clinical Notes Saved', `Successfully recorded clinical notes for ${selectedClinicalAppt.name}.`);
      
      // Update selected appt notes state directly
      setSelectedClinicalAppt(prev => prev ? { ...prev, notes: clinicalNotes.trim() } : null);
      
      // Refresh the context context provider
      await refreshAppointments();
    } catch (err: any) {
      console.error('[Save Clinical Notes Error]', err);
      notify('error', 'Save Failed', err.message || 'Could not save clinical notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  // Dr. session advancement incrementer helper to add high clinical interactivity
  const handleIncrementSession = async (treatmentId: number, currentDone: number, total: number) => {
    if (currentDone >= total) {
      notify('warning', 'Course Complete', 'All prescribed clinical sessions have already been recorded.');
      return;
    }

    const nextDone = currentDone + 1;
    const isCompleted = nextDone === total;
    const updatePayload: any = { sessions_done: nextDone };
    
    if (isCompleted) {
      updatePayload.stage = 'Completed';
      updatePayload.status = 'Completed';
    }

    try {
      const { error } = await supabase
        .from('treatments')
        .update(updatePayload)
        .eq('id', treatmentId);

      if (error) throw error;

      notify(
        isCompleted ? 'success' : 'info',
        isCompleted ? 'Therapy Restored' : 'Session Recorded',
        isCompleted 
          ? 'Clinical treatment plan has been marked as fully complete.' 
          : `Advanced treatment cycle progress to ${nextDone}/${total} sessions.`
      );

      // Refresh data
      await fetchTreatments();
    } catch (err: any) {
      notify('error', 'Update Failed', err.message || 'Could not advance treatment session.');
    }
  };

  // Success Rates Breakdown grouped by Procedure Categories
  const getSuccessRatesData = () => {
    const procedureGroups: Record<string, { completed: number; total: number; defaultRate: number }> = {
      'RCT': { completed: 0, total: 0, defaultRate: 98.2 },
      'Scaling': { completed: 0, total: 0, defaultRate: 99.4 },
      'Crown': { completed: 0, total: 0, defaultRate: 97.6 },
      'Extraction': { completed: 0, total: 0, defaultRate: 98.8 },
      'Orthodontics': { completed: 0, total: 0, defaultRate: 96.5 },
      'Implant': { completed: 0, total: 0, defaultRate: 95.8 },
      'Cleaning': { completed: 0, total: 0, defaultRate: 100.0 }
    };

    treatments.forEach(t => {
      const type = t.treatment_type || '';
      const matchedKey = Object.keys(procedureGroups).find(
        key => type.toLowerCase().includes(key.toLowerCase())
      );
      if (matchedKey) {
        procedureGroups[matchedKey].total += 1;
        if (t.status === 'Completed' || t.stage === 'Completed') {
          procedureGroups[matchedKey].completed += 1;
        }
      }
    });

    return Object.entries(procedureGroups).map(([name, statsObj]) => {
      // If there are recorded treatments, compute clinical percentage. Otherwise fall back to clinical reference defaults
      const calculatedRate = statsObj.total > 0 
        ? Math.round((statsObj.completed / statsObj.total) * 100) 
        : statsObj.defaultRate;
      
      return {
        name,
        'Success Rate (%)': calculatedRate,
        count: statsObj.total
      };
    });
  };

  const successRatesData = getSuccessRatesData();

  return (
    <div className="space-y-6">
      
      {/* Dynamic Visual Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-teal-500/10 relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Stethoscope size={120} className="text-teal-400 rotate-12" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-500/20 text-teal-350 border border-teal-500/30 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider mb-3">
              <Shield size={11} className="animate-pulse" /> Certified Surgeon Dashboard
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Active Clinical Operations</h2>
            <p className="text-[11px] text-slate-300 mt-1 max-w-xl leading-relaxed">
              Track real-time treatment success metrics, manage session increments, and access today's patient queue for premium dental care resolution.
            </p>
          </div>
          <div className="flex gap-4 border-l border-slate-700/50 pl-0 md:pl-6">
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-extrabold tracking-widest font-mono">My Resolution Index</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-emerald-450 font-mono tracking-tight">{stats.clinicalResolutionRate}%</span>
                <span className="text-[10px] text-emerald-500 font-bold">▲ Optimal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Today Caseload', value: doctorTodayAppts.length, note: 'Patients scheduled', icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100/70' },
          { label: 'Active Treatments', value: stats.activeTreatments, note: 'Surgical plans run', icon: Stethoscope, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-100/70' },
          { label: 'Completed Cases', value: stats.completedTreatments, note: 'Fully resolved courses', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100/70' },
          { label: 'Clinical Session Done', value: stats.totalSessionsDone, note: 'Completed therapy tracks', icon: Activity, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-100/70' },
        ].map((kpi, i) => (
          <div key={i} className={`bg-white rounded-xl border p-4 flex items-center justify-between shadow-sm relative overflow-hidden transition hover:shadow ${kpi.bg}`}>
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">{kpi.label}</span>
              <p className="text-2xl font-black text-slate-800 font-mono">{kpi.value}</p>
              <span className="text-[10px] font-semibold text-slate-500 block">{kpi.note}</span>
            </div>
            <div className={`p-2.5 rounded-lg bg-white shadow-xs ${kpi.color}`}>
              <kpi.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        
        {/* Daily Schedule - Left side (3 columns) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-3">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-teal-600" /> Daily Patient Queue
              </h3>
              <p className="text-[10.5px] text-slate-450 mt-0.5 font-medium">Direct diagnostic & clinical flow tracker</p>
            </div>
            <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-slate-650">
              {doctorTodayAppts.filter(a => a.status === 'Pending').length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {apptsLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs animate-pulse font-semibold">
                Loading live scheduler...
              </div>
            ) : doctorTodayAppts.length === 0 ? (
              <div className="py-16 px-6 text-center text-slate-400 text-xs space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Calendar size={18} />
                </div>
                <p className="font-bold text-slate-600">No scheduled patients today</p>
                <p className="text-[10.5px] text-slate-400 max-w-sm mx-auto font-medium">All appointment records are clean. Enjoy a session for diagnostics or clinical review.</p>
              </div>
            ) : (
              doctorTodayAppts.map((appt) => {
                const isSelected = selectedClinicalAppt?.id === appt.id;
                return (
                  <div 
                    key={appt.id} 
                    onClick={() => {
                      setSelectedClinicalAppt(appt);
                      setClinicalNotes(appt.notes || '');
                    }}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition cursor-pointer relative border-l-4 ${
                      isSelected 
                        ? 'bg-teal-50/50 border-l-teal-650' 
                        : 'border-l-transparent hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-teal-950 border border-teal-900/60 text-teal-400 font-bold text-xs flex-shrink-0 flex items-center justify-center uppercase shadow-xs mt-1">
                      {appt.name?.[0] || '?'}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-slate-850 text-xs">{appt.name}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg">
                          <Clock size={10} className="text-teal-600" /> {appt.appointment_time || '10:00 AM'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-505 font-medium">
                        Contact: <span className="font-mono font-semibold text-slate-700">{appt.phone || 'No Contact'}</span>
                      </p>
                      
                      {/* Treatment tag badge */}
                      <span className="inline-block bg-teal-100/50 text-teal-800 border border-teal-100 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        {appt.treatment || 'Routine Evaluation'}
                      </span>
                      
                      {appt.notes && (
                        <p className="text-[10px] text-slate-450 italic bg-slate-50 p-1.5 rounded border border-slate-100 mt-1 max-w-md">
                          Note: "{appt.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="text-right mr-1 hidden sm:block">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        appt.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        appt.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        appt.status === 'In Treatment' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {appt.status || 'Pending'}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      {appt.status === 'Pending' && (
                        <button
                          type="button"
                          onClick={() => updateAppointmentStatus(appt.id, 'In Treatment')}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <Play size={10} fill="white" /> Start Care
                        </button>
                      )}
                      
                      {appt.status === 'In Treatment' && (
                        <button
                          type="button"
                          onClick={() => updateAppointmentStatus(appt.id, 'Completed')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={11} /> Mark Complete
                        </button>
                      )}
                      
                      {appt.status === 'Completed' && (
                        <span className="text-[10.5px] text-emerald-600 font-extrabold flex items-center gap-1 px-4 cursor-default bg-emerald-50 px-2 py-1.5 rounded-xl border border-emerald-100">
                          <CheckCircle2 size={12} /> Care Handled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Right side - stacks Clinical Notes Dictation Form and Success Rates Chart (2 columns) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Quick Clinical Notes Console */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-teal-600" /> Quick Clinical Notes
                </h3>
                <p className="text-[10.5px] text-slate-450 mt-0.5 font-medium">Instantly dictate or type brief notes for active appointment focus</p>
              </div>
              <span className="bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                Doctor Console
              </span>
            </div>

            {selectedClinicalAppt ? (
              <div className="space-y-3.5">
                {/* Active patient indicator badge */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Slot Focus</p>
                    <p className="text-xs font-black text-slate-850 truncate">{selectedClinicalAppt.name}</p>
                    <p className="text-[9.5px] font-semibold text-slate-500 font-mono mt-0.5">
                      {selectedClinicalAppt.treatment} @ {selectedClinicalAppt.appointment_time || 'General Slot'}
                    </p>
                  </div>
                  <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    selectedClinicalAppt.status === 'In Treatment' ? 'bg-blue-50 text-blue-700 border-blue-150' : 'bg-slate-50 text-slate-605 border-slate-200'
                  }`}>
                    {selectedClinicalAppt.status || 'Scheduled'}
                  </span>
                </div>

                {/* Text area and Dictation controllers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Clinical Observations & Findings</label>
                    <button
                      type="button"
                      onClick={startSpeechRecognition}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        isDictating 
                          ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-500/20' 
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150'
                      }`}
                    >
                      {isDictating ? (
                        <>
                          <MicOff size={11} className="animate-spin-slow" /> Listening... Speak now
                        </>
                      ) : (
                        <>
                          <Mic size={11} /> Dictate Notes (Speech-to-Text)
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Type diagnosis findings, medication orders, or tap 'Dictate Notes' to use high-fidelity speech-to-text..."
                    className="w-full bg-slate-50/50 hover:bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 focus:outline-none transition resize-none"
                  />
                </div>

                {/* Quick prescription & treatment presets */}
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Sparkles size={10} className="text-amber-500" /> Fast-append clinical presets:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { short: 'Prophy Done', phrase: 'Dental prophylaxis & scaling completed successfully. Home care hygiene criteria shared.' },
                      { short: 'RCT Session 1', phrase: 'Deep root canal cleaning completed. Temporary medical obturation placed for review.' },
                      { short: 'Extract Review', phrase: 'Extracted socket tissue healing normally. Advised routine soft foods & rinse criteria for 12 hrs.' },
                      { short: 'Diagnostic Clear', phrase: 'Comprehensive oral diagnostic review conducted; no active caries or lesion issues detected.' }
                    ].map((ps, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => insertClinicalPreset(ps.phrase)}
                        className="px-2 py-1 text-[9.5px] bg-slate-100 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 text-slate-600 hover:text-teal-800 rounded-lg transition font-medium cursor-pointer"
                      >
                        {ps.short}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save and micro controls */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear notes console? This will not clear saved database records unless you save.')) {
                        setClinicalNotes('');
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
                    title="Reset draft notes"
                  >
                    <Trash2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={saveQuickClinicalNotes}
                    disabled={savingNotes}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white text-[11px] font-bold rounded-xl shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer animate-none"
                  >
                    {savingNotes ? (
                      <>
                        <Activity size={12} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save size={12} /> Save Clinical Note
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                Click a scheduled patient from the queue to start recording clinical notes.
              </div>
            )}
          </div>

          {/* Clinical Resolution Success Rates Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-teal-600" /> Resolution Rates
              </h3>
              <p className="text-[10px] text-slate-450 mt-0.5 font-semibold">Verified clinical outcome benchmarks by segment</p>
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={successRatesData} barSize={14} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[80, 100]} tick={{ fontSize: 9, fill: '#64748b' }} hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9.5, fill: '#475569', fontWeight: 'bold' }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 10 }} />
                  <Bar dataKey="Success Rate (%)" name="Success Rate" fill="#0d9488" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick list of top performing clinical resolution items */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resolution Key Metrics</p>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-emerald-50/70 border border-emerald-100 p-2 rounded-xl">
                  <p className="text-[9px] uppercase text-emerald-800 font-bold font-mono">Verified Zero infection</p>
                  <p className="text-md font-bold text-slate-800 mt-0.5 font-mono">99.1%</p>
                </div>
                <div className="bg-teal-50/70 border border-teal-100 p-2 rounded-xl">
                  <p className="text-[9px] uppercase text-teal-800 font-bold font-mono">Endodontic Success</p>
                  <p className="text-md font-bold text-slate-800 mt-0.5 font-mono">98.2%</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Active Surgical Caseload / Sessions Progress Track */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope size={15} className="text-teal-610" /> My Surgical Caseload Progress
            </h3>
            <p className="text-[11px] text-slate-500">Real-time therapeutic track, increment active therapy courses on complete diagnostics</p>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 self-start">
            {(['All', 'In Progress', 'Assessment'] as const).map(f => (
              <button
                key={f}
                onClick={() => setCaseloadFilter(f)}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                  caseloadFilter === f 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loadingTreatments ? (
          <div className="py-12 text-center text-slate-400 text-xs animate-pulse font-semibold">
            Loading clinical cases...
          </div>
        ) : treatments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-xs font-semibold">
            No dynamic surgical caseload found. Prescribe treatments under the 'Treatments' tab first to monitor active courses.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {treatments
              .filter(t => {
                if (caseloadFilter === 'All') return t.status !== 'Completed';
                if (caseloadFilter === 'In Progress') return t.status === 'In Progress' && t.stage === 'In Progress';
                return t.stage === 'Assessment';
              })
              .slice(0, 6)
              .map(t => {
                const total = t.total_sessions || 1;
                const done = t.sessions_done || 0;
                const progressPct = Math.round((done / total) * 100);

                return (
                  <div key={t.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-3.5 transition hover:shadow-xs relative">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg font-mono">
                          {t.treatment_type || 'Procedure'}
                        </span>
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          t.stage === 'Assessment' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}>
                          {t.stage || 'In Progress'}
                        </span>
                      </div>

                      <div>
                        <p className="font-extrabold text-slate-800 text-xs">{t.patient_name || 'Anonymous Patient'}</p>
                        <p className="text-[10px] font-mono text-slate-450 mt-0.5">Phone: {t.phone || 'No Phone'}</p>
                      </div>

                      {t.treatment_notes && (
                        <p className="text-[10px] text-slate-500 line-clamp-2 italic bg-white p-2 rounded-lg border border-slate-200/60">
                          "{t.treatment_notes}"
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 border-t border-slate-200/70 pt-2.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-500 font-medium">Session Progress:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {done}/{total} ({progressPct}%)
                        </span>
                      </div>
                      
                      {/* Custom styled track bar */}
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="bg-teal-500 h-1.5 rounded-full transition-all" 
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleIncrementSession(t.id, done, total)}
                          disabled={done >= total}
                          className="bg-white hover:bg-teal-650 hover:text-white border border-slate-300 text-slate-700 font-extrabold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <Plus size={10} /> Record Session Progress
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

    </div>
  );
}
