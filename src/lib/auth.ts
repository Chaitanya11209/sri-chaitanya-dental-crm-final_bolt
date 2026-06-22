import { supabase, isSupabaseConfigured } from './supabase';

export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'assistant';

export interface CRMUser {
  email: string;
  name: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Sync helpers — read the cached role set during login
// These are safe to call synchronously; they never grant elevated access
// if the cache is absent or contains an unexpected value.
// ---------------------------------------------------------------------------

export function isLoggedIn(): boolean {
  return localStorage.getItem('crmAuthMode') !== null;
}

export function getRole(): UserRole {
  const stored = localStorage.getItem('userRole');
  if (stored === 'admin') return 'admin';
  if (stored === 'doctor') return 'doctor';
  if (stored === 'receptionist') return 'receptionist';
  if (stored === 'assistant') return 'assistant';
  // Backward compatibility fallback for 'staff'
  if (stored === 'staff') return 'receptionist';
  return 'receptionist';
}

export function isAdmin(): boolean {
  return getRole() === 'admin';
}

export function isDoctor(): boolean {
  return getRole() === 'doctor';
}

export function isReceptionist(): boolean {
  return getRole() === 'receptionist';
}

export function isAssistant(): boolean {
  return getRole() === 'assistant';
}

// Permission action helpers
export function canWriteClinical(): boolean {
  const r = getRole();
  return r === 'admin' || r === 'doctor';
}

export function canWriteScheduling(): boolean {
  const r = getRole();
  return r === 'admin' || r === 'receptionist' || r === 'doctor';
}

export function canWriteBilling(): boolean {
  return getRole() === 'admin';
}

export function hasAccessToRoute(path: string, role: string): boolean {
  const normalizedPath = path.split('?')[0].toLowerCase().trim();
  const normalizedRole = (role || '').toLowerCase().trim();

  // Admin has access to everything
  if (normalizedRole === 'admin') {
    return true;
  }

  // Doctor permissions:
  // Allowed: Dashboard, Patients, Appointments, Treatments, Follow-Ups, Lab Work, Letters, Doctors
  // Blocked: Settings (/crm/setup, /crm/settings), Expenses (/crm/expenses), System Administration (Users /crm/users, Export /crm/export, Audit /crm/audit).
  // Also hidden/blocked: Billing (/crm/billing, /crm/collections), Reports (/crm/reports), Profile (/crm/profile), Inventory (/crm/inventory)
  if (normalizedRole === 'doctor') {
    const listAllowed = [
      '/crm/dashboard',
      '/crm/patients',
      '/crm/appointments',
      '/crm/treatments',
      '/crm/followups',
      '/crm/labwork',
      '/crm/letters',
      '/crm/doctors'
    ];
    return listAllowed.some(p => normalizedPath === p);
  }

  // Staff / Receptionist / Assistant permissions:
  // Allowed: Dashboard, Patients, Appointments, Treatments, Follow-Ups, Inventory, Lab Work, Doctors
  // Blocked: Billing (/crm/billing, /crm/collections), Letters (/crm/letters), Reports (/crm/reports), Expenses (/crm/expenses), Settings (/crm/setup, /crm/settings), Profile (/crm/profile)
  // Also blocked system admin things (Users, Export, Audit)
  if (normalizedRole === 'receptionist' || normalizedRole === 'assistant' || normalizedRole === 'staff') {
    const listBlocked = [
      '/crm/billing',
      '/crm/collections',
      '/crm/letters',
      '/crm/reports',
      '/crm/expenses',
      '/crm/setup',
      '/crm/settings',
      '/crm/profile',
      '/crm/users',
      '/crm/export',
      '/crm/audit'
    ];
    return !listBlocked.some(p => normalizedPath === p);
  }

  // Default block
  return false;
}

export function getCurrentUser(): CRMUser | null {
  const logged = isLoggedIn();
  if (!logged) return null;
  const email = localStorage.getItem('userEmail') ?? '';
  const storedRole = localStorage.getItem('userRole');
  let role: UserRole = 'receptionist';
  if (storedRole === 'admin') role = 'admin';
  else if (storedRole === 'doctor') role = 'doctor';
  else if (storedRole === 'receptionist') role = 'receptionist';
  else if (storedRole === 'assistant') role = 'assistant';
  else if (storedRole === 'staff') role = 'receptionist';
  
  const name = localStorage.getItem('userName') ?? 'User';
  return { email, role, name };
}

// ---------------------------------------------------------------------------
// Async login
// When Supabase is configured: validates credentials server-side via
// supabase.auth.signInWithPassword, then fetches the role from staff_roles.
// When Supabase is NOT configured (local dev): uses a hardcoded dev fallback
// so the app works before credentials are wired up.
// ---------------------------------------------------------------------------

export async function login(emailOrUsername: string, password: string): Promise<CRMUser | null> {
  const trimmedEmail = emailOrUsername.toLowerCase().trim();

  // Support usernames: if it doesn't contain "@", convert it to the internal mock domain format
  let processedEmail = trimmedEmail;
  if (processedEmail && !processedEmail.includes('@')) {
    processedEmail = `${processedEmail}@srichaitanya.local`;
  }

  // Supabase Auth — server-side credential validation
  const { data, error } = await supabase.auth.signInWithPassword({
    email: processedEmail,
    password,
  });

  if (error || !data.user) {
    return null;
  }

  // Hard validation: Ensure user exists in the 'staff_roles' database table
  let roleRow: { role: string; name: string; status?: string } | null = null;
  try {
    let { data: row, error: roleError } = await supabase
      .from('staff_roles')
      .select('role, name, status')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (roleError && (roleError.message?.includes('status') || roleError.code === '42703')) {
      const { data: fallbackRow, error: fallbackError } = await supabase
        .from('staff_roles')
        .select('role, name')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (!fallbackError && fallbackRow) {
        row = { ...fallbackRow, status: 'Active' };
        roleError = null;
      }
    }

    if (!roleError && row) {
      roleRow = {
        role: row.role,
        name: row.name || '',
        status: row.status || 'Active'
      };
    }
  } catch (err) {
    // Treat any fetch error as denied to be highly secure
    console.error("Auth security exception: could not fetch staff_roles.", err);
  }

  // Strict check: Reject completely if user does not exist in staff_roles
  if (!roleRow) {
    await supabase.auth.signOut().catch(() => {});
    _clearCache();
    throw new Error('Access Denied: This account is authenticated but does not have a assigned record in the system database (staff_roles). Please contact an administrator.');
  }

  // Reject inactive accounts immediately
  if (roleRow.status === 'Inactive') {
    await supabase.auth.signOut().catch(() => {});
    _clearCache();
    throw new Error('Access Denied: This account has been deactivated. Please contact your administrator.');
  }

  const dbRole = (roleRow.role || '').toLowerCase().trim();
  const role: UserRole = (
    dbRole === 'admin' ? 'admin' :
    dbRole === 'doctor' ? 'doctor' :
    dbRole === 'receptionist' ? 'receptionist' :
    dbRole === 'assistant' ? 'assistant' :
    dbRole === 'staff' ? 'receptionist' : 'receptionist'
  );
  const name: string = roleRow.name ?? data.user.email ?? 'User';

  _cacheUser('supabase', data.user.email ?? processedEmail, name, role);
  return { email: data.user.email ?? processedEmail, name, role };
}

// ---------------------------------------------------------------------------
// Async logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  const mode = localStorage.getItem('crmAuthMode');
  if (mode === 'supabase') {
    await supabase.auth.signOut().catch(() => {});
  }
  _clearCache();
}

