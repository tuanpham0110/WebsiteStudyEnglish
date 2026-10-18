import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../env';
import type { ConversationRow, Repo, SpeakingSessionRow } from './repo';

type SupabaseConfig = NonNullable<AppConfig['supabase']>;

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

// Admin clients carry no user session, so the secret key's service_role (BYPASSRLS)
// applies. They are cached per isolate; user clients are created per request.
const adminClients = new Map<string, SupabaseClient>();

export function adminClient(config: SupabaseConfig): SupabaseClient {
  let client = adminClients.get(config.url);
  if (!client) {
    client = createClient(config.url, config.secretKey, { auth: NO_SESSION });
    adminClients.set(config.url, client);
  }
  return client;
}

function userClient(config: SupabaseConfig, accessToken: string): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: NO_SESSION,
    accessToken: async () => accessToken,
  });
}

class DbError extends Error {
  constructor(scope: string, message: string) {
    super(`${scope}: ${message}`);
  }
}

function check<T>(scope: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new DbError(scope, result.error.message);
  return result.data;
}

function one<T>(scope: string, result: { data: T | null; error: { message: string } | null }): T {
  const data = check(scope, result);
  if (data === null) throw new DbError(scope, 'no row returned');
  return data;
}

export function createSupabaseRepo(config: SupabaseConfig, accessToken: string): Repo {
  const admin = adminClient(config);
  const db = userClient(config, accessToken);

  return {
    async consumeQuota(i) {
      return check(
        'consume_ai_quota',
        await admin.rpc('consume_ai_quota', {
          p_user: i.userId,
          p_kind: i.kind,
          p_units: i.units,
          p_requests: i.requests,
          p_user_daily_limit: i.dailyLimit,
          p_user_minute_limit: i.minuteLimit,
          p_global_daily_limit: i.globalLimit,
          p_provider: i.provider,
          p_model: i.model,
        }),
      );
    },

    async markUsageError(logId, code) {
      check('mark_usage_error', await admin.rpc('mark_usage_error', { p_log_id: logId, p_code: code }));
    },

    async startVoiceSession(i) {
      return check(
        'start_voice_session',
        await admin.rpc('start_voice_session', {
          p_user: i.userId,
          p_provider: i.provider,
          p_model: i.model,
          p_level: i.level,
          p_topic: i.topic,
          p_scenario: i.scenarioId,
          p_session_seconds: i.sessionSeconds,
          p_user_daily_seconds: i.userDailySeconds,
          p_user_minute_limit: i.minuteLimit,
          p_global_daily_seconds: i.globalDailySeconds,
          p_global_concurrent: i.globalConcurrent,
        }),
      );
    },

    async createFallbackSession(i) {
      return one(
        'create_fallback_session',
        await admin
          .from('speaking_sessions')
          .insert({
            user_id: i.userId,
            transport: 'fallback',
            provider: i.provider,
            model: i.model,
            level: i.level,
            topic: i.topic,
            scenario_id: i.scenarioId,
            max_seconds: i.maxSeconds,
          })
          .select('id')
          .single(),
      );
    },

    async finishSpeakingSession(userId, sessionId, status, errorCode) {
      return check(
        'finish_speaking_session',
        await admin.rpc('finish_speaking_session', {
          p_user: userId,
          p_session: sessionId,
          p_status: status,
          p_error_code: errorCode ?? null,
        }),
      );
    },

    async getSpeakingSession(userId, sessionId) {
      return check(
        'get_speaking_session',
        await admin
          .from('speaking_sessions')
          .select('id, user_id, transport, status, level, topic, scenario_id, max_seconds, started_at, report')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .maybeSingle(),
      ) as SpeakingSessionRow | null;
    },

    async appendTranscripts(userId, sessionId, lines) {
      if (lines.length === 0) return;
      const last = check(
        'transcript_seq',
        await admin
          .from('speaking_transcripts')
          .select('seq')
          .eq('session_id', sessionId)
          .order('seq', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as { seq: number } | null;
      const start = (last?.seq ?? -1) + 1;
      check(
        'append_transcripts',
        await admin.from('speaking_transcripts').insert(
          lines.map((line, index) => ({
            session_id: sessionId,
            user_id: userId,
            seq: start + index,
            role: line.role,
            text: line.text.slice(0, 4000),
          })),
        ),
      );
    },

    async listTranscripts(userId, sessionId) {
      const rows = check(
        'list_transcripts',
        await admin
          .from('speaking_transcripts')
          .select('role, text')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .order('seq', { ascending: true })
          .limit(400),
      );
      return (rows ?? []) as { role: 'user' | 'assistant'; text: string }[];
    },

    async saveSessionReport(userId, sessionId, report) {
      check(
        'save_session_report',
        await admin.from('speaking_sessions').update({ report }).eq('id', sessionId).eq('user_id', userId),
      );
    },

    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new DbError('delete_user', error.message);
    },

    async getConversation(id) {
      return check(
        'get_conversation',
        await db
          .from('conversations')
          .select('id, user_id, title, kind, mode, level, topic, scenario_id, auto_correct')
          .eq('id', id)
          .maybeSingle(),
      ) as ConversationRow | null;
    },

    async createConversation(input) {
      return check(
        'create_conversation',
        await db
          .from('conversations')
          .insert(input)
          .select('id, user_id, title, kind, mode, level, topic, scenario_id, auto_correct')
          .single(),
      ) as ConversationRow;
    },

    async recentMessages(conversationId, limit) {
      const rows = check(
        'recent_messages',
        await db
          .from('messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(limit),
      );
      return (rows ?? []).reverse() as Awaited<ReturnType<Repo['recentMessages']>>;
    },

    async insertMessage(input) {
      return one(
        'insert_message',
        await db
          .from('messages')
          .insert({
            conversation_id: input.conversationId,
            user_id: input.userId,
            role: input.role,
            content: input.content.slice(0, 8000),
          })
          .select('id')
          .single(),
      );
    },

    async setMessageCorrection(messageId, correction) {
      check('set_correction', await db.from('messages').update({ correction }).eq('id', messageId));
    },

    async setMessageTranslation(messageId, translation) {
      const rows = check(
        'set_translation',
        await db.from('messages').update({ translation_vi: translation.slice(0, 8000) }).eq('id', messageId).select('id'),
      );
      return (rows ?? []).length > 0;
    },

    async saveConversationReport(conversationId, report) {
      check('save_conversation_report', await db.from('conversations').update({ report }).eq('id', conversationId));
    },

    async usageToday() {
      return check('get_my_usage_today', await db.rpc('get_my_usage_today'));
    },

    async insertProgress(input) {
      check(
        'insert_progress',
        await db.from('learning_progress').insert({
          user_id: input.userId,
          activity: input.activity,
          ref_id: input.refId ?? null,
          items_count: Math.min(1000, Math.max(0, input.itemsCount ?? 0)),
          completed: input.completed ?? false,
        }),
      );
    },
  };
}
