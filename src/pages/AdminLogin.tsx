import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { login } from '../lib/auth';
import { 
  ShieldCheck, Mail, Lock, ArrowRight, Eye, EyeOff,
  Calendar, TrendingUp, Users, RefreshCw, Landmark,
  Bell, CheckCircle2, DollarSign, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DentalLogo from '../components/DentalLogo';
import regeneratedLoginHero from '../assets/images/regenerated_image_1782226281979.png';
import regeneratedLoginLeft from '../assets/images/regenerated_image_1782221975741.jpg';

// Lightweight, performant CountUp component using requestAnimationFrame
function CountUp({ value, duration = 1500, prefix = "", suffix = "" }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = 0;
    let animationFrameId: number;

    const updateCount = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * (value - startValue) + startValue));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [notifIndex, setNotifIndex] = useState(0);

  const liveNotifications = [
    { id: 1, title: 'Appointment Scheduled', desc: 'Anusha P. (Root Canal) for tomorrow at 10:00 AM', time: 'Just now', badgeColor: 'bg-teal-500' },
    { id: 2, title: 'Payment Received', desc: '₹8,500 successfully processed from Bala Krishna', time: '1 min ago', badgeColor: 'bg-emerald-500' },
    { id: 3, title: 'Follow-Up Created', desc: 'Recall checkup scheduled for Ramya M. (Veneers)', time: '2 mins ago', badgeColor: 'bg-blue-500' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifIndex((prev) => (prev + 1) % liveNotifications.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      if (user) {
        setLocation('/crm/dashboard');
      } else {
        setError('Invalid username/email or password');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Access Denied: Authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div id="login-layout-root" className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col justify-between lg:grid lg:grid-cols-12 overflow-x-hidden">
      
      {/* LEFT COLUMN: Premium Administrative Login Panel */}
      <div id="login-form-container-col" className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-screen bg-white">
        
        {/* Header Branding Row */}
        <div className="flex items-center justify-between">
          <DentalLogo />
          <a href="/" className="text-xs font-bold text-slate-500 hover:text-slate-800 transition">
            ← Main Site
          </a>
        </div>

        {/* Center alignment of the actual card */}
        <div className="w-full max-w-md mx-auto my-auto py-10">
          
          {/* Welcome Text block */}
          <div className="mb-8 text-left">
            <h2 className="text-[32px] font-black text-[#0B1527] tracking-tight mb-2 font-sans">
              Welcome back
            </h2>
            <p className="text-[15px] text-[#556987] font-medium leading-relaxed font-sans">
              Sign in to access your CRM dashboard and manage patient care.
            </p>
          </div>

          {/* TABLET / MOBILE ONLY ILLUSTRATION PANEL (above card) */}
          <div className="lg:hidden w-full flex flex-col items-center justify-center py-6 mb-8">
            <div className="w-48 max-w-full bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 transition-all duration-300">
              <img 
                src={regeneratedLoginLeft} 
                alt="Sri Chaitanya Dental Care Logo" 
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain rounded-xl mx-auto align-middle"
              />
            </div>
          </div>

          {/* MAIN ADMINISTRATIVE SECURE CARD */}
          <div className="bg-white">
            
            {/* Error notifications */}
            {error && (
              <div id="login-error-toast" className="mb-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs text-center font-bold">
                {error}
              </div>
            )}

            {/* PASSWORD STANDARD METHOD */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-[#4B5E7B] mb-2 uppercase tracking-wider font-sans">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="login-email-input"
                    placeholder="doctor@srichaitanya.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-[#111827] placeholder:text-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#4B5E7B] mb-2 uppercase tracking-wider font-sans">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="w-full h-12 pl-11 pr-11 rounded-xl border border-slate-200 bg-white text-[#111827] placeholder:text-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition focus:outline-none"
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password Row */}
              <div className="flex items-center justify-between text-[13px] font-semibold text-[#4B5E7B] font-sans pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-slate-700 select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 focus:outline-none cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
                <a href="/reset-password" className="text-blue-600 hover:text-blue-800 transition">
                  Forgot password?
                </a>
              </div>

              <motion.button
                type="submit"
                id="login-submit-button"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full h-12 rounded-xl bg-[#2049C2] hover:bg-[#1A3BA1] text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer mt-4"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight size={16} className="ml-1" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Continuing Separator Divider */}
            <div className="relative my-7 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative px-3 bg-white text-[11px] font-black text-slate-400 uppercase tracking-widest font-sans">
                OR CONTINUE WITH
              </span>
            </div>

            {/* Social Oauth Buttons */}
            <div className="grid grid-cols-2 gap-3.5 mb-2">
              <button
                type="button"
                onClick={() => alert("Google SSO Integration is securely mapped inside Firebase Console metadata.")}
                className="flex items-center justify-center gap-2.5 h-12 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition duration-150 cursor-pointer shadow-sm"
              >
                {/* Embedded Multi-colored Google G Icon */}
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.66l3.15-3.15C17.45 1.71 14.93 1 12 1 7.35 1 3.37 3.68 1.48 7.57l3.7 2.87C6.07 7.42 8.78 5.04 12 5.04z"/>
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.43c-.28 1.44-1.09 2.67-2.32 3.5l3.58 2.78c2.1-1.94 3.3-4.79 3.3-8.44z"/>
                  <path fill="#FBBC05" d="M5.18 10.44c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.48 3.01C.53 4.9.01 7.03.01 9.27s.52 4.37 1.47 6.26l3.7-2.87c-.24-.72-.38-1.49-.38-2.22z"/>
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.58-2.78c-1 .67-2.28 1.07-3.79 1.07-3.22 0-5.93-2.38-6.9-5.41l-3.7 2.87C3.37 20.32 7.35 23 12 23z"/>
                </svg>
                <span>Google</span>
              </button>
              <button
                type="button"
                onClick={() => alert("Microsoft Active Directory configuration requires tenant credential settings (HIPAA domain keys).")}
                className="flex items-center justify-center gap-2.5 h-12 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition duration-150 cursor-pointer shadow-sm"
              >
                {/* Embedded Microsoft four squares emblem */}
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 23 23">
                  <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022"/>
                  <rect x="11.5" y="0" width="10.5" height="10.5" fill="#7FBA00"/>
                  <rect x="0" y="11.5" width="10.5" height="10.5" fill="#00A1F1"/>
                  <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#FFB900"/>
                </svg>
                <span>Microsoft</span>
              </button>
            </div>

          </div>
        </div>

        {/* Footer legal attribution statement */}
        <div className="text-center w-full pt-6 border-t border-slate-100 font-sans">
          <p className="text-[12px] text-slate-400 font-medium tracking-wide mb-1 select-none">
            Protected by enterprise-grade encryption.
          </p>
          <p className="text-[12px] text-slate-400 font-medium tracking-wide select-none">
            © 2024 Sri Chaitanya Dental Care. All rights reserved.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Premium SaaS interactive space with official clinic logo */}
      <div id="login-hero-container-col" className="hidden lg:flex lg:col-span-7 bg-gradient-to-br from-[#0B132B] via-[#112240] to-[#0B132B] relative flex-col justify-center items-center p-8 text-white min-h-screen overflow-hidden">
        
        {/* Deep tech ambient background glows */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.12)_0%,transparent_65%)] opacity-80 pointer-events-none" />
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-teal-500/10 blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

        {/* Live system top ribbons */}
        <div className="absolute top-6 left-8 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span className="text-[10px] font-mono tracking-widest text-teal-400 font-bold uppercase">CRM SYSTEM ACTIVE</span>
        </div>
        <div className="absolute top-6 right-8">
          <span className="text-[10px] font-mono tracking-widest text-slate-400 font-bold">CORE MS v4.0</span>
        </div>

        {/* Interactive Workspace Layout */}
        <div className="w-full max-w-5xl grid grid-cols-12 gap-5 items-center z-10 relative">

          {/* LEFT PANEL: Widgets */}
          <div className="col-span-4 flex flex-col gap-5">
            
            {/* WIDGET 1: Today's Appointments */}
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2 text-teal-400">
                  <Calendar size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Today's Schedule</span>
                </div>
                <span className="text-[10px] font-mono bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full font-bold">
                  3 Pending
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-lg">
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-200">Bala Krishna</span>
                    <span className="text-[10px] text-slate-400 font-mono">Smile Makeover</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] block font-mono text-slate-300">09:30 AM</span>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold">Done</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-teal-500/10 border border-teal-500/20 p-2 rounded-lg">
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-white">Anusha P</span>
                    <span className="text-[10px] text-teal-300 font-mono">Root Canal Treatment</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] block font-mono text-teal-300 font-bold">11:15 AM</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold animate-pulse">Active</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-lg">
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-200">Pindra Lalitha</span>
                    <span className="text-[10px] text-slate-400 font-mono">Pediatric Checkup</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] block font-mono text-slate-300">02:30 PM</span>
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold">Pending</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* WIDGET 4: Follow-Up Queue */}
            <motion.div
              animate={{ y: [4, -4, 4] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2 text-sky-400">
                  <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '10s' }} />
                  <span className="text-xs font-bold uppercase tracking-wider">Follow-Up Queue</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Recall Engine</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="text-left">
                    <p className="font-bold text-slate-200">Murali Krishna</p>
                    <p className="text-[10px] text-slate-400">Implants Review</p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded font-bold">Due Today</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="text-left">
                    <p className="font-bold text-slate-200">Ramya M</p>
                    <p className="text-[10px] text-slate-400">Teeth Whitening Check</p>
                  </div>
                  <span className="text-[10px] font-mono text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded font-bold">In 2 days</span>
                </div>
              </div>
            </motion.div>

          </div>

          {/* CENTER PANEL: Realistic Rotating 3D Tooth Model & Centered Logo Pedestal */}
          <div className="col-span-4 flex flex-col items-center justify-center">
            
            {/* Rotating 3D Tooth Model Container */}
            <motion.div
              animate={{ 
                rotateY: [0, 360],
                y: [-8, 8, -8]
              }}
              transition={{ 
                rotateY: { duration: 18, repeat: Infinity, ease: "linear" },
                y: { duration: 5, repeat: Infinity, ease: "easeInOut" }
              }}
              style={{ perspective: 1200, transformStyle: "preserve-3d" }}
              className="relative w-36 h-36 flex items-center justify-center filter drop-shadow-[0_15px_35px_rgba(20,184,166,0.35)]"
            >
              <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-teal-400/30 bg-gradient-to-b from-[#64b5f6] to-[#2196f3] shadow-[0_15px_35px_rgba(33,150,243,0.4)] flex items-center justify-center p-1">
                <img 
                  src="https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=300&h=300&q=80" 
                  alt="Realistic Dental Tooth Model" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-full select-none pointer-events-none scale-110"
                />
              </div>
            </motion.div>

            {/* Pedestal Card with Centered Logo (Required: Keep clinic logo centered) */}
            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              className="mt-6 w-full max-w-[280px] bg-white p-5 rounded-2xl shadow-2xl border border-white/10 flex flex-col items-center justify-center text-center transition duration-300 relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-tr from-teal-500 to-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300" />
              <img 
                src={regeneratedLoginHero} 
                alt="Sri Chaitanya Dental Care Official Branding Logo" 
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain rounded-lg mx-auto relative z-10"
              />
            </motion.div>

            {/* Branded name and motto under pedestal */}
            <div className="text-center mt-5 space-y-1">
              <h3 className="text-md font-black tracking-wider text-white leading-tight uppercase font-sans">
                SRI CHAITANYA
              </h3>
              <p className="text-[11px] tracking-widest text-teal-400 font-black uppercase font-sans">
                MULTISPECIALITY DENTAL CARE
              </p>
              <div className="inline-block bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full text-[10px] text-teal-300 font-extrabold italic mt-2">
                "We Care Your Smile"
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: Widgets */}
          <div className="col-span-4 flex flex-col gap-5">
            
            {/* WIDGET 2: Revenue Collection & Animated Line Chart */}
            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.25 }}
              className="bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400">
                  <TrendingUp size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Revenue Analytics</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-extrabold">
                  +18.4%
                </span>
              </div>
              
              <div className="mt-2 text-left">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Collection Today</p>
                <h4 className="text-2xl font-black tracking-tight text-white mt-0.5">
                  <CountUp value={148500} prefix="₹" />
                </h4>
              </div>

              {/* High Quality Real-time Animated Revenue Path */}
              <div className="relative mt-2 h-16 w-full">
                <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="revenueGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Fill Area beneath line */}
                  <path
                    d="M 5 95 L 5 70 L 35 55 L 70 70 L 105 30 L 140 45 L 170 15 L 195 5 L 195 95 Z"
                    fill="url(#revenueGlow)"
                  />
                  
                  {/* The stroke path */}
                  <motion.path
                    d="M 5 70 L 35 55 L 70 70 L 105 30 L 140 45 L 170 15 L 195 5"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                  />
                  
                  {/* Pulsating cursor indicator at latest data node */}
                  <motion.circle
                    cx="195"
                    cy="5"
                    r="4"
                    fill="#10B981"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    animate={{ scale: [1, 1.6, 1] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* WIDGET 3: Patient Statistics */}
            <motion.div
              animate={{ y: [4, -4, 4] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
              className="bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sky-400">
                  <Users size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Patient Base</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-slate-300 uppercase font-bold">LIVE METRICS</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-white/5 p-2 rounded-xl text-left">
                  <span className="text-[9px] block text-slate-400 font-bold uppercase tracking-wider">Active</span>
                  <span className="text-lg font-black text-white">
                    <CountUp value={1248} />
                  </span>
                </div>
                <div className="bg-white/5 p-2 rounded-xl text-left">
                  <span className="text-[9px] block text-slate-400 font-bold uppercase tracking-wider">Satisfaction</span>
                  <span className="text-lg font-black text-emerald-400">
                    <CountUp value={98} suffix="%" />
                  </span>
                </div>
              </div>
            </motion.div>

            {/* WIDGET 5: Billing Analytics */}
            <motion.div
              animate={{ y: [-3, 3, -3] }}
              transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="bg-slate-900/40 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Landmark size={15} />
                  <span className="text-xs font-bold uppercase tracking-wider">Billing Success</span>
                </div>
                <span className="text-[9px] font-mono text-slate-400 font-bold">AUTOMATED</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-white/5 p-2.5 rounded-xl">
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Invoice Clearance</p>
                  <p className="text-sm font-black text-white">98.4% Paid</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Outstanding</p>
                  <p className="text-xs text-amber-300 font-extrabold">₹12,400</p>
                </div>
              </div>
            </motion.div>

          </div>

        </div>

        {/* LIVE NOTIFICATION TOASTER (Requirements: Add live notification popups with beautiful slide-in transition) */}
        <div className="absolute bottom-6 right-8 w-80 z-20 overflow-hidden pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={notifIndex}
              initial={{ opacity: 0, x: 80, y: 15 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -80, y: -15 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="bg-slate-900/80 border border-teal-500/30 backdrop-blur-lg p-3.5 rounded-xl shadow-2xl flex items-start gap-3 text-left w-full pointer-events-auto"
            >
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-teal-500/15 text-teal-400`}>
                <Bell size={15} className="animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <h5 className="text-[11px] font-black uppercase text-teal-300 tracking-wider">
                    {liveNotifications[notifIndex].title}
                  </h5>
                  <span className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
                    {liveNotifications[notifIndex].time}
                  </span>
                </div>
                <p className="text-xs text-slate-200 mt-1 font-medium leading-relaxed">
                  {liveNotifications[notifIndex].desc}
                </p>
              </div>
              <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
