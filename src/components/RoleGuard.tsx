import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logout } from '../lib/auth';
import { Shield, Loader2, LogOut, ArrowLeft } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
}

export default function RoleGuard({ children }: RoleGuardProps) {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function checkRole() {
      try {
        if (!isSupabaseConfigured) {
          const authMode = localStorage.getItem('crmAuthMode');
          if (authMode === 'dev') {
            if (active) {
              setAuthorized(true);
              setChecking(false);
            }
            return;
          }
          
          if (active) {
            setAuthorized(false);
            setErrorMessage('Database Connection Error: Supabase is not configured. Please wire up your credentials in AI Studio App Settings or select Offline Sandbox Mode on the Login screen.');
            setChecking(false);
          }
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session || !session.user) {
          if (active) {
            setAuthorized(false);
            setErrorMessage('Access Denied: You must be logged in to view Sri Chaitanya Dental CRM.');
            setChecking(false);
          }
          return;
        }

        const user = session.user;

        // Strictly query 'staff_roles' table
        let { data: staffRole, error: roleError } = await supabase
          .from('staff_roles')
          .select('role, status, name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError && (roleError.message?.includes('status') || roleError.code === '42703')) {
          const { data: fallbackRole, error: fallbackError } = await supabase
            .from('staff_roles')
            .select('role, name')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!fallbackError && fallbackRole) {
            staffRole = { ...fallbackRole, status: 'Active' };
            roleError = null;
          }
        }

        if (roleError || !staffRole) {
          console.warn('RoleGuard: No validation entry in staff_roles for user', user.id);
          if (active) {
            // Instantly wipe local storage credentials and session cache
            localStorage.clear();
            await supabase.auth.signOut().catch(() => {});
            setAuthorized(false);
            setErrorMessage('Access Denied: Your account exists in authentication, but does not have a assigned record in the system database (staff_roles). Please contact your administrator.');
            setChecking(false);
          }
          return;
        }

        if (staffRole.status === 'Inactive') {
          console.warn('RoleGuard: Account is marked Inactive for user', user.id);
          if (active) {
            localStorage.clear();
            await supabase.auth.signOut().catch(() => {});
            setAuthorized(false);
            setErrorMessage('Access Denied: Your staff account has been deactivated. Please contact your administrator.');
            setChecking(false);
          }
          return;
        }

        // Validate role matches one of our permitted application role tags
        const validRoles = ['admin', 'doctor', 'receptionist', 'assistant', 'staff'];
        const isRoleValid = staffRole.role && validRoles.includes(staffRole.role.toLowerCase());

        if (!isRoleValid) {
          console.warn('RoleGuard: Unrecognized role tag:', staffRole.role);
          if (active) {
            localStorage.clear();
            await supabase.auth.signOut().catch(() => {});
            setAuthorized(false);
            setErrorMessage(`Access Denied: Unrecognized permission role "${staffRole.role}". Please register with standard staff credentials.`);
            setChecking(false);
          }
          return;
        }

        if (active) {
          setAuthorized(true);
          setChecking(false);
        }
      } catch (err) {
        console.error('RoleGuard Exception encountered during security audit:', err);
        if (active) {
          setAuthorized(false);
          setErrorMessage('Access Denied: An unexpected exception occurred during role validation.');
          setChecking(false);
        }
      }
    }

    checkRole();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    localStorage.clear();
    await logout().catch(() => {});
    setLocation('/admin');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">Performing Role Audit...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-500 mb-6 animate-pulse">
          <Shield size={32} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2 font-sans tracking-tight">Access Denied</h1>
        <p className="text-slate-400 text-xs max-w-md leading-relaxed mb-8 px-4 font-sans">
          {errorMessage || 'Your account lookup failed or your account has not been assigned a valid permission role.'}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleLogout}
            className="w-full h-11 rounded-xl text-white font-semibold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: '#dc2626' }}
            id="role-guard-logout-btn"
          >
            <LogOut size={14} />
            Log Out Session
          </button>
          <button
            onClick={() => setLocation('/')}
            className="w-full h-11 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-semibold text-xs hover:bg-slate-850 active:scale-95 transition-all flex items-center justify-center gap-2"
            id="role-guard-back-btn"
          >
            <ArrowLeft size={14} />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
