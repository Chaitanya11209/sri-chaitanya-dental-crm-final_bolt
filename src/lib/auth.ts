import { supabase, isSupabaseConfigured } from './supabase';

export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'assistant';

export interface CRMUser {
  email: string;
  name: string;
  role: UserRole;
}

// Session expiry time (30 minutes of inactivity)
const SESSION_EXPIRY_MS = 30 * 60 * 1000;
const SESSION_TIMESTAMP_KEY = 'crmSessionTimestamp';

// ---------------------------------------------------------------------------
// Sync helpers — read the cached role set during login
// These are safe to call synchronously; they never grant elevated access
// if the cache is absent or contains an unexpected value.
// ---------------------------------------------------------------------------

export function isLoggedIn(): boolean {
  const mode = localStorage.getItem('crmAuthMode');
  if (!mode) return false;

  // Check session expiry for non-dev modes
  if (mode !== 'dev') {
    const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    if (timestamp) {
      const lastActivity = parseInt(timestamp, 10);
      if (Date.now() - lastActivity > SESSION_EXPIRY_MS) {
        _clearCache();
        return false;
      }
    }
  }

  return true;
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
// PRODUCTION: All authentication MUST go through Supabase Auth.
// No development bypass credentials are allowed.
// ---------------------------------------------------------------------------
export async function login(email: string, password: string): Promise<CRMUser | null> {
  const trimmedEmail = email.toLowerCase().trim();

  // Production: Supabase Auth is REQUIRED
  if (!isSupabaseConfigured) {
    console.error('[AUTH] Supabase is not configured. Authentication disabled.');
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

  // CRITICAL: User MUST exist in staff_roles table to access CRM
  // This prevents unauthorized Supabase Auth users from accessing the system
  const { data: roleRow, error: roleError } = await supabase
    .from('staff_roles')
    .select('role, name, status')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (roleError || !roleRow) {
    // User exists in Auth but NOT in staff_roles - immediately sign out
    console.warn('[AUTH] User authenticated but not in staff_roles. Access denied.');
    await supabase.auth.signOut();
    return null;
  }

  // Check if user account is active
  if (roleRow.status === 'Inactive') {
    console.warn('[AUTH] User account is inactive. Access denied.');
    await supabase.auth.signOut();
    return null;
  }

  // Validate role
  const validRoles = ['admin', 'doctor', 'receptionist', 'assistant', 'staff'];
  if (!roleRow.role || !validRoles.includes(roleRow.role)) {
    console.warn('[AUTH] Invalid role assigned:', roleRow.role);
    await supabase.auth.signOut();
    return null;
  }

  const role: UserRole = roleRow.role === 'staff' ? 'receptionist' : roleRow.role as UserRole;
  const name: string = roleRow.name ?? data.user.email ?? 'User';

  _cacheUser('supabase', data.user.email ?? trimmedEmail, name, role);
  _updateSessionTimestamp();

  return { email: data.user.email ?? trimmedEmail, name, role };
}

// ---------------------------------------------------------------------------
// Async logout
// ---------------------------------------------------------------------------
export async function logout(): Promise<void> {
  await supabase.auth.signOut().catch(() => {});
  _clearCache();
}

// ---------------------------------------------------------------------------
// Async session validation — call from CRMLayout on mount to verify that
// any Supabase session stored in the browser is still valid server-side.
// CRITICAL: Always validates against server - NO localStorage bypass.
// ---------------------------------------------------------------------------
export async function validateSession(): Promise<boolean> {
  const mode = localStorage.getItem('crmAuthMode');

  // No cached session
  if (!mode) {
    return false;
  }

  // Check session expiry
  const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  if (timestamp) {
    const lastActivity = parseInt(timestamp, 10);
    if (Date.now() - lastActivity > SESSION_EXPIRY_MS) {
      _clearCache();
      return false;
    }
  }

  try {
    const { data } = await supabase.auth.getSession();

    // No valid Supabase session - deny access
    if (!data.session || !data.session.user) {
      _clearCache();
      return false;
    }

    const user = data.session.user;

    // CRITICAL: Re-validate user exists in staff_roles with valid role
    const { data: roleRow, error: roleError } = await supabase
      .from('staff_roles')
      .select('role, name, status')
      .eq('user_id', user.id)
      .maybeSingle();

    // User not in staff_roles or query failed - deny access
    if (roleError || !roleRow) {
      console.warn('[AUTH] Session validation failed: user not in staff_roles');
      _clearCache();
      await supabase.auth.signOut();
      return false;
    }

    // Check if account is still active
    if (roleRow.status === 'Inactive') {
      console.warn('[AUTH] Session validation failed: account inactive');
      _clearCache();
      await supabase.auth.signOut();
      return false;
    }

    // Validate role
    const validRoles = ['admin', 'doctor', 'receptionist', 'assistant', 'staff'];
    if (!roleRow.role || !validRoles.includes(roleRow.role)) {
      console.warn('[AUTH] Session validation failed: invalid role');
      _clearCache();
      await supabase.auth.signOut();
      return false;
    }

    const role: UserRole = roleRow.role === 'staff' ? 'receptionist' : roleRow.role as UserRole;
    const name: string = roleRow.name ?? user.email ?? 'User';

    // Update cache with latest server data
    _cacheUser('supabase', user.email ?? '', name, role);
    _updateSessionTimestamp();

    return true;
  } catch (err) {
    console.error('[AUTH] Session validation error:', err);
    // On error, deny access - no fallback to localStorage cache
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

function _updateSessionTimestamp() {
  localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
}

function _clearCache() {
  ['crmAuthMode', 'userEmail', 'userName', 'userRole', 'adminLoggedIn', SESSION_TIMESTAMP_KEY].forEach(k =>
    localStorage.removeItem(k)
  );
}
