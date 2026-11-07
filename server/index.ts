import { createProviders } from './ai/registry';
import { createApp, type AppDeps } from './app';
import { createTokenVerifier } from './auth';
import { adminClient, createSupabaseRepo } from './data/supabase-repo';
import { loadConfig, type Env } from './env';

/** Production wiring: real Supabase + configured AI providers. */
export function productionDeps(env: Env): AppDeps {
    const config = loadConfig(env);
    const supabase = config.supabase;
    return {
        config,
        verifyToken: supabase ? createTokenVerifier(supabase) : null,
        repoFor: supabase ? (token) => createSupabaseRepo(supabase, token) : null,
        providers: createProviders(config),
        checkDatabase: async () => {
            if (!supabase) return false;
            const result = await adminClient(supabase).from('lessons').select('id').limit(1).abortSignal(AbortSignal.timeout(5000));
            return result.error === null;
        },
    };
}

export const app = createApp(productionDeps);
