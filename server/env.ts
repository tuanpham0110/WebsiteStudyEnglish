// Runtime configuration for the API (Cloudflare Pages Functions bindings).
// Secrets come from `wrangler pages secret put` / the dashboard; plain vars from wrangler.toml.

export type Env = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  GEMINI_API_KEY?: string;

  ALLOWED_ORIGINS?: string;
  AI_TEXT_ENABLED?: string;
  AI_VOICE_ENABLED?: string;
  GEMINI_TEXT_MODEL?: string;
  GEMINI_LIVE_MODEL?: string;
  GEMINI_LIVE_API_VERSION?: string;
  GEMINI_THINKING_LEVEL?: string;

  LIMIT_CHAT_PER_DAY?: string;
  LIMIT_ASSIST_PER_DAY?: string;
  LIMIT_EVAL_PER_DAY?: string;
  LIMIT_AI_PER_MINUTE?: string;
  LIMIT_VOICE_SECONDS_PER_DAY?: string;
  LIMIT_VOICE_SESSION_SECONDS?: string;
  LIMIT_GLOBAL_AI_PER_DAY?: string;
  LIMIT_GLOBAL_VOICE_SECONDS_PER_DAY?: string;
  LIMIT_VOICE_CONCURRENT_GLOBAL?: string;
};

export type Limits = {
  chatPerDay: number;
  assistPerDay: number;
  evalPerDay: number;
  aiPerMinute: number;
  voiceSecondsPerDay: number;
  voiceSessionSeconds: number;
  globalAiPerDay: number;
  globalVoiceSecondsPerDay: number;
  voiceConcurrentGlobal: number;
};

export type AppConfig = {
  supabase: { url: string; publishableKey: string; secretKey: string } | null;
  gemini: {
    apiKey: string;
    textModel: string;
    liveModel: string;
    liveApiVersion: 'v1beta' | 'v1alpha';
    thinkingLevel: string | null;
  } | null;
  aiTextEnabled: boolean;
  aiVoiceEnabled: boolean;
  allowedOrigins: string[];
  limits: Limits;
};

const MODEL_ID = /^[a-z0-9][a-z0-9.\-]{2,80}$/;

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function flag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function loadConfig(env: Env): AppConfig {
  const supabase =
    env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY
      ? {
          url: env.SUPABASE_URL.replace(/\/+$/, ''),
          publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
          secretKey: env.SUPABASE_SECRET_KEY,
        }
      : null;

  const textModel = env.GEMINI_TEXT_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const liveModel = env.GEMINI_LIVE_MODEL?.trim() || 'gemini-3.8-live';
  const gemini = env.GEMINI_API_KEY
    ? {
        apiKey: env.GEMINI_API_KEY,
        textModel: MODEL_ID.test(textModel) ? textModel : 'gemini-3.5-flash-lite',
        liveModel: MODEL_ID.test(liveModel) ? liveModel : 'gemini-3.8-live',
        liveApiVersion: env.GEMINI_LIVE_API_VERSION === 'v1alpha' ? ('v1alpha' as const) : ('v1beta' as const),
        thinkingLevel: /^(minimal|low|medium|high)$/.test(env.GEMINI_THINKING_LEVEL ?? '') ? env.GEMINI_THINKING_LEVEL! : null,
      }
    : null;

  return {
    supabase,
    gemini,
    // A feature is only on when explicitly enabled AND its provider is configured.
    aiTextEnabled: flag(env.AI_TEXT_ENABLED) && gemini !== null,
    aiVoiceEnabled: flag(env.AI_VOICE_ENABLED) && gemini !== null,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    limits: {
      chatPerDay: int(env.LIMIT_CHAT_PER_DAY, 60, 0, 10_000),
      assistPerDay: int(env.LIMIT_ASSIST_PER_DAY, 40, 0, 10_000),
      evalPerDay: int(env.LIMIT_EVAL_PER_DAY, 15, 0, 10_000),
      aiPerMinute: int(env.LIMIT_AI_PER_MINUTE, 8, 1, 600),
      voiceSecondsPerDay: int(env.LIMIT_VOICE_SECONDS_PER_DAY, 900, 0, 86_400),
      // Kept under the provider's ~10 minute connection lifetime so no resumption is needed.
      voiceSessionSeconds: int(env.LIMIT_VOICE_SESSION_SECONDS, 300, 60, 540),
      globalAiPerDay: int(env.LIMIT_GLOBAL_AI_PER_DAY, 900, 0, 1_000_000),
      globalVoiceSecondsPerDay: int(env.LIMIT_GLOBAL_VOICE_SECONDS_PER_DAY, 7200, 0, 10_000_000),
      voiceConcurrentGlobal: int(env.LIMIT_VOICE_CONCURRENT_GLOBAL, 3, 0, 1000),
    },
  };
}
