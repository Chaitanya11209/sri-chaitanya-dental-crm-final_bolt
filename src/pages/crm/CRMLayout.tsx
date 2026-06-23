import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard, Users, CalendarPlus, Stethoscope,
  FileText, DollarSign, Bell, LogOut, Menu,
  ChevronRight, Building2, Shield, UserCircle, UserCog, TrendingUp, FolderDown, Settings,
  Search, X, Loader2, Calendar, Phone, Mail, MapPin, CheckCircle2, AlertCircle, RefreshCw, HeartPulse,
  Clock, History, Tv, Microscope, Award, Package, MessageSquare, CalendarCheck, Moon, Sun,
  Cloud, CloudOff, Layers
} from 'lucide-react';
import { logout, getCurrentUser, isAdmin, getRole, isLoggedIn, validateSession, hasAccessToRoute } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../components/NotificationProvider';
import DentalLogo from '../../components/DentalLogo';

interface CRMLayoutProps {
  children: React.ReactNode;
}

export default function CRMLayout({ children }: CRMLayoutProps) {
  const { notify } = useNotification();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [dynamicRole, setDynamicRole] = useState<string | null>(null);
  const [roleLookupFailed, setRoleLookupFailed] = useState(false);
  const [roleLookupError, setRoleLookupError] = useState<string | null>(null);

  // Dark Scheme state engine
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('crm_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('crm_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('crm_theme', 'light');
    }
  }, [isDarkMode]);
  
  // Multi-clinic branch state
  const [activeBranch, setActiveBranch] = useState(() => {
    return localStorage.getItem('crm_active_branch') || 'Vijayawada HQ';
  });

  // Global search & real-time syncing states
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    patients: any[];
    appointments: any[];
  }>({ patients: [], appointments: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatientDetail, setSelectedPatientDetail] = useState<any | null>(null);
  const [selectedAppointmentDetail, setSelectedAppointmentDetail] = useState<any | null>(null);

  // Sync state tracking listener
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsGlobalSyncing(!!detail?.syncing);
    };
    window.addEventListener('crm-sync-state', handleSync);
    return () => window.removeEventListener('crm-sync-state', handleSync);
  }, []);

  // Auto-Sync state
  const [autoSyncInterval, setAutoSyncInterval] = useState<string>(() => {
    return localStorage.getItem('crm_auto_sync_interval') || '30s';
  });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);

  // Auto-Sync timer effect
  useEffect(() => {
    if (autoSyncInterval === 'Off') {
      return;
    }

    const getDuration = (interval: string) => {
      if (interval === '10s') return 10;
      if (interval === '30s') return 30;
      if (interval === '1m') return 60;
      if (interval === '5m') return 300;
      return 30;
    };

    const period = getDuration(autoSyncInterval);
    setSecondsRemaining(period);

    const triggerSync = () => {
      console.info(`[Auto Sync] Timer fired for interval: ${autoSyncInterval}. Dispatching crm-force-sync.`);
      window.dispatchEvent(new CustomEvent('crm-force-sync'));
    };

    const intervalId = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          triggerSync();
          return period;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [autoSyncInterval]);

  // Online / Offline state tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Live Queue update broadcast alerts subscriber for all clinic staff
  useEffect(() => {
    const channel = supabase
      .channel('clinic-staff-queue-alerts-layout')
      .on('broadcast', { event: 'alert' }, (payload) => {
        console.log('[CRMLayout Broadcast] Global Queue Alert seen:', payload);
        const { event, name, message } = payload.payload;
        notify(
          event === 'new-patient' ? 'info' : 'success',
          event === 'new-patient' ? 'New Patient Registered' : 'Appointment Ready / సిద్ధంగా ఉంది',
          message
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [notify]);

  // Live global query trigger
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults({ patients: [], appointments: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const q = searchQuery.trim();
        const { data: matchedPatients } = await supabase
          .from('patients')
          .select('*')
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5);

        const { data: matchedAppts } = await supabase
          .from('appointments')
          .select('*')
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
          .order('next_visit', { ascending: false })
          .limit(5);

        setSearchResults({
          patients: matchedPatients || [],
          appointments: matchedAppts || []
        });
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const user = getCurrentUser();
  const admin = isAdmin();
  const roleName = getRole();

  const allNavItems = [
    { path: '/crm/dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
    { path: '/crm/patients',     label: 'Patients',          icon: Users },
    { path: '/crm/appointments', label: 'Appointments',      icon: Calendar },
    { path: '/crm/treatments',   label: 'Treatments',        icon: Stethoscope },
    { path: '/crm/followups',    label: 'Follow-ups',         icon: Clock },
    { path: '/crm/billing',      label: 'Billing / Invoices', icon: DollarSign },
    { path: '/crm/labwork',      label: 'Lab Work',          icon: Microscope },
    { path: '/crm/patients?view=chart', label: 'Dental Chart', icon: Award },
    { path: '/crm/3d-model',     label: '3D Model',          icon: Layers },
    { path: '/crm/letters',      label: 'Letters',           icon: FileText },
    { path: '/crm/reports',      label: 'Reports',           icon: TrendingUp },
    { path: '/crm/setup',        label: 'Settings',          icon: Settings },
    { path: '/crm/doctors',      label: 'Doctors',           icon: HeartPulse },
    { path: '/crm/expenses',     label: 'Expenses',          icon: DollarSign },
    { path: '/crm/inventory',    label: 'Inventory',         icon: Package },
    { path: '/crm/profile',      label: 'Profile',           icon: UserCircle },
  ];

  // Centralized auth guard and administrator/role path protection with strict runtime validation:
  useEffect(() => {
    const logged = isLoggedIn();
    if (!logged) {
      setLocation('/admin');
      return;
    }

    const loadAndVerify = async () => {
      const valid = await validateSession();
      if (!valid) {
        setLocation('/admin');
        return;
      }

      const mode = localStorage.getItem('crmAuthMode');
      const cachedRole = localStorage.getItem('userRole');
      let fetchedRole: string | null = null;

      if (mode === 'dev') {
        fetchedRole = cachedRole;
      } else {
        try {
          const sessionRes = await supabase.auth.getSession();
          const userObj = sessionRes.data?.session?.user;
          if (userObj) {
            // Query Supabase 'users' table
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('role')
              .eq('id', userObj.id)
              .maybeSingle();

            if (!userError && userData?.role) {
              fetchedRole = userData.role;
            } else {
              // Fallback to 'staff_roles' table
              let { data: staffData, error: staffError } = await supabase
                .from('staff_roles')
                .select('role, status')
                .eq('user_id', userObj.id)
                .maybeSingle();

              if (staffError && (staffError.message?.includes('status') || staffError.code === '42703')) {
                const { data: fallbackData, error: fallbackError } = await supabase
                  .from('staff_roles')
                  .select('role')
                  .eq('user_id', userObj.id)
                  .maybeSingle();
                if (!fallbackError && fallbackData) {
                  staffData = { ...fallbackData, status: 'Active' };
                  staffError = null;
                }
              }

              if (!staffError && staffData) {
                if (staffData.status === 'Inactive') {
                  console.error("Access Denied: Account is deactivated.");
                  setRoleLookupFailed(true);
                  setRoleLookupError("Access Denied: Your account has been deactivated. Please contact your administrator.");
                  logout().catch(() => {});
                  setLocation('/admin');
                  return;
                }
                fetchedRole = staffData.role;
              }
            }
          }
        } catch (err: any) {
          console.error("Error fetching dynamic user role from Supabase:", err);
        }
      }

      // If we are in 'supabase' mode, we MUST NOT trust cachedRole — we only trust fresh fetchedRole from database queries!
      const rawRole = ((mode === 'dev') ? (fetchedRole || cachedRole) : fetchedRole) || '';
      const activeRole = rawRole.toLowerCase().trim();
      const validRoles = ['admin', 'doctor', 'receptionist', 'assistant', 'staff'];
      const isValidRole = activeRole && validRoles.includes(activeRole);

      if (!isValidRole) {
        const errorMsg = `Access Denied: Role lookup failed or unauthorized role. Value: "${activeRole || 'undefined'}".`;
        console.error(errorMsg);
        setRoleLookupFailed(true);
        setRoleLookupError(`Access Denied: Your account role was not found in the database. Please contact an administrator.`);
        if (mode === 'supabase') {
          logout().catch(() => {});
        }
        setSessionChecked(true);
        return;
      }

      const sanitizedRole = activeRole === 'staff' ? 'receptionist' : activeRole;
      setDynamicRole(sanitizedRole);
      localStorage.setItem('userRole', sanitizedRole);

      // Strict role-based protection for sensitive routes is handled centrally via hasAccessDenied check
      setRoleLookupFailed(false);
      setSessionChecked(true);
    };

    loadAndVerify();
  }, [location, setLocation, admin, roleName]);

  const handleLogout = async () => {
    await logout();
    setLocation('/admin');
  };

  // If role lookup failed completely, prevent further rendering and show secure Access Denied UI
  if (roleLookupFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-500 mb-4 animate-bounce">
          <Shield size={32} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 text-xs max-w-sm leading-relaxed mb-6">
          {roleLookupError || 'Your account lookup failed or your account has not been assigned a valid permission role. Please log out and sign in with authorized credentials.'}
        </p>
        <div className="space-y-2 w-full max-w-xs">
          <button
            onClick={handleLogout}
            className="w-full h-11 rounded-xl text-white font-semibold text-xs active:scale-95 transition-all"
            style={{ backgroundColor: '#dc2626' }}
          >
            Log Out Session
          </button>
          <a
            href="/admin"
            className="block py-2 text-xs font-semibold text-slate-500 hover:text-slate-350 transition"
          >
            Go Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  // Don't render CRM shell until session is confirmed valid
  if (!isLoggedIn() || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter navigation items dynamically based on active CRM staff roles
  const activeRole = dynamicRole || roleName;
  const roleLower = (activeRole || '').toLowerCase().trim();

  // Determine allowed paths for the current role
  const getNavItemsForRole = (role: string) => {
    return allNavItems.filter(item => hasAccessToRoute(item.path, role));
  };

  const navItems = getNavItemsForRole(roleLower);
  const currentNav = allNavItems.find(item => {
    const basePath = item.path.split('?')[0];
    if (item.path.includes('?')) {
      return location === basePath && window.location.search.includes(item.path.split('?')[1]);
    }
    return location === basePath && !window.location.search.includes('view=chart');
  }) || allNavItems.find(item => location.startsWith(item.path.split('?')[0]));

  // Access check for restricted admin-only / doctor-only paths
  const checkHasAccess = (path: string, role: string): boolean => {
    return hasAccessToRoute(path, role);
  };

  const hasAccessDenied = sessionChecked && !checkHasAccess(location, roleLower);

  // Nice role label helper
  const formatRoleLabel = (role: string) => {
    if (role === 'admin') return 'Admin Role';
    if (role === 'doctor') return 'Doctor Role';
    if (role === 'receptionist') return 'Receptionist';
    if (role === 'assistant') return 'Assistant';
    return role.toUpperCase();
  };

  const getRoleBadgeStyle = (role: string) => {
    if (role === 'admin') return 'bg-teal-950 border border-teal-800 text-teal-400';
    if (role === 'doctor') return 'bg-indigo-950 border border-indigo-800 text-indigo-400';
    if (role === 'receptionist') return 'bg-blue-950 border border-blue-800 text-blue-400';
    return 'bg-slate-800 border border-slate-700 text-slate-300';
  };

  const getRoleHeaderStyle = (role: string) => {
    if (role === 'admin') return 'bg-teal-50 dark:bg-teal-950/45 text-teal-700 dark:text-teal-350 border border-teal-100 dark:border-teal-900/50';
    if (role === 'doctor') return 'bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-350 border border-indigo-100 dark:border-indigo-900/50';
    if (role === 'receptionist') return 'bg-blue-50 dark:bg-blue-950/45 text-blue-700 dark:text-blue-350 border border-blue-100 dark:border-blue-900/50';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="flex h-screen bg-[#F3F4F6] dark:bg-slate-950 text-slate-800 dark:text-slate-200 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar matching screenshot */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-[#E5E7EB] dark:border-slate-800 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Section */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-slate-800 flex items-center justify-between">
          <Link href="/crm/dashboard" className="cursor-pointer">
            <DentalLogo size={18} textColor="text-[#0F6E6E] dark:text-[#14B8A6]" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-[#94A3B8] hover:text-[#0F6E6E] transition"
          >
            <ChevronRight className="rotate-180 text-[#94A3B8]" size={16} />
          </button>
        </div>

        {/* Sidebar menu list */}
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path.includes('?')
              ? location === path.split('?')[0] && window.location.search.includes(path.split('?')[1])
              : location === path && !window.location.search.includes('view=chart');
            return (
              <Link
                key={path}
                href={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all select-none cursor-pointer duration-150
                  ${isActive
                    ? 'bg-[#0F6E6E] text-white font-semibold shadow-sm'
                    : 'text-[#6B7280] dark:text-slate-400 hover:bg-[#F3F4F6]/75 dark:hover:bg-slate-800/50 hover:text-[#111827] dark:hover:text-white'
                  }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-[#6B7280] dark:text-slate-400'} />
                <span className="flex-1 truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Supabase Status Banner */}
        <div className="px-4 py-3 mx-4 mb-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/65 dark:bg-slate-900/40 font-semibold text-[11px] space-y-1.5 select-none">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="uppercase text-[9px] tracking-wider font-bold">DATABASE SYNC</span>
            <div className="flex items-center gap-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                !isOnline ? 'bg-red-500' :
                isGlobalSyncing ? 'bg-amber-500 animate-pulse' :
                'bg-emerald-500'
              }`} />
              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
                {!isOnline ? 'OFFLINE' : isGlobalSyncing ? 'SYNCING' : 'SECURE'}
              </span>
            </div>
          </div>
          
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('crm-force-sync'));
              notify('success', 'Sync Initiated', 'Manual synchronization query completed.');
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-850 border border-slate-200/60 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-350 transition active:scale-[0.98] cursor-pointer"
            title="Click to force fetch absolute latest records from Supabase"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {!isOnline ? (
                <CloudOff size={13} className="text-red-500 shrink-0" />
              ) : isGlobalSyncing ? (
                <Cloud size={13} className="text-amber-500 shrink-0 animate-bounce" />
              ) : (
                <Cloud size={13} className="text-emerald-500 shrink-0" />
              )}
              <span className="truncate font-sans font-black text-[10px]">
                {!isOnline ? 'No Cloud Connection' : isGlobalSyncing ? 'Syncing Tables...' : 'Supabase Active'}
              </span>
            </div>
            <RefreshCw size={10} className={`text-slate-400 self-center shrink-0 ${isGlobalSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Precise Red-bordered Logout Button */}
        <div className="p-4 border-t border-[#E5E7EB] dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#E74C3C] text-[#E74C3C] hover:bg-[#E74C3C]/5 font-semibold text-xs transition-all active:scale-95 cursor-pointer"
          >
            <LogOut size={13} className="text-[#E74C3C]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0 relative z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-805 transition"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-slate-800 dark:text-white font-semibold text-base">{currentNav?.label ?? 'Dashboard'}</h1>
                {!isOnline && (
                  <span className="inline-flex items-center gap-1.5 px-2.0 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800 animate-pulse shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Offline Mode (Cached View)
                  </span>
                )}
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-[10px] hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* GLOBAL SEARCH BAR */}
          <div className="flex-1 max-w-[200px] sm:max-w-xs md:max-w-md mx-1 sm:mx-4 relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient profiles & workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/75 dark:hover:bg-slate-700/75 focus:bg-white dark:focus:bg-slate-900 border border-slate-250/70 dark:border-slate-750 text-[11px] rounded-lg pl-8 pr-7 py-2.0 outline-none focus:border-teal-500 dark:focus:border-teal-400 text-slate-800 dark:text-slate-100 transition-all font-medium py-1.5"
              />
              {searchLoading ? (
                <RefreshCw size={11} className="absolute right-2.5 top-2.5 text-slate-400 animate-spin" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-650"
                >
                  <X size={11} />
                </button>
              ) : null}
            </div>

            {/* Live Dropdown Options overlay */}
            {searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 text-xs">
                {searchLoading ? (
                  <div className="p-4 text-center text-slate-400 font-medium flex items-center justify-center gap-1.5">
                    <Loader2 size={13} className="animate-spin text-teal-600" />
                    Searching Sri Chaitanya...
                  </div>
                ) : (searchResults.patients.length === 0 && searchResults.appointments.length === 0) ? (
                  <div className="p-4 text-center text-slate-400 font-medium">
                    No clinical records found for "{searchQuery}"
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {/* Patient list matched */}
                    {searchResults.patients.length > 0 && (
                      <div className="p-2.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1.5">Matched Patient Profiles</p>
                        <div className="space-y-1">
                          {searchResults.patients.map((p) => (
                            <div
                              key={`p-${p.id}`}
                              onClick={() => {
                                setSelectedPatientDetail(p);
                                setSearchQuery('');
                              }}
                              className="p-2 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-slate-800 truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                  <Phone size={9} className="text-slate-405" /> {p.phone || 'No phone'}
                                </p>
                              </div>
                              <span className="text-[8px] font-bold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100 uppercase flex-shrink-0">
                                {p.patient_status || 'Registered'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Appointment list matched */}
                    {searchResults.appointments.length > 0 && (
                      <div className="p-2.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1.5">Matched Appointments</p>
                        <div className="space-y-1">
                          {searchResults.appointments.map((appt) => (
                            <div
                              key={`appt-${appt.id}`}
                              onClick={() => {
                                setSelectedAppointmentDetail(appt);
                                setSearchQuery('');
                              }}
                              className="p-2 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="font-bold text-slate-800 truncate">{appt.name || 'Unknown Patient'}</p>
                                <p className="text-[10px] text-slate-500 font-medium truncate">
                                  {appt.treatment || 'Consultation'} (Date: {appt.next_visit})
                                </p>
                              </div>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase flex-shrink-0 block ml-2 ${
                                appt.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                appt.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                appt.status === 'In Treatment' ? 'bg-blue-50 text-blue-700 border-blue-105' :
                                'bg-slate-150 text-slate-650 border-slate-200'
                              }`}>
                                {appt.status || 'Pending'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Multi-Clinic Branch Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-200 transition">
              <Building2 size={12} className="text-teal-600 shrink-0" />
              <select
                value={activeBranch}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveBranch(val);
                  localStorage.setItem('crm_active_branch', val);
                  window.dispatchEvent(new CustomEvent('crm-branch-changed', { detail: { branch: val } }));
                }}
                className="bg-transparent border-none p-0 m-0 text-[11px] font-black focus:ring-0 focus:outline-none cursor-pointer outline-none"
              >
                <option value="Vijayawada HQ">Vijayawada HQ</option>
                <option value="Guntur Branch">Guntur Branch</option>
                <option value="Hyderabad Clinic">Hyderabad Clinic</option>
              </select>
            </div>

            {/* Unified Interactive Auto-Sync Tool & Live Indicator */}
            <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-150 text-slate-705 px-2.5 py-1 rounded-full border border-slate-200 transition-all duration-200 select-none">
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('crm-force-sync'));
                  notify('success', 'Page Synchronized', 'Initiating full-page cloud database refresh.');
                }}
                className="flex items-center gap-1 hover:bg-white active:scale-95 px-1.5 py-0.5 rounded transition"
                title="Force Synchronize Page Now"
              >
                <RefreshCw size={11} className={`${isGlobalSyncing ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
                <span className="text-[10px] uppercase tracking-wide font-extrabold hidden md:inline">Reload Data</span>
              </button>
              <div className="h-3 w-[1px] bg-slate-300 self-center" />
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Auto:</span>
                <select
                  value={autoSyncInterval}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAutoSyncInterval(val);
                    localStorage.setItem('crm_auto_sync_interval', val);
                  }}
                  className="bg-transparent border-none p-0 m-0 text-[10px] font-black focus:ring-0 focus:outline-none cursor-pointer outline-none text-slate-800"
                >
                  <option value="Off">Off</option>
                  <option value="10s">10s</option>
                  <option value="30s">30s</option>
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                </select>
              </div>
              {autoSyncInterval !== 'Off' ? (
                <div className="text-[9px] text-teal-600 font-mono pl-0.5 hidden lg:inline tracking-tight">
                  ({secondsRemaining}s)
                </div>
              ) : (
                <div className="text-[9px] text-slate-400 font-mono pl-0.5 hidden lg:inline tracking-tight">
                  (man)
                </div>
              )}
            </div>

            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
              ${getRoleHeaderStyle(activeRole)}`}>
              <Shield size={11} />
              {formatRoleLabel(activeRole)}
            </div>

            {/* Visual Theme Switcher */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center border border-slate-200 dark:border-slate-700"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              id="crm-theme-switcher"
            >
              {isDarkMode ? <Sun size={13} className="text-amber-500 animate-[spin_10s_linear_infinite]" /> : <Moon size={13} className="text-indigo-600" />}
            </button>
            
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-700 dark:text-emerald-350 text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-100/50 dark:border-emerald-900/30">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6 relative z-10">
          {hasAccessDenied ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center bg-white border border-slate-200 rounded-2xl shadow-sm animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-4 shadow-sm animate-bounce">
                <Shield size={26} />
              </div>
              <h2 className="text-slate-800 font-extrabold text-lg tracking-tight">Access Denied</h2>
              <p className="text-slate-500 text-xs mt-2 max-w-sm leading-relaxed font-semibold">
                You do not have the required administrative permissions to access this module. Please contact your system administrator if you require authorization.
              </p>
              <div className="mt-6">
                <Link
                  href="/crm/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0F6E6E] hover:bg-[#0c5959] active:scale-95 transition-all shadow-sm"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Dynamic Mobile Bottom Navigation Bar styled as a premium modern floating dock */}
        <nav id="crm-mobile-bottom-nav" className="lg:hidden fixed bottom-3 left-4 right-4 h-15 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-around px-2 z-40 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          {(() => {
            const mobileItems = [
              { path: '/crm/dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { path: '/crm/appointments', label: 'Appointments', icon: Calendar },
              { path: '/crm/patients', label: 'Patients', icon: Users },
            ].filter(item => hasAccessToRoute(item.path, roleLower));
            return mobileItems.map(item => {
              const isActive = location.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 h-full select-none cursor-pointer text-center transition-all ${
                    isActive ? 'text-[#0F6E6E] dark:text-[#14B8A6] font-bold font-sans' : 'text-[#6B7280] dark:text-slate-400 active:scale-95'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-[#0F6E6E]/10 dark:bg-[#14B8A6]/10 scale-105' : 'bg-transparent'}`}>
                    <Icon size={16} className={isActive ? 'text-[#0F6E6E] dark:text-[#14B8A6]' : 'text-[#6B7280] dark:text-slate-400'} />
                  </div>
                  <span className="text-[9px] tracking-wide font-semibold">{item.label}</span>
                </Link>
              );
            });
          })()}
        </nav>
      </div>

      {/* GLOBAL PATIENT CARE PROFILE OVERLAY */}
      {selectedPatientDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-150 shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-800">
            <div className="bg-teal-750 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <UserCircle size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Patient Care Profile</h4>
              </div>
              <button onClick={() => setSelectedPatientDetail(null)} className="text-white/80 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-teal-850 font-extrabold text-lg flex items-center justify-center shadow-xs">
                  {selectedPatientDetail.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedPatientDetail.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] font-semibold text-slate-500 font-mono">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{selectedPatientDetail.patient_code || 'No Code'}</span>
                    <span>·</span>
                    <span>{selectedPatientDetail.gender || 'Unspecified'}</span>
                    <span>·</span>
                    <span>Age: {selectedPatientDetail.age || '--'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Phone Record</span>
                  <p className="flex items-center gap-1.5 text-slate-700 font-mono">
                    <Phone size={13} className="text-slate-400" />
                    {selectedPatientDetail.phone || 'Not provided'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Email Address</span>
                  <p className="flex items-center gap-1.5 text-slate-700 truncate">
                    <Mail size={13} className="text-slate-400" />
                    {selectedPatientDetail.email || 'Not provided'}
                  </p>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Home/Billing Location</span>
                  <p className="flex items-center gap-1.5 text-slate-700">
                    <MapPin size={13} className="text-slate-400" />
                    {selectedPatientDetail.location || 'Not provided'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Active Treatment Summary</span>
                <p className="text-slate-700 italic">
                  {selectedPatientDetail.treatment_summary || 'No active treatments documented in dental history.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-[10.5px] font-semibold">
                <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-150">
                  <span className="block text-[9px] uppercase font-bold text-slate-450">Last Visited Date</span>
                  <span className="text-slate-700 font-mono">{selectedPatientDetail.last_visit_date || 'No registry record'}</span>
                </div>
                <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-150">
                  <span className="block text-[9px] uppercase font-bold text-slate-450">Next Scheduled Date</span>
                  <span className="text-slate-700 font-mono">{selectedPatientDetail.next_visit_date || 'None scheduled'}</span>
                </div>
              </div>

              {selectedPatientDetail.notes && (
                <div className="text-xs bg-amber-50/55 border border-amber-100 p-3 rounded-lg">
                  <strong className="text-amber-800 block text-[10px] uppercase tracking-wider mb-0.5">Clinical/Staff Notes</strong>
                  <p className="text-slate-655 italic leading-relaxed">{selectedPatientDetail.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-150 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Sri Chaitanya Dental Care</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatientDetail(null);
                  setLocation('/crm/patients');
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer border-0"
              >
                Manage Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL APPOINTMENT WORKFLOW OVERLAY */}
      {selectedAppointmentDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-155 shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-800">
            <div className="bg-indigo-755 p-4 flex items-center justify-between text-white" style={{ backgroundColor: '#4338ca' }}>
              <div className="flex items-center gap-2">
                <CalendarPlus size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Scheduled Appointment Workflow</h4>
              </div>
              <button onClick={() => setSelectedAppointmentDetail(null)} className="text-white/80 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedAppointmentDetail.name}</h3>
                  <p className="text-[10px] text-slate-500 font-bold font-mono mt-0.5">Contact: {selectedAppointmentDetail.phone}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  selectedAppointmentDetail.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                  selectedAppointmentDetail.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-150' :
                  selectedAppointmentDetail.status === 'In Treatment' ? 'bg-blue-50 text-blue-700 border-blue-150' :
                  'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  {selectedAppointmentDetail.status || 'Pending'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-2 gap-4 text-xs font-semibold">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Scheduled Date</span>
                  <p className="flex items-center gap-1.5 text-slate-800 font-mono">
                    <Calendar size={13} className="text-indigo-500" />
                    {selectedAppointmentDetail.next_visit || '--'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Meeting Slot</span>
                  <p className="flex items-center gap-1.5 text-slate-800 font-mono">
                    <Clock size={13} className="text-indigo-500" />
                    {selectedAppointmentDetail.appointment_time || '--'}
                  </p>
                </div>
                <div className="space-y-1 col-span-2 pt-1 border-t border-slate-105">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Treatment Procedure</span>
                  <p className="text-slate-800 font-semibold text-xs leading-relaxed flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-indigo-500" />
                    {selectedAppointmentDetail.treatment || 'Consultation / Evaluation'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-[10px] font-bold uppercase tracking-wider text-center">
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-2">
                  <span className="block text-[8px] text-slate-450">Visit Count</span>
                  <span className="text-slate-800 font-mono text-xs">{selectedAppointmentDetail.visit_count ?? 1}</span>
                </div>
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-2">
                  <span className="block text-[8px] text-slate-450">Session Type</span>
                  <span className="text-slate-800 text-xs">{selectedAppointmentDetail.visit_type || 'New'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-2">
                  <span className="block text-[8px] text-slate-450">Mode of Payment</span>
                  <span className="text-slate-800 text-xs">{selectedAppointmentDetail.payment_mode || 'Cash'}</span>
                </div>
              </div>

              {(selectedAppointmentDetail.amount_paid > 0 || selectedAppointmentDetail.balance_amount > 0) && (
                <div className="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400">Total Cleared Payment</span>
                    <p className="text-emerald-700 font-extrabold text-sm">₹{Number(selectedAppointmentDetail.amount_paid || 0).toLocaleString('en-IN')}</p>
                  </div>
                  {selectedAppointmentDetail.balance_amount > 0 && (
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Outstanding Balance</span>
                      <p className="text-rose-600 font-extrabold text-sm">₹{Number(selectedAppointmentDetail.balance_amount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedAppointmentDetail.notes && (
                <div className="text-xs bg-slate-50 border border-slate-150 p-3 rounded-lg">
                  <strong className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Scheduler notes</strong>
                  <p className="text-slate-600 italic leading-relaxed">{selectedAppointmentDetail.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-150 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-405 uppercase font-mono">Sri Chaitanya DentalCare</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAppointmentDetail(null);
                  setLocation('/crm/appointments');
                }}
                className="px-4 py-2 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer border-0"
                style={{ backgroundColor: '#4338ca' }}
              >
                Go to Appointments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
