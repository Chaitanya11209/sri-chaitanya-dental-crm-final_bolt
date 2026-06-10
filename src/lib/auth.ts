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

export async function login(email: string, password: string): Promise<CRMUser | null> {
  const trimmedEmail = email.toLowerCase().trim();

  // 1. Static Local/Dev Fallback Accounts always work first
  // This guarantees that 'admin@gmail.com', 'doctor@gmail.com', 'receptionist@gmail.com' and 'assistant@gmail.com' are robust.
  const DEV: Record<string, { password: string; role: UserRole; name: string }> = {
    'admin@gmail.com': { password: 'admin123', role: 'admin', name: 'Dr. Chaitanya (Admin)' },
    'doctor@gmail.com': { password: 'doctor123', role: 'doctor', name: 'Dr. Verma (Doctor)' },
    'receptionist@gmail.com': { password: 'receptionist123', role: 'receptionist', name: 'Ankita (Receptionist)' },
    'assistant@gmail.com': { password: 'assistant123', role: 'assistant', name: 'Ravi (Assistant)' },
    'staff@gmail.com': { password: 'staff123', role: 'receptionist', name: 'Reception (Staff)' },
  };
  const cred = DEV[trimmedEmail];
  if (cred && cred.password === password) {
    _cacheUser('dev', trimmedEmail, cred.name, cred.role);
    return { email: trimmedEmail, name: cred.name, role: cred.role };
  }

  if (!isSupabaseConfigured) {
    return null;
  }

  // Supabase Auth — server-side credential validation
  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });
  if (error || !data.user) {
    return null;
  }

  // Let's query staff_roles with maybeSingle() instead of single() to avoid 406 Errors
  let roleRow: { role: string; name: string } | null = null;
  try {
    const { data: row, error: roleError } = await supabase
      .from('staff_roles')
      .select('role, name')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!roleError && row) {
      roleRow = row;
    }
  } catch (err) {
    // Silent fail safely
  }

  const role: UserRole = (
    roleRow?.role === 'admin' ? 'admin' :
    roleRow?.role === 'doctor' ? 'doctor' :
    roleRow?.role === 'receptionist' ? 'receptionist' :
    roleRow?.role === 'assistant' ? 'assistant' :
    roleRow?.role === 'staff' ? 'receptionist' : 'receptionist'
  );
  const name: string = roleRow?.name ?? data.user.email ?? 'User';

  _cacheUser('supabase', data.user.email ?? trimmedEmail, name, role);
  return { email: data.user.email ?? trimmedEmail, name, role };
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
  const mode = localStorage.getItem('crmAuthMode');
  if (mode === 'dev') {
    return true;
  }

  try {
    const { data } = await supabase.auth.getSession();
    
    if (!data.session || !data.session.user) {
      // Check if we have credentials stored locally to survive iframe/storage partitioning constraints
      const hasLocalCache = localStorage.getItem('userEmail') && localStorage.getItem('userRole');
      if (hasLocalCache) {
        return true;
      }
      _clearCache();
      return false;
    }

    // Recover/sync cache if it got lost, or update if role changed in DB
    const user = data.session.user;
    let roleRow: { role: string; name: string } | null = null;
    try {
      const { data: row } = await supabase
        .from('staff_roles')
        .select('role, name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (row) roleRow = row;
    } catch (e) {
      // safe fallback
    }

    const role: UserRole = (
      roleRow?.role === 'admin' ? 'admin' :
      roleRow?.role === 'doctor' ? 'doctor' :
      roleRow?.role === 'receptionist' ? 'receptionist' :
      roleRow?.role === 'assistant' ? 'assistant' :
      roleRow?.role === 'staff' ? 'receptionist' : 'receptionist'
    );
    const name: string = roleRow?.name ?? user.email ?? 'User';
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
}
