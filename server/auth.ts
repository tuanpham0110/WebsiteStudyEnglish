import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from './env';

export type AuthUser = { id: string; email: string | null };

// One verifier client per isolate so the JWKS stays cached between requests.
const verifiers = new Map<string, SupabaseClient>();

/**
 * Verify a Supabase access token. `getClaims` checks the signature locally against the
 * project's JWKS (asymmetric signing keys) and falls back to the Auth server for legacy
 * HS256 projects. The user id comes only from the verified token, never from the body.
 */
export function createTokenVerifier(config: NonNullable<AppConfig['supabase']>) {
  let client = verifiers.get(config.url);
  if (!client) {
    client = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    verifiers.set(config.url, client);
  }
  const verifier = client;

  return async function verify(token: string): Promise<AuthUser | null> {
    if (!token || token.split('.').length !== 3) return null;
    const { data, error } = await verifier.auth.getClaims(token);
    if (error || !data?.claims) return null;
    const claims = data.claims as { sub?: string; role?: string; email?: string; is_anonymous?: boolean };
    if (!claims.sub || claims.role !== 'authenticated' || claims.is_anonymous) return null;
    return { id: claims.sub, email: claims.email ?? null };
  };
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
