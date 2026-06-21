import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as Record<string, string | undefined>;

const supabaseUrl =
  env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? '';

const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.SUPABASE_PUBLISHABLE_KEY ??
  '';

const hasCreds = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasCreds && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — backend features (login, dashboard, appointments) will be disabled until you add them.',
  );
}

// Use a placeholder URL when creds are missing so module import doesn't throw.
// Any actual network call will fail loudly, but the public landing page renders.
export const supabase: SupabaseClient = createClient(
  hasCreds ? supabaseUrl : 'https://placeholder.supabase.co',
  hasCreds ? supabaseAnonKey : 'placeholder-anon-key',
);

export const isSupabaseConfigured = hasCreds;

// Setup a secondary client that does not persist session metadata in localStorage.
// This allows a logged-in Admin to sign-up/register a new Staff member
// without overriding the Admin's own active session credentials in standard storage.
export const signupClient: SupabaseClient = createClient(
  hasCreds ? supabaseUrl : 'https://placeholder.supabase.co',
  hasCreds ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
