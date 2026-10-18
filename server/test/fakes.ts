import type { ChatTurn, OutputSchema, Providers, RealtimeVoiceProvider, TextChatProvider, TextRequest } from '../ai/types';
import { createApp, type AppDeps } from '../app';
import type { AuthUser } from '../auth';
import type { ConversationRow, MessageRow, Repo, SpeakingSessionRow } from '../data/repo';
import { loadConfig, type Env } from '../env';
import { ProviderError } from '../errors';
import type { TranscriptLine } from '../../shared/schemas';

export const USERS: Record<string, AuthUser> = {
  'token-a': { id: '11111111-1111-4111-8111-111111111111', email: 'a@example.com' },
  'token-b': { id: '22222222-2222-4222-8222-222222222222', email: 'b@example.com' },
};

/** In-memory store mirroring the ownership rules enforced by RLS in Postgres. */
export class FakeDb {
  conversations = new Map<string, ConversationRow>();
  messages: (MessageRow & { conversation_id: string; user_id: string; correction?: unknown; translation_vi?: string })[] = [];
  sessions = new Map<string, SpeakingSessionRow & { duration_seconds?: number; error_code?: string }>();
  transcripts: (TranscriptLine & { session_id: string; user_id: string; seq: number })[] = [];
  usage: { id: number; user_id: string; kind: string; status: 'ok' | 'error'; code?: string }[] = [];
  progress: { user_id: string; activity: string }[] = [];
  deletedUsers: string[] = [];
  quotaOverride: { allowed: boolean; reason?: string } | null = null;
  voiceOverride: { allowed: boolean; reason?: string } | null = null;
  private seq = 0;

  id() {
    this.seq += 1;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }

  repoFor(token: string): Repo {
    const user = USERS[token];
    const db = this;
    const ownConversation = (id: string) => {
      const c = db.conversations.get(id);
      return c && c.user_id === user.id ? c : null;
    };
    return {
      async consumeQuota(i) {
        if (db.quotaOverride) return db.quotaOverride as never;
        const used = db.usage.filter((u) => u.user_id === i.userId && u.kind === i.kind && u.status === 'ok').length;
        if (used + i.units > i.dailyLimit) return { allowed: false, reason: 'user_daily', used, limit: i.dailyLimit };
        const id = db.usage.length + 1;
        db.usage.push({ id, user_id: i.userId, kind: i.kind, status: 'ok' });
        return { allowed: true, log_id: id, used: used + 1, limit: i.dailyLimit };
      },
      async markUsageError(logId, code) {
        const row = db.usage.find((u) => u.id === logId);
        if (row) Object.assign(row, { status: 'error', code });
      },
      async startVoiceSession(i) {
        if (db.voiceOverride) return db.voiceOverride as never;
        if ([...db.sessions.values()].some((s) => s.user_id === i.userId && s.status === 'active' && s.transport === 'realtime')) {
          return { allowed: false, reason: 'session_active' };
        }
        const id = db.id();
        db.sessions.set(id, {
          id,
          user_id: i.userId,
          transport: 'realtime',
          status: 'active',
          level: i.level,
          topic: i.topic,
          scenario_id: i.scenarioId,
          max_seconds: i.sessionSeconds,
          started_at: new Date().toISOString(),
          report: null,
        });
        return { allowed: true, session_id: id, max_seconds: i.sessionSeconds };
      },
      async createFallbackSession(i) {
        const id = db.id();
        db.sessions.set(id, {
          id,
          user_id: i.userId,
          transport: 'fallback',
          status: 'active',
          level: i.level,
          topic: i.topic,
          scenario_id: i.scenarioId,
          max_seconds: i.maxSeconds,
          started_at: new Date().toISOString(),
          report: null,
        });
        return { id };
      },
      async finishSpeakingSession(userId, sessionId, status, errorCode) {
        const s = db.sessions.get(sessionId);
        if (!s || s.user_id !== userId) return { ok: false, reason: 'not_found' };
        if (s.status !== 'active') return { ok: true, duration_seconds: s.duration_seconds, status: s.status };
        Object.assign(s, { status, duration_seconds: 42, error_code: errorCode });
        return { ok: true, duration_seconds: 42, status };
      },
      async getSpeakingSession(userId, sessionId) {
        const s = db.sessions.get(sessionId);
        return s && s.user_id === userId ? s : null;
      },
      async appendTranscripts(userId, sessionId, lines) {
        const start = db.transcripts.filter((t) => t.session_id === sessionId).length;
        lines.forEach((l, i) => db.transcripts.push({ ...l, session_id: sessionId, user_id: userId, seq: start + i }));
      },
      async listTranscripts(userId, sessionId) {
        return db.transcripts
          .filter((t) => t.session_id === sessionId && t.user_id === userId)
          .map(({ role, text }) => ({ role, text }));
      },
      async saveSessionReport(userId, sessionId, report) {
        const s = db.sessions.get(sessionId);
        if (s && s.user_id === userId) s.report = report;
      },
      async deleteAuthUser(userId) {
        db.deletedUsers.push(userId);
      },
      async getConversation(id) {
        return ownConversation(id);
      },
      async createConversation(input) {
        if (input.user_id !== user.id) throw new Error('RLS violation');
        const row = { ...input, id: db.id() };
        db.conversations.set(row.id, row);
        return row;
      },
      async recentMessages(conversationId, limit) {
        if (!ownConversation(conversationId)) return [];
        return db.messages.filter((m) => m.conversation_id === conversationId).slice(-limit);
      },
      async insertMessage(input) {
        if (!ownConversation(input.conversationId) || input.userId !== user.id) throw new Error('RLS violation');
        const row = {
          id: db.id(),
          conversation_id: input.conversationId,
          user_id: input.userId,
          role: input.role,
          content: input.content,
          created_at: new Date().toISOString(),
        };
        db.messages.push(row);
        return { id: row.id };
      },
      async setMessageCorrection(messageId, correction) {
        const m = db.messages.find((x) => x.id === messageId && x.user_id === user.id);
        if (m) m.correction = correction;
      },
      async setMessageTranslation(messageId, translation) {
        const m = db.messages.find((x) => x.id === messageId && x.user_id === user.id);
        if (m) m.translation_vi = translation;
        return Boolean(m);
      },
      async saveConversationReport() {},
      async usageToday() {
        return { chat: 0, assist: 0, evaluation: 0, stt: 0, voice_sessions: 0, voice_seconds: 0, resets_at: new Date().toISOString() };
      },
      async insertProgress(input) {
        db.progress.push({ user_id: input.userId, activity: input.activity });
      },
    };
  }
}

