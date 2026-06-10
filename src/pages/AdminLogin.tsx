import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { login } from '../lib/auth';
import { ShieldCheck, User, Lock } from 'lucide-react';

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
    const user = await login(email, password);
    if (user) {
      setLocation('/crm/dashboard');
    } else {
      setError('Invalid email or password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-4xl shadow-2xl mb-5 ring-4 ring-teal-500/20">
            🦷
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sri Chaitanya Dental Care</h1>
          <p className="text-teal-300 text-sm mt-1 font-medium">Staff Administration Portal</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck size={18} className="text-teal-400" />
            <h2 className="text-base font-semibold text-white">Secure Sign In</h2>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/50 transition"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/50 transition"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold text-sm shadow-lg shadow-teal-500/25 transition mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
              ) : 'Sign In to CRM'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/" className="text-xs text-slate-500 hover:text-teal-400 transition">
              ← Back to Website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
