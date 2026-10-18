import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** For code paths that only run when the app is configured (inside protected routes). */
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase chưa được cấu hình (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).');
  return supabase;
}

/** Throw a readable error for a failed Supabase query. */
export function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

let latestAccessToken: string | null = null;
supabase?.auth.onAuthStateChange((_event, session) => {
  latestAccessToken = session?.access_token ?? null;
});

/** Synchronous access for `pagehide` handlers that cannot await. */
export function currentAccessToken() {
  return latestAccessToken;
}
