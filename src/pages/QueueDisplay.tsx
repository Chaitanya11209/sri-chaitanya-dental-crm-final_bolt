import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Tv, Volume2, UserCheck, Play, Plus, Clock, Megaphone, 
  Sparkles, CheckCircle2, Shield, HeartPulse, Stethoscope 
} from 'lucide-react';

interface QueueItem {
  token: string;
  name: string;
  doctor: string;
  department: string;
  room: string;
  waitTime: string;
  status: 'In Consultation' | 'Preparing' | 'Waiting';
}

export default function QueueDisplay() {
  // Mock clinic queue states as defaults
  const [nowServing, setNowServing] = useState<QueueItem>({
    token: 'T03',
    name: 'Sushma Reddy',
    doctor: 'Dr. Sri Chaitanya MDS',
    department: 'MDS Oral Surgery',
    room: 'Surgical Cabin 1',
    waitTime: 'Active',
    status: 'In Consultation'
  });

  const [upcomingQueue, setUpcomingQueue] = useState<QueueItem[]>([
    { token: 'T04', name: 'Aditya Sharma', doctor: 'Dr. Sri Chaitanya MDS', department: 'Endodontics', room: 'Consulting Cabin 1', waitTime: '12 Mins', status: 'Waiting' },
    { token: 'T05', name: 'Kiran Patel', doctor: 'Dr. K. Srilatha BDS', department: 'Pediatric Dentistry', room: 'Cabin 2 (Kids)', waitTime: '22 Mins', status: 'Waiting' },
    { token: 'T06', name: 'Leela Prasad', doctor: 'Dr. Sri Chaitanya MDS', department: 'Orthodontics', room: 'Cabin 3', waitTime: '35 Mins', status: 'Waiting' },
    { token: 'T07', name: 'Nagarjuna Rao', doctor: 'Dr. K. Srilatha BDS', department: 'Scaling / Cleaning', room: 'Cabin 2 (Kids)', waitTime: '48 Mins', status: 'Waiting' }
  ]);

  const [time, setTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastAnnouncedToken, setLastAnnouncedToken] = useState('');

  // Clock ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh updates queue list from actual live Supabase database every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      console.log('[QueueDisplay] Auto-refresh tick. Refetching active queues from DB...');
      fetchTodayQueueFromDb();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getLocalTodayString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch and update queue list based on actual live Supabase database appointments
  const fetchTodayQueueFromDb = async () => {
    try {
      const todayStr = getLocalTodayString();
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('next_visit', todayStr)
        .neq('status', 'Deleted')
        .neq('status', 'Cancelled');

      if (error) throw error;

      if (data && data.length > 0) {
        // Find if there's any active patient currently in treatment/consultation
        const activeAppt = data.find(
          (a) => a.status === 'In Treatment' || a.status === 'In Consultation' || a.status === 'In-Consultation'
        );
        
        // Filter out completed and the active one (if found)
        const waitingAppts = data.filter(
          (a) => a.status !== 'Completed' && a.id !== activeAppt?.id
        );

        if (activeAppt) {
          setNowServing({
            token: `T${String(activeAppt.id % 90 + 10)}`,
            name: activeAppt.name,
            doctor: activeAppt.doctor_name || 'Dr. Sri Chaitanya MDS',
            department: activeAppt.treatment || 'Consultation',
            room: activeAppt.notes && activeAppt.notes.includes('Cabin') ? activeAppt.notes.substring(0, 30) : 'Consulting Cabin 1',
            waitTime: 'Active',
            status: 'In Consultation'
          });
        }

        if (waitingAppts.length > 0) {
          const mappedWaiting = waitingAppts.map((a, idx) => ({
            token: `T${String(a.id % 90 + 10)}`,
            name: a.name,
            doctor: a.doctor_name || 'Dr. Sri Chaitanya MDS',
            department: a.treatment || 'Consultation',
            room: a.notes && a.notes.includes('Cabin') ? a.notes.substring(0, 30) : 'Consulting Cabin 1',
            waitTime: `${(idx + 1) * 12} Mins`,
            status: 'Waiting' as const
          }));
          setUpcomingQueue(mappedWaiting);
        }
      }
    } catch (err) {
      console.warn('[QueueDisplay] Error pre-populating queue from DB:', err);
    }
  };

  // Real-time listener: Subscribes to appointments, filters for today, shifts to In-Consultation on updates
  useEffect(() => {
    const todayStr = getLocalTodayString();

    // Read initial database data
    fetchTodayQueueFromDb();

    const channel = supabase
      .channel('queue-display-appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          const record = (payload.new || payload.old) as any;
          if (!record || record.next_visit !== todayStr) return;

          console.log('[QueueDisplay Realtime] Appointment update detected:', payload);

          // Triggers state change: Shift patient from 'Waiting' to 'In-Consultation' in real-time when status transitions!
          const appt = payload.new as any;
          if (appt && (appt.status === 'In Treatment' || appt.status === 'In-Consultation' || appt.status === 'In Consultation')) {
            // Find patient in upcomingQueue and shift
            setUpcomingQueue(prevUpcoming => {
              const patientToken = `T${String(appt.id % 90 + 10)}`;
              const found = prevUpcoming.find(q => q.token === patientToken || q.name.toLowerCase() === appt.name.toLowerCase());
              if (found) {
                // Set as currently serving, and filter out from waiting list
                const shiftedObj: QueueItem = {
                  token: found.token,
                  name: found.name,
                  doctor: appt.doctor_name || found.doctor,
                  department: appt.treatment || found.department,
                  room: appt.notes && appt.notes.includes('Cabin') ? appt.notes.substring(0, 30) : 'Consulting Cabin 1',
                  waitTime: 'Active',
                  status: 'In Consultation'
                };
                setNowServing(shiftedObj);
                speakTokenAnnouncement(shiftedObj);
                return prevUpcoming.filter(q => q.token !== found.token);
              }
              return prevUpcoming;
            });
          }

          // Fetch fresh list from database to ensure everything is in perfect synchronization
          fetchTodayQueueFromDb();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Synthetic Lobby Chime (A beautiful dental dual-tone ding)
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // High ding
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc1.type = 'sine';
      
      // Low intermediate harmony ding
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(440.00, ctx.currentTime + 0.15); // A4 note
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
      osc2.type = 'sine';
      
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.6);
      
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.75);
    } catch (e) {
      console.warn("Audio Context block by sandbox:", e);
    }
  };

  // Synthetic Text-To-Speech Queue Broadcaster
  const speakTokenAnnouncement = (item: QueueItem) => {
    if (!isVoiceActive) return;

    // Chime play
    playChime();

    // Trigger TTS announcement after short delay to let chime resolve
    setTimeout(() => {
      const textToSpeak = `Token number ${item.token}. ${item.name}. Please proceed to ${item.room} under ${item.doctor}.`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Set to Indian English accent weighting if available!
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
      if (indianVoice) {
        utterance.voice = indianVoice;
      }
      utterance.rate = 0.88; // Professional receptionist clarity pacing
      utterance.pitch = 1.05; // Friendly clinical warmth modulation
      window.speechSynthesis.speak(utterance);
    }, 850);
  };

  // ADVANCE QUEUE BUMP CONTROL
  const advanceQueueNext = () => {
    if (upcomingQueue.length === 0) {
      alert("All waiting tokens have been successfully served!");
      return;
    }

    const nextPatient = upcomingQueue[0];
    const updatedUpcoming = upcomingQueue.slice(1);

    // Old serving goes to completed or is replaced index-wise
    setNowServing({
      ...nextPatient,
      waitTime: 'Active',
      status: 'In Consultation'
    });

    setUpcomingQueue(updatedUpcoming);
    setLastAnnouncedToken(nextPatient.token);
    speakTokenAnnouncement(nextPatient);
  };

  // RE-ANNOUNCE CURRENT ACTIVE APPOINTMENT
  const triggerReannouncement = () => {
    speakTokenAnnouncement(nowServing);
  };

  // GENERATE NEW INDEPENDENT WALK-IN GUEST
  const registerMockWalkIn = () => {
    const randomFirstNames = ['Rajesh', 'Suresh', 'Manish', 'Kavitha', 'Aruna', 'Vijay', 'Swetha', 'Prakash'];
    const randomLastNames = ['Kumar', 'Rao', 'Reddy', 'Sharma', 'Naidu', 'Sastry', 'Chowdary', 'Verma'];
    const randomDentals = ['Scaling', 'Consultation', 'Braces Check', 'Implant Healing', 'Extraction Review'];
    const consultants = [
      { name: 'Dr. Sri Chaitanya MDS', cab: 'Consulting Cabin 1' },
      { name: 'Dr. K. Srilatha BDS', cab: 'Cabin 2 (Kids)' }
    ];

    const fName = randomFirstNames[Math.floor(Math.random() * randomFirstNames.length)];
    const lName = randomLastNames[Math.floor(Math.random() * randomLastNames.length)];
    const fullName = `${fName} ${lName}`;
    const procedure = randomDentals[Math.floor(Math.random() * randomDentals.length)];
    const doctorObj = consultants[Math.floor(Math.random() * consultants.length)];

    // Derive next Token number safely
    let maxTokenNum = 7;
    // Check Now serving
    const curServingNum = parseInt(nowServing.token.replace(/\D/g, '')) || 0;
    // Check upcoming
    const numbers = upcomingQueue.map(q => parseInt(q.token.replace(/\D/g, '')) || 0);
    if (numbers.length > 0) {
      maxTokenNum = Math.max(...numbers, curServingNum);
    } else {
      maxTokenNum = Math.max(7, curServingNum);
    }
    const nextToken = `T${String(maxTokenNum + 1).padStart(2, '0')}`;

    const newWalkingItem: QueueItem = {
      token: nextToken,
      name: fullName,
      doctor: doctorObj.name,
      department: procedure,
      room: doctorObj.cab,
      waitTime: `${(upcomingQueue.length + 1) * 12} Mins`,
      status: 'Waiting'
    };

    setUpcomingQueue([...upcomingQueue, newWalkingItem]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-mono p-4 md:p-6 flex flex-col justify-between">
      
      {/* MONITORS TV SHELL */}
      <div className="max-w-6xl mx-auto w-full bg-slate-950 rounded-3xl border-4 border-slate-800 shadow-2xl p-5 md:p-8 space-y-6 relative overflow-hidden flex-1 flex flex-col justify-between">
        
        {/* Dynamic decorative radar scan scan-lines */}
        <div className="absolute inset-0 bg-radial-gradient from-teal-500/10 via-transparent pointer-events-none opacity-40" />

        {/* TOP BAR / METADATA HEADER */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b-2 border-slate-800 pb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-teal-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-teal-500/10 animate-pulse">
              🦷
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider font-sans leading-none flex items-center gap-1">
                Sri Chaitanya Dental Care
              </h2>
              <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mt-1">Lobby Digital Queuing Display Screen</p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 font-sans">
            <div className="text-right">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full text-xs font-bold font-mono tracking-widest">
                Lobby TV Terminal #1
              </span>
              <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-widest font-mono flex items-center gap-1.5 justify-end">
                Status: Connected Live
                {autoRefresh && (
                  <span className="text-teal-400 font-bold animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
                    (Auto-refresh Active)
                  </span>
                )}
              </p>
            </div>
            <div className="bg-slate-900 border-2 border-slate-800 px-4 py-1.5 rounded-2xl font-mono shrink-0">
              <span className="text-teal-450 font-black text-sm tracking-widest">{time}</span>
            </div>
          </div>
        </div>

        {/* NOW SERVING GIANT FLASHING LCD CONTAINER */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10 my-4 flex-1">
          
          {/* NOW SERVING CARD (Left 3 cols) */}
          <div className="bg-gradient-to-br from-teal-950/80 to-slate-950 rounded-3xl border-2 border-teal-500/40 p-6 flex flex-col justify-between shadow-2xl shadow-teal-500/5 md:col-span-3 min-h-[300px]">
            <div>
              <div className="flex items-center justify-between border-b border-teal-500/20 pb-3">
                <span className="text-xs uppercase font-extrabold tracking-widest text-teal-400 font-sans flex items-center gap-1.5 animate-pulse">
                  <span className="w-2.5 h-2.5 bg-teal-500 rounded-full inline-block" /> Now Serving / అపాయింట్‌మెంట్ నెంబర్
                </span>
                <span className="px-2.5 py-0.5 bg-teal-400 text-teal-950 font-black text-[9px] uppercase tracking-wider rounded">
                  {nowServing.room}
                </span>
              </div>

              <div className="py-6 flex flex-col sm:flex-row items-center sm:justify-start gap-6">
                {/* Titan digital token digits */}
                <div className="w-24 h-24 bg-teal-500/10 border-2 border-teal-400 rounded-2xl flex items-center justify-center text-4xl font-black text-teal-350 tracking-tight font-mono shrink-0 shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-scanline pointer-events-none opacity-20" />
                  {nowServing.token}
                </div>

                <div className="space-y-1.5 text-center sm:text-left min-w-0">
                  <p className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest">Patient Name</p>
                  <h3 className="text-2xl font-black tracking-tight text-white uppercase truncate">{nowServing.name}</h3>
                  <p className="text-xs text-slate-300 font-sans font-bold flex items-center justify-center sm:justify-start gap-1">
                    <HeartPulse size={12} className="text-teal-400 shrink-0" /> Department: {nowServing.department}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-teal-500/20 pt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs font-sans">
              <div className="flex items-center gap-1.5">
                <Volume2 size={15} className="text-teal-400 shrink-0 animate-bounce" />
                <span className="text-slate-400 font-mono font-medium text-[11px]">Assigned Doctor: <strong className="text-teal-300">{nowServing.doctor}</strong></span>
              </div>
              <button
                onClick={triggerReannouncement}
                className="bg-teal-500 hover:bg-teal-600 text-teal-950 font-black text-[10px] py-1 px-3 rounded-lg flex items-center gap-1 cursor-pointer tracking-wider"
              >
                <Megaphone size={11} /> Call Token Audio
              </button>
            </div>
          </div>

          {/* ACTIVE CLINICIANS ROOMS ROSTER (Right 2 cols) */}
          <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 space-y-4 md:col-span-2 shadow-inner">
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-slate-400 font-sans border-b border-slate-800 pb-2 flex items-center gap-1">
              🏢 Clinical Cabins Status
            </h4>

            <div className="space-y-3 font-sans">
              {[
                { name: 'Dr. Sri Chaitanya MDS', role: 'Chief Prosthodontist', cab: 'Consulting Cabin 1', status: 'Active (T04 Ready)', pulseBg: 'bg-emerald-500/20 text-emerald-450 border-emerald-500/30' },
                { name: 'Dr. K. Srilatha BDS', role: 'Pediatric Consultant', cab: 'Cabin 2 (Kids Room)', status: 'Active (T05 Waiting)', pulseBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' }
              ].map((cab, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1.5 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-[12px] text-white tracking-tight">{cab.name}</p>
                      <p className="text-[10px] text-slate-500">{cab.role}</p>
                    </div>
                    <span className="font-mono text-[9px] bg-slate-805 text-slate-400 px-2 py-0.5 rounded border border-slate-750">
                      {cab.cab}
                    </span>
                  </div>
                  <div className={`px-2.5 py-0.5 rounded-lg border text-[9.5px] font-bold text-center ${cab.pulseBg}`}>
                    ★ {cab.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* UPCOMING WAITING QUEUE TABLE PANEL */}
        <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 relative z-10 flex-1 flex flex-col justify-between">
          <div className="space-y-3.5 flex-1">
            <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
              <h3 className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5 font-sans">
                <Clock size={14} className="text-teal-400" /> Upcoming Hospital wait Queue
              </h3>
              <span className="bg-indigo-550 text-indigo-100 font-mono font-bold text-[9px] border border-slate-700 px-2.5 py-0.5 rounded-full uppercase">
                {upcomingQueue.length} Patients in wait list
              </span>
            </div>

            {upcomingQueue.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic">
                Wait lobby queue is completely empty. Accept new appointments in CRM.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 font-mono tracking-widest">
                      <th className="pb-2">Token</th>
                      <th className="pb-2">Patient</th>
                      <th className="pb-2">Department / Slot</th>
                      <th className="pb-2">Assigned Consulting Doctor</th>
                      <th className="pb-2 text-right">Est. Wait</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300 font-medium font-mono text-[11px]">
                    {upcomingQueue.map((q, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="py-2.5 font-bold text-teal-450">{q.token}</td>
                        <td className="py-2.5 font-sans font-extrabold text-white">{q.name}</td>
                        <td className="py-2.5 font-sans text-[10.5px]">{q.department}</td>
                        <td className="py-2.5 font-sans text-slate-400 pr-2">{q.doctor}</td>
                        <td className="py-2.5 text-right text-amber-450 font-bold">{q.waitTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ADMIN CO-ORDINATOR QUEUE MANAGEMENT SIMULATOR (Footer action panel) */}
      <div className="max-w-6xl mx-auto w-full pt-4 rounded-b-2xl">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1 text-center md:text-left">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-500/20 text-teal-350 border border-teal-500/30 rounded text-[9px] font-bold font-mono uppercase tracking-widest">
              Clinic Coordinator Operations Deck
            </span>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">
              Use this simulation panel to advance lobby token cards, trigger dual-tone dental chimes, and request new OTP registration walk-ins dynamically.
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0 flex-wrap justify-center font-sans">
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-450 font-bold font-mono tracking-widest uppercase">Lobby TTS</label>
              <input
                type="checkbox"
                checked={isVoiceActive}
                onChange={(e) => setIsVoiceActive(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border bg-transparent text-teal-500 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <label htmlFor="auto-refresh-toggle" className="text-[10px] text-slate-450 font-bold font-mono tracking-widest uppercase cursor-pointer">Auto-Refresh</label>
              <input
                id="auto-refresh-toggle"
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border bg-transparent text-teal-500 focus:ring-0 cursor-pointer text-teal-500"
              />
            </div>

            <button
              onClick={registerMockWalkIn}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border text-slate-300 hover:text-white font-bold text-xs uppercase rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} /> Register Walk-In
            </button>

            <button
              onClick={advanceQueueNext}
              disabled={upcomingQueue.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-teal-550/10 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Tv size={12} fill="white" /> Turn Next Patient (Chime & TTS)
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
