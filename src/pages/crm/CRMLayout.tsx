import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard, Users, CalendarPlus, Stethoscope,
  FileText, DollarSign, Bell, LogOut, Menu,
  ChevronRight, Building2, Shield, UserCircle, UserCog, TrendingUp, FolderDown, Settings,
  Search, X, Loader2, Calendar, Phone, Mail, MapPin, CheckCircle2, AlertCircle, RefreshCw, HeartPulse,
  Clock, Lock
} from 'lucide-react';
import { logout, getCurrentUser, isAdmin, getRole, isLoggedIn, validateSession } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

interface CRMLayoutProps {
  children: React.ReactNode;
}

interface UserModulePermission {
  module_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export default function CRMLayout({ children }: CRMLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [dynamicRole, setDynamicRole] = useState<string | null>(null);
  const [roleLookupFailed, setRoleLookupFailed] = useState(false);
  const [roleLookupError, setRoleLookupError] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

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

  // Module definitions - will be filtered by permissions
  const allNavItems = [
    { id: 'dashboard', path: '/crm/dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'staff' },
    { id: 'patients', path: '/crm/patients', label: 'Patients', icon: Users, category: 'staff' },
    { id: 'appointments', path: '/crm/appointments', label: 'Appointments', icon: CalendarPlus, category: 'staff' },
    { id: 'treatments', path: '/crm/treatments', label: 'Treatments', icon: Stethoscope, category: 'staff' },
    { id: 'doctors', path: '/crm/doctors', label: 'Doctors', icon: HeartPulse, category: 'staff' },
    { id: 'followups', path: '/crm/followups', label: 'Follow-ups', icon: Bell, category: 'staff' },
    { id: 'billing', path: '/crm/billing', label: 'Billing & Invoices', icon: FileText, category: 'admin', adminOnly: true },
    { id: 'reports', path: '/crm/reports', label: 'Reports & Analytics', icon: TrendingUp, category: 'admin', adminOnly: true },
    { id: 'collections', path: '/crm/collections', label: 'Collections', icon: DollarSign, category: 'admin', adminOnly: true },
    { id: 'users', path: '/crm/users', label: 'Users & Roles', icon: UserCog, category: 'admin', adminOnly: true },
    { id: 'permissions', path: '/crm/permissions', label: 'Permissions', icon: Lock, category: 'admin', adminOnly: true },
    { id: 'export', path: '/crm/export', label: 'Backup & Export', icon: FolderDown, category: 'admin', adminOnly: true },
    { id: 'settings', path: '/crm/settings', label: 'CRM Settings', icon: Settings, category: 'admin', adminOnly: true },
  ];

  // Filter nav items based on user permissions
  const navItems = allNavItems.filter(item => {
    // Admin has access to everything
    if (admin) return true;

    // Check dynamic permissions
    if (userPermissions[item.id] !== undefined) {
      return userPermissions[item.id];
    }

    // Fallback: staff-level modules for non-admins
    return item.category === 'staff';
  });

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
              const { data: staffData, error: staffError } = await supabase
                .from('staff_roles')
                .select('role')
                .eq('user_id', userObj.id)
                .maybeSingle();

              if (!staffError && staffData?.role) {
                fetchedRole = staffData.role;
              }
            }
          }
        } catch (err: any) {
          console.error("Error fetching dynamic user role from Supabase:", err);
        }
      }

      const activeRole = fetchedRole || cachedRole;
      const validRoles = ['admin', 'doctor', 'receptionist', 'assistant', 'staff'];
      const isValidRole = activeRole && validRoles.includes(activeRole);

      if (!isValidRole) {
        const errorMsg = `Access Denied: Role lookup failed or unauthorized role. Value: "${activeRole || 'undefined'}".`;
        console.error(errorMsg);
        setRoleLookupFailed(true);
        setRoleLookupError(`Access Denied: Unauthorized role or lookup failed. Value: ${activeRole || 'not assigned'}`);
        setSessionChecked(true);
        return;
      }

      const sanitizedRole = activeRole === 'staff' ? 'receptionist' : activeRole;
      setDynamicRole(sanitizedRole);
      localStorage.setItem('userRole', sanitizedRole);

      // Load user permissions from database
      if (sanitizedRole !== 'admin') {
        try {
          const { data: permissions } = await supabase
            .from('user_permissions')
            .select('module_id, can_view')
            .eq('user_id', sessionRes.data?.session?.user?.id);

          const permMap: Record<string, boolean> = {};
          (permissions || []).forEach((p: UserModulePermission) => {
            permMap[p.module_id] = p.can_view;
          });
          setUserPermissions(permMap);
        } catch (e) {
          console.warn('Could not load user permissions, using defaults');
        }
      }

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

  const currentNav = navItems.find(item => location.startsWith(item.path));

  // Access check for restricted admin-only paths
  const restrictedPaths = [
    '/crm/billing',
    '/crm/reports',
    '/crm/staff',
    '/crm/users',
    '/crm/permissions',
    '/crm/settings',
    '/crm/audit',
    '/crm/collections',
    '/crm/export'
  ];
  const isRestrictedPath = restrictedPaths.some(p => location.startsWith(p));
  const hasAccessDenied = isRestrictedPath && !admin;

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
    if (role === 'admin') return 'bg-teal-50 text-teal-700 border border-teal-100';
    if (role === 'doctor') return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
    if (role === 'receptionist') return 'bg-blue-50 text-blue-700 border border-blue-100';
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-950 border-r border-slate-800 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0 uppercase">
              SD
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-white text-sm tracking-tight leading-tight truncate">Sri Chaitanya</p>
                {isGlobalSyncing && <RefreshCw size={10} className="text-teal-400 animate-spin" />}
              </div>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider font-mono">Dental Care CRM</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-5 py-3.5 border-b border-slate-900 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getRoleBadgeStyle(activeRole)}`}>
              <UserCircle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? 'User'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield size={10} className={(activeRole === 'admin') ? 'text-teal-400' : 'text-slate-400'} />
                <span className={`text-[9px] font-bold uppercase tracking-wider ${(activeRole === 'admin') ? 'text-teal-400' : 'text-slate-400'}`}>
                  {formatRoleLabel(activeRole)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3.5 space-y-6 overflow-y-auto">
          {/* Section 1: Staff Workflows */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-mono font-bold text-teal-400 mb-2.5 px-2.5 tracking-wider border-b border-slate-900 pb-1.5">
              Clinical Staff Workspace
            </div>
            {navItems.filter(item => item.category === 'staff').map(({ path, label, icon: Icon }) => {
              const isActive = location.startsWith(path);
              return (
                <Link
                  key={path}
                  href={path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors group
                    ${isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`}
                >
                  <Icon size={15} className={isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="flex-1 truncate">{label}</span>
                  {isActive && <ChevronRight size={12} className="text-teal-400" />}
                </Link>
              );
            })}
          </div>

          {/* Section 2: Administrative Desk */}
          {navItems.some(item => item.category === 'admin') && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-mono font-bold text-amber-500 mb-2.5 px-2.5 tracking-wider border-b border-slate-900 pb-1.5">
                Administrative Desk
              </div>
              {navItems.filter(item => item.category === 'admin').map(({ path, label, icon: Icon, adminOnly }) => {
                const isActive = location.startsWith(path);
                return (
                  <Link
                    key={path}
                    href={path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors group
                      ${isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                      }`}
                  >
                    <Icon size={15} className={isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'} />
                    <span className="flex-1 truncate">{label}</span>
                    {adminOnly && (
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-amber-950/60 text-amber-500 border border-amber-900/50 px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                    {isActive && <ChevronRight size={12} className="text-teal-400" />}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-900 bg-slate-950/80 space-y-0.5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:bg-red-950/40 hover:text-red-400 border border-transparent hover:border-red-900/30 transition-all"
          >
            <LogOut size={15} />
            Logout Account
          </button>
          <a
            href="/"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-900 hover:text-slate-300 transition-all"
          >
            <Building2 size={15} />
            View Website
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0 relative z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-slate-800 font-semibold text-base">{currentNav?.label ?? 'Dashboard'}</h1>
                {!isOnline && (
                  <span className="inline-flex items-center gap-1.5 px-2.0 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800 animate-pulse shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Offline Mode (Cached View)
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-[10px] hidden sm:block">
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
                className="w-full bg-slate-50 hover:bg-slate-100/75 focus:bg-white border border-slate-250/70 text-[11px] rounded-lg pl-8 pr-7 py-2.0 outline-none focus:border-teal-500 transition-all font-medium py-1.5"
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
            {/* Live sync loader/indicator */}
            {isGlobalSyncing && (
              <div className="flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-bold px-2 py-1 rounded-full border border-teal-150 animate-pulse">
                <RefreshCw size={11} className="animate-spin text-teal-600" />
                <span className="hidden md:inline font-mono text-[9px] uppercase tracking-wide">Syncing...</span>
              </div>
            )}
            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
              ${getRoleHeaderStyle(activeRole)}`}>
              <Shield size={11} />
              {formatRoleLabel(activeRole)}
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 relative z-10">
          {hasAccessDenied ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center bg-white border border-slate-200 rounded-2xl shadow-sm animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-4 shadow-sm animate-bounce">
                <Shield size={26} />
              </div>
              <h2 className="text-slate-800 font-extrabold text-lg tracking-tight">Access Denied</h2>
              <p className="text-slate-500 text-xs mt-2 max-w-sm leading-relaxed font-semibold">
                You do not have the required administrative permissions to access this module. Please contact your system administrator if you require authorization.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
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
                    <p className="text-emerald-705 font-extrabold text-sm">₹{Number(selectedAppointmentDetail.amount_paid || 0).toLocaleString('en-IN')}</p>
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
