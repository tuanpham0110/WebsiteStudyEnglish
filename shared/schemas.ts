import { z } from 'zod';
import {
  ASSIST_TASKS,
  CHAT_MODES,
  EXPLANATION_LANGUAGES,
  LEVELS,
  LIVE_VOICES,
  SPEAKING_TOPICS,
  WRITING_TYPES,
} from './constants';

const level = z.enum(LEVELS);
const explanationLanguage = z.enum(EXPLANATION_LANGUAGES).default('vi');
const shortText = (max: number) => z.string().trim().min(1).max(max);
const scenarioId = z.string().regex(/^[a-z0-9-]{2,60}$/);

// ---------------------------------------------------------------- requests

export const chatStreamRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  message: shortText(2000),
  mode: z.enum(CHAT_MODES).default('conversation_partner'),
  level,
  topic: z.string().trim().max(80).optional(),
  scenarioId: scenarioId.optional(),
  autoCorrect: z.boolean().default(true),
  explanationLanguage,
});
export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;

export const assistRequestSchema = z.object({
  task: z.enum(ASSIST_TASKS),
  text: shortText(2000),
  level,
  explanationLanguage,
  /** Optional: persist a translation onto this message (must belong to the caller). */
  messageId: z.uuid().optional(),
});
export type AssistRequest = z.infer<typeof assistRequestSchema>;

export const speakingStartRequestSchema = z.object({
  transport: z.enum(['realtime', 'fallback']),
  level,
  topic: z.enum(SPEAKING_TOPICS).optional(),
  scenarioId: scenarioId.optional(),
  voice: z.enum(LIVE_VOICES).optional(),
});
export type SpeakingStartRequest = z.infer<typeof speakingStartRequestSchema>;

export const speakingTurnRequestSchema = z.object({
  text: shortText(1000),
});

export const transcriptLineSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(4000),
});
export type TranscriptLine = z.infer<typeof transcriptLineSchema>;

export const speakingEndRequestSchema = z.object({
  status: z.enum(['completed', 'failed']),
  errorCode: z.string().regex(/^[a-z0-9_]{1,60}$/).optional(),
  /** Realtime transcripts come from the browser (the provider streams them to it). */
  transcript: z.array(transcriptLineSchema).max(300).optional(),
});
export type SpeakingEndRequest = z.infer<typeof speakingEndRequestSchema>;

export const writingEvaluateRequestSchema = z.object({
  text: z.string().trim().min(20).max(6000),
  type: z.enum(WRITING_TYPES),
  prompt: z.string().trim().max(500).optional(),
  level,
  explanationLanguage,
});
export type WritingEvaluateRequest = z.infer<typeof writingEvaluateRequestSchema>;

export const conversationReportRequestSchema = z.object({
  explanationLanguage,
});

export const sttRequestSchema = z.object({
  /** base64-encoded 16 kHz mono 16-bit WAV, max ~30 s */
  audio: z.string().min(100).max(1_400_000),
  mimeType: z.literal('audio/wav'),
});

export const deleteAccountRequestSchema = z.object({
  confirm: z.literal('DELETE'),
});

// ---------------------------------------------------------------- AI results

export const correctionSchema = z.object({
  hasErrors: z.boolean(),
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
  example: z.string().optional().default(''),
});
export type Correction = z.infer<typeof correctionSchema>;

export const translateResultSchema = z.object({ translation: z.string() });
export const explainVocabResultSchema = z.object({
  items: z
    .array(
      z.object({
        word: z.string(),
        partOfSpeech: z.string().optional().default(''),
        ipa: z.string().optional().default(''),
        meaningVi: z.string(),
        definitionEn: z.string().optional().default(''),
        example: z.string().optional().default(''),
      }),
    )
    .max(10),
});
export const rewriteResultSchema = z.object({
  natural: z.string(),
  alternatives: z.array(z.string()).max(3).default([]),
  explanation: z.string(),
});
export type AssistResult =
  | { task: 'translate'; result: z.infer<typeof translateResultSchema> }
  | { task: 'explain_vocab'; result: z.infer<typeof explainVocabResultSchema> }
  | { task: 'rewrite'; result: z.infer<typeof rewriteResultSchema> }
  | { task: 'grammar_check'; result: Correction };

export const writingFeedbackSchema = z.object({
  correctedText: z.string(),
  overallFeedback: z.string(),
  coherence: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string(),
  }),
  changes: z
    .array(
      z.object({
        original: z.string(),
        revised: z.string(),
        type: z.enum(['grammar', 'vocabulary', 'style', 'coherence', 'spelling', 'punctuation']),
        reason: z.string(),
      }),
    )
    .max(40),
  vocabularySuggestions: z
    .array(z.object({ original: z.string(), suggestion: z.string(), reason: z.string() }))
    .max(15)
    .default([]),
  strengths: z.array(z.string()).max(6).default([]),
});
export type WritingFeedback = z.infer<typeof writingFeedbackSchema>;

export const sessionReportSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()).max(8).default([]),
  goodSentences: z.array(z.string()).max(8).default([]),
  grammarIssues: z
    .array(z.object({ original: z.string(), corrected: z.string(), explanation: z.string() }))
    .max(12)
    .default([]),
  newVocabulary: z
    .array(z.object({ word: z.string(), meaningVi: z.string(), example: z.string().optional().default('') }))
    .max(12)
    .default([]),
  naturalAlternatives: z.array(z.object({ original: z.string(), better: z.string() })).max(8).default([]),
  nextGoals: z.array(z.string()).max(6).default([]),
});
export type SessionReport = z.infer<typeof sessionReportSchema> & {
  /** Always present: states that no acoustic pronunciation scoring was done. */
  pronunciationNote: string;
  generatedAt: string;
  basedOnTurns: number;
};

export const sttResultSchema = z.object({ transcript: z.string() });

// ---------------------------------------------------------------- API payloads

export type FeatureFlags = {
  aiText: boolean;
  aiVoice: boolean;
  textModel: string | null;
  liveModel: string | null;
};

export type UsageLimits = {
  chatPerDay: number;
  assistPerDay: number;
  evalPerDay: number;
  aiPerMinute: number;
  voiceSecondsPerDay: number;
  voiceSessionSeconds: number;
};

export type AppConfigResponse = {
  features: FeatureFlags;
  limits: UsageLimits;
  usage: {
    chat: number;
    assist: number;
    evaluation: number;
    stt: number;
    voice_sessions: number;
    voice_seconds: number;
    resets_at: string;
  };
};

export type SpeakingStartResponse =
  | {
      transport: 'realtime';
      sessionId: string;
      provider: 'gemini';
      model: string;
      token: string;
      wsUrl: string;
      /** Setup message to send after the socket opens (the token also locks it server-side). */
      setup: Record<string, unknown>;
      maxSeconds: number;
      expiresAt: string;
      voice: string;
      inputSampleRate: number;
      outputSampleRate: number;
    }
  | {
      transport: 'fallback';
      sessionId: string;
      maxSeconds: number;
      opening: string;
    };

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
