import { useState } from 'react';
import { useLocation } from 'wouter';
import { login } from '../lib/auth';
import { ShieldCheck, User, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import DentalLogo from '../components/DentalLogo';

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div id="login-layout-root" className="min-h-screen bg-[#F3F4F6] font-sans flex flex-col justify-between lg:grid lg:grid-cols-12 overflow-x-hidden">
      
      {/* LEFT COLUMN: Premium Administrative Login Panel */}
      <div id="login-form-container-col" className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-screen bg-white">
        
        {/* Header Branding Row */}
        <DentalLogo />

        {/* Center alignment of the actual card */}
        <div className="w-full max-w-sm mx-auto my-auto py-8">
          
          {/* Welcome Text block */}
          <div className="mb-6 text-left">
            <h2 className="text-2xl font-black text-[#111827] tracking-tight mb-2 font-sans">
              Welcome Back
            </h2>
            <p className="text-xs text-[#6B7280] font-semibold leading-relaxed font-sans">
              Sign in to secure your clinic management workspace. Enter your registered practitioner or administrative credentials.
            </p>
          </div>

          {/* TABLET / MOBILE ONLY ILLUSTRATION PANEL (above card) */}
          <div className="lg:hidden w-full flex flex-col items-center justify-center py-6 mb-6">
            <div className="w-56 max-w-full bg-white p-5 rounded-[24px] shadow-md border border-slate-100 transition-all duration-300 hover:shadow-lg">
              <img 
                src="/clinic_logo.svg" 
                alt="Sri Chaitanya Dental Care Logo" 
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain rounded-xl"
              />
            </div>
            <div className="text-center mt-4">
              <p className="text-sm font-black tracking-wide uppercase text-slate-800 font-sans">
                Sri Chaitanya Dental Care
              </p>
              <p className="text-[11px] text-slate-500 font-bold max-w-xs mt-1.5 font-sans">
                Appointments • Patients • Billing • Prescriptions • Dental Charting
              </p>
            </div>
          </div>

          {/* MAIN ADMINISTRATIVE SECURE CARD */}
          <div className="bg-white rounded-[16px] shadow-sm border border-slate-100 p-6 md:p-8">
            
            <div className="flex items-center gap-2 mb-4 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100/50">
              <ShieldCheck size={14} className="text-[#2F63E0]" />
              <span className="text-[10px] font-black text-[#111827] uppercase tracking-wider font-sans">
                HIPAA Secure Production Login
              </span>
            </div>

            {/* Error notifications */}
            {error && (
              <div id="login-error-toast" className="mb-4 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs text-center font-bold">
                {error}
              </div>
            )}

            {/* PASSWORD STANDARD METHOD */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-[#6B7280] mb-1.5 uppercase tracking-wider font-sans">
                  Email Address or Username
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input
                    type="text"
                    id="login-email-input"
                    placeholder="Enter email or username"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-[#111827] placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-[#2F63E0]/15 focus:border-[#2F63E0] transition font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#6B7280] mb-1.5 uppercase tracking-wider font-sans">
                  Password
                </label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input
                    type="password"
                    id="login-password-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-[#111827] placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-[#2F63E0]/15 focus:border-[#2F63E0] transition font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                id="login-submit-button"
                disabled={loading}
                whileHover={{ y: -1 }}
                whileTap={{ y: 0 }}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#2F63E0] to-[#2554CC] hover:to-[#2F63E0] text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/10 transition mt-2 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Authenticate Practitioner</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Lower panel navigation handles */}
            <div className="mt-6 text-center flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold font-sans">
              <a href="/" className="text-[#6B7280] hover:text-[#2F63E0] transition flex items-center gap-1">
                ← Back to Home
              </a>
              <a href="/reset-password" className="text-[#2F63E0] hover:text-[#2554CC] tracking-wide transition">
                Forgot Password?
              </a>
            </div>

          </div>
        </div>

        {/* Footer legal attribution statement */}
        <div className="text-center lg:text-left text-[10px] text-[#6B7280] font-sans font-bold uppercase tracking-wider">
          © {new Date().getFullYear()} Sri Chaitanya Dental Care • HIPAA Secure Administrative Portal.
        </div>
      </div>

      {/* RIGHT COLUMN: Premium SaaS interactive space with official clinic logo */}
      <div id="login-hero-container-col" className="hidden lg:flex lg:col-span-7 bg-gradient-to-br from-[#2F63E0] to-[#8757EA] relative flex-col justify-center items-center p-12 text-white min-h-screen overflow-hidden">
        
        {/* Soft background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,transparent_80%)] opacity-80" />
        <div className="absolute top-24 left-24 w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-24 right-24 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        {/* Premium glassmorphism card container */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full max-w-lg bg-white/10 backdrop-blur-md border border-white/10 rounded-[24px] p-10 flex flex-col items-center justify-center relative shadow-2xl transition-all duration-300 hover:shadow-black/25 hover:border-white/20"
        >
          {/* Header Secure Tags */}
          <div className="absolute top-6 left-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#14B874]" />
            <span className="text-[9px] font-mono tracking-widest opacity-75 text-emerald-300 uppercase">SYS_SECURE</span>
          </div>
          <div className="absolute top-6 right-6">
            <span className="text-[9px] font-mono tracking-widest opacity-75 text-sky-200">CLINICAL CORE MS v3.0</span>
          </div>

          {/* Main Hero Visual (Official branding image) */}
          <div className="w-full max-w-[280px] my-4 flex items-center justify-center bg-white p-4 rounded-[20px] shadow-lg border border-white/5 transition duration-300">
            <img 
              src="/clinic_logo.svg" 
              alt="Sri Chaitanya Dental Care Official Branding Logo" 
              referrerPolicy="no-referrer"
              className="w-full h-auto object-contain rounded-lg"
            />
          </div>

          {/* Branded Text Below Image */}
          <div className="text-center mt-6 space-y-4 max-w-sm">
            <div>
              <h3 className="text-2xl font-black tracking-tight text-white leading-tight font-sans">
                Sri Chaitanya Dental Care
              </h3>
              <p className="text-[11px] text-cyan-300 font-extrabold uppercase tracking-widest mt-2 font-sans">
                Premium Dental Clinic Management System
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-1.5 pt-3 font-sans">
              {['Appointments', 'Patients', 'Billing', 'Prescriptions', 'Dental Charting'].map((item) => (
                <span 
                  key={item} 
                  className="text-[10px] bg-white/15 hover:bg-white/25 transition backdrop-blur-md text-white font-extrabold px-3 py-1.5 rounded-full border border-white/10 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

        </motion.div>

      </div>

    </div>
  );
}