// ---------------------------------------------------------------------------
// Async session validation — call from CRMLayout on mount to verify that
// any Supabase session stored in the browser is still valid server-side.
// Dev-mode sessions skip server validation (no token to check).
// ---------------------------------------------------------------------------

export async function validateSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      const msg = error.message || '';
      console.warn("Supabase Auth session fetch encountered an error:", msg);
      if (
        msg.includes('Refresh Token') || 
        msg.includes('invalid_grant') || 
        msg.includes('grant') || 
        msg.includes('not found') ||
        msg.includes('NotFound')
      ) {
        console.error("Critical: Supabase returned invalid grant / refresh token error. Clearing local credential caches.");
        _clearCache();
        return false;
      }
    }
    
    if (!data || !data.session || !data.session.user) {
      const mode = localStorage.getItem('crmAuthMode');
      if (mode === 'dev') {
        // Check if we have credentials stored locally to survive iframe/storage partitioning constraints
        const hasLocalCache = localStorage.getItem('userEmail') && localStorage.getItem('userRole');
        if (hasLocalCache) {
          return true;
        }
      }
      _clearCache();
      return false;
    }

    // Recover/sync cache if it got lost, or update if role changed in DB
    const user = data.session.user;
    let roleRow: { role: string; name: string; status?: string } | null = null;
    try {
      // Query staff_roles strictly (the absolute authority on staff configurations)
      let { data: row, error: roleError } = await supabase
        .from('staff_roles')
        .select('role, name, status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError && (roleError.message?.includes('status') || roleError.code === '42703')) {
        const { data: fallbackRow, error: fallbackError } = await supabase
          .from('staff_roles')
          .select('role, name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!fallbackError && fallbackRow) {
          row = { ...fallbackRow, status: 'Active' };
          roleError = null;
        }
      }

      if (!roleError && row) {
        roleRow = {
          role: row.role,
          name: row.name || '',
          status: row.status || 'Active'
        };
      }
    } catch (e) {
      console.error("Session Validation: Error querying staff_roles table", e);
    }

    // Force sign out immediately if deactivated or if the user is not found in the database at all
    if (!roleRow) {
      console.error("Session Validation: User not registered or has been removed from database.");
      _clearCache();
      await supabase.auth.signOut().catch(() => {});
      return false;
    }

    if (roleRow.status === 'Inactive') {
      console.error("Session Validation: Account is deactivated.");
      _clearCache();
      await supabase.auth.signOut().catch(() => {});
      return false;
    }

    const dbRole = (roleRow.role || '').toLowerCase().trim();
    const role: UserRole = (
      dbRole === 'admin' ? 'admin' :
      dbRole === 'doctor' ? 'doctor' :
      dbRole === 'receptionist' ? 'receptionist' :
      dbRole === 'assistant' ? 'assistant' :
      dbRole === 'staff' ? 'receptionist' : 'receptionist'
    );
    const name: string = roleRow.name ?? user.email ?? 'User';
    _cacheUser('supabase', user.email ?? '', name, role);

    return true;
  } catch (err) {
    // Be resilient in case of transient error — fallback to cache if available
    const hasLocalCache = localStorage.getItem('userEmail') && localStorage.getItem('userRole');
    if (hasLocalCache) {
      return true;
    }
    _clearCache();
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _cacheUser(mode: string, email: string, name: string, role: UserRole) {
  localStorage.setItem('crmAuthMode', mode);
  localStorage.setItem('userEmail', email);
  localStorage.setItem('userName', name);
  localStorage.setItem('userRole', role);
}

function _clearCache() {
  ['crmAuthMode', 'userEmail', 'userName', 'userRole', 'adminLoggedIn'].forEach(k =>
    localStorage.removeItem(k)
  );
  // Safely clean all stale or corrupt Supabase local storage keys
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error("Error clearing Supabase local storage key:", e);
  }
}