export class FakeText implements TextChatProvider {
  readonly name = 'fake';
  readonly model = 'fake-model';
  calls: TextRequest[] = [];
  jsonCalls: { system: string; prompt: string; schema: OutputSchema }[] = [];
  reply = ['Nice to ', 'meet you! ', 'What do you do?'];
  streamError: Error | null = null;
  json: unknown = { hasErrors: true, original: 'I goes', corrected: 'I go', explanation: 'Chủ ngữ I dùng go.', example: 'I go to school.' };

  async *streamChat(request: TextRequest) {
    this.calls.push(request);
    if (this.streamError) throw this.streamError;
    for (const part of this.reply) yield part;
  }
  async complete(request: TextRequest) {
    this.calls.push(request);
    if (this.streamError) throw this.streamError;
    return this.reply.join('');
  }
  async generateJson(request: { system: string; prompt: string; schema: OutputSchema }) {
    this.jsonCalls.push(request);
    if (this.json instanceof Error) throw this.json;
    return this.json;
  }
}

export class FakeLive implements RealtimeVoiceProvider {
  readonly name = 'gemini';
  readonly model = 'gemini-3.8-live';
  fail = false;
  requests: { systemInstruction: string; voice: string; maxSeconds: number }[] = [];
  async createSession(request: { systemInstruction: string; voice: string; maxSeconds: number }) {
    this.requests.push(request);
    if (this.fail) throw new ProviderError('unavailable', 'boom');
    return {
      token: 'auth_tokens/fake',
      wsUrl: 'wss://example.test/ws',
      setup: { model: `models/${this.model}` },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      inputSampleRate: 16000,
      outputSampleRate: 24000,
    };
  }
}

export function makeTestApp(options: { env?: Env; providers?: Partial<Providers>; noDb?: boolean } = {}) {
  const db = new FakeDb();
  const text = new FakeText();
  const live = new FakeLive();
  const env: Env = {
    GEMINI_API_KEY: 'test-key',
    AI_TEXT_ENABLED: 'true',
    AI_VOICE_ENABLED: 'true',
    ALLOWED_ORIGINS: 'https://englishai.pages.dev,https://*.englishai.pages.dev',
    ...options.env,
  };
  const config = loadConfig(env);
  const deps: AppDeps = {
    config,
    verifyToken: options.noDb ? null : async (token) => USERS[token] ?? null,
    repoFor: options.noDb ? null : (token) => db.repoFor(token),
    providers: { text: config.aiTextEnabled ? text : null, live: config.aiVoiceEnabled ? live : null, stt: null, ...options.providers },
  };
  const app = createApp(() => deps);
  const request = (path: string, init: RequestInit & { token?: string; json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
    if (init.json !== undefined) headers.set('Content-Type', 'application/json');
    return app.request(`http://localhost${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    }) as Promise<Omit<Response, 'json'> & { json(): Promise<any> }>;
  };
  return { app, db, text, live, request, config };
}

/** Collect SSE events from a streamed Response. */
export async function readSse(response: Pick<Response, 'text'>) {
  const raw = await response.text();
  return raw
    .split(/\n\n/)
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      return event && data ? { event, data: JSON.parse(data) as Record<string, unknown> } : null;
    })
    .filter((x): x is { event: string; data: Record<string, unknown> } => x !== null);
}

export const history = (turns: ChatTurn[]) => turns;
