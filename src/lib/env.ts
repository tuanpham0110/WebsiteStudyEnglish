// Public, build-time configuration. Never put secrets in VITE_* variables.
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '',
  supabaseKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || '',
  apiBase: ((import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '').replace(/\/+$/, ''),
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
