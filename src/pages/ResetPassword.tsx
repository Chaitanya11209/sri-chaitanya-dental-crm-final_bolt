import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { KeyRound, Mail, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // States
  const [mode, setMode] = useState<'request' | 'update'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Detect if user has a recovery token session
  useEffect(() => {
    const checkRecoverySession = async () => {
      if (!isSupabaseConfigured) {
        // In local sandbox, if they clicked reset link or want to set password, let them choose
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          // If a session already exists (e.g., they clicked the recovery link), switch to update mode directly
          setMode('update');
        }
      } catch (err) {
        console.warn('Session verification exception:', err);
      }
    };
    checkRecoverySession();
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const processedEmail = email.toLowerCase().trim();
      
      if (!isSupabaseConfigured) {
        // Sandbox mock flow
        setSuccess(`Demo recovery link generated for ${email}! Click below to immediately update the sandbox password.`);
        setMode('update');
        setLoading(false);
        return;
      }

      // Supabase OAuth/Auth password reset
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(processedEmail, {
        redirectTo: window.location.origin + '/reset-password',
      });

      if (resetError) throw resetError;

      setSuccess(`A secure password recovery email has been sent to ${processedEmail}. Please click the link inside to set a new password.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch password recovery request. Please verify email spelling.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your passwords.');
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        // Mock Sandbox update - store under localStorage for the specified email
        const targetEmail = email.trim() || 'demo@srichaitanya.local';
        const formattedEmail = targetEmail.includes('@') ? targetEmail.toLowerCase() : `${targetEmail.toLowerCase()}@srichaitanya.local`;
        
        localStorage.setItem(`sandbox_password_${formattedEmail}`, password);
        setSuccess('Sandbox account password updated successfully! You can now log in using your new credentials.');
        
        setTimeout(() => {
          setLocation('/admin');
        }, 2000);
        return;
      }

      // Supabase Auth update
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess('Your CRM account password has been updated successfully! Redirecting you to sign-in...');
      setTimeout(() => {
        setLocation('/admin');
      }, 2500);
    } catch (err: any) {
      setError(err?.message || 'Access Denied: Password update failed. Make sure your recovery link has not expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-4xl shadow-2xl mb-5 ring-4 ring-teal-500/20">
            🔑
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sri Chaitanya Dental Care</h1>
          <p className="text-teal-300 text-sm mt-1 font-medium">CRM Access Security & Recovery</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <KeyRound size={18} className="text-teal-400" />
            <h2 className="text-base font-semibold text-white">
              {mode === 'request' ? 'Request Password Recovery' : 'Create New Password'}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-teal-400" />
              <span>{success}</span>
            </div>
          )}

          {mode === 'request' ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p className="text-slate-300 text-xs leading-relaxed mb-1">
                Enter your registered staff email or username below. We'll dispatch a secure link to reset your account password.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Email Address or Username
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input
                    type="text"
                    placeholder="e.g. receptionist@srichaitanya.local"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-550 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Sending Recovery Link...' : 'Dispatch Reset Email'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {!isSupabaseConfigured && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-350 text-[11px]">
                  <strong>Sandbox Admin Hint:</strong> Type the email/username you are resetting for below to link custom passwords:
                  <input
                    type="text"
                    placeholder="demo@srichaitanya.local"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="mt-2 w-full h-8 px-2 rounded bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none"
                  />
                </div>
              )}
              <p className="text-slate-350 text-xs leading-relaxed mb-2">
                Choose a strong, unique authentication password to secure your CRM workspace account.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-550 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input
                    type="password"
                    placeholder="Verify password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-550 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Updating Credentials...' : 'Set New Secure Password'}
              </button>
            </form>
          )}

          <div className="mt-5 text-center flex items-center justify-between border-t border-white/5 pt-4">
            <a href="/admin" className="text-xs text-slate-405 hover:text-teal-400 transition">
              ← Return to Login
            </a>
            {mode === 'request' && !isSupabaseConfigured && (
              <button 
                type="button" 
                onClick={() => setMode('update')} 
                className="text-xs text-teal-400 hover:underline cursor-pointer"
              >
                Direct Demo Reset →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
