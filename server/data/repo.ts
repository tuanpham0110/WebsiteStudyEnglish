import type { ConversationMode, Level } from '../../shared/constants';
import type { TranscriptLine } from '../../shared/schemas';

export type QuotaKind = 'chat' | 'assist' | 'evaluation' | 'stt';

export type QuotaResult = {
  allowed: boolean;
  reason?: 'user_daily' | 'rate_limited' | 'global_daily';
  log_id?: number;
  used?: number;
  limit?: number;
};

export type VoiceStartResult = {
  allowed: boolean;
  reason?: 'session_active' | 'rate_limited' | 'user_daily_voice' | 'global_concurrent' | 'global_daily_voice';
  session_id?: string;
  max_seconds?: number;
  used_seconds?: number;
  limit_seconds?: number;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  kind: 'chat' | 'roleplay';
  mode: ConversationMode;
  level: Level;
  topic: string | null;
  scenario_id: string | null;
  auto_correct: boolean;
};

export type MessageRow = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };

export type SpeakingSessionRow = {
  id: string;
  user_id: string;
  transport: 'realtime' | 'fallback';
  status: 'active' | 'completed' | 'expired' | 'failed';
  level: Level;
  topic: string | null;
  scenario_id: string | null;
  max_seconds: number;
  started_at: string;
  report: unknown;
};

export type UsageToday = {
  chat: number;
  assist: number;
  evaluation: number;
  stt: number;
  voice_sessions: number;
  voice_seconds: number;
  resets_at: string;
};

/**
 * Data access used by the API. Methods marked (RLS) run as the signed-in user,
 * so Postgres policies enforce ownership; (service) methods use the secret key
 * and always take an explicit, server-verified user id.
 */
export interface Repo {
  // (service)
  consumeQuota(input: {
    userId: string;
    kind: QuotaKind;
    units: number;
    requests: number;
    dailyLimit: number;
    minuteLimit: number;
    globalLimit: number;
    provider: string;
    model: string;
  }): Promise<QuotaResult>;
  markUsageError(logId: number, code: string): Promise<void>;
  startVoiceSession(input: {
    userId: string;
    provider: string;
    model: string;
    level: Level;
    topic: string | null;
    scenarioId: string | null;
    sessionSeconds: number;
    userDailySeconds: number;
    minuteLimit: number;
    globalDailySeconds: number;
    globalConcurrent: number;
  }): Promise<VoiceStartResult>;
  createFallbackSession(input: {
    userId: string;
    provider: string;
    model: string;
    level: Level;
    topic: string | null;
    scenarioId: string | null;
    maxSeconds: number;
  }): Promise<{ id: string }>;
  finishSpeakingSession(
    userId: string,
    sessionId: string,
    status: 'completed' | 'failed',
    errorCode?: string,
  ): Promise<{ ok: boolean; duration_seconds?: number; status?: string; reason?: string }>;
  getSpeakingSession(userId: string, sessionId: string): Promise<SpeakingSessionRow | null>;
  appendTranscripts(userId: string, sessionId: string, lines: TranscriptLine[]): Promise<void>;
  listTranscripts(userId: string, sessionId: string): Promise<TranscriptLine[]>;
  saveSessionReport(userId: string, sessionId: string, report: unknown): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;

  // (RLS)
  getConversation(id: string): Promise<ConversationRow | null>;
  createConversation(input: Omit<ConversationRow, 'id'>): Promise<ConversationRow>;
  recentMessages(conversationId: string, limit: number): Promise<MessageRow[]>;
  insertMessage(input: {
    conversationId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
  }): Promise<{ id: string }>;
  setMessageCorrection(messageId: string, correction: unknown): Promise<void>;
  setMessageTranslation(messageId: string, translation: string): Promise<boolean>;
  saveConversationReport(conversationId: string, report: unknown): Promise<void>;
  usageToday(): Promise<UsageToday>;
  insertProgress(input: {
    userId: string;
    activity: 'writing' | 'chat' | 'roleplay';
    refId?: string;
    itemsCount?: number;
    completed?: boolean;
  }): Promise<void>;
}
