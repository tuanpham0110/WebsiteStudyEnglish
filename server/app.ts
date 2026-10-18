import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { z } from 'zod';
import { getScenario } from '../shared/roleplay';
import {
  assistRequestSchema,
  chatStreamRequestSchema,
  conversationReportRequestSchema,
  deleteAccountRequestSchema,
  speakingEndRequestSchema,
  speakingStartRequestSchema,
  speakingTurnRequestSchema,
  sttRequestSchema,
  writingEvaluateRequestSchema,
  type AppConfigResponse,
  type SpeakingStartResponse,
} from '../shared/schemas';
import { chatSystemPrompt, roleplaySystemPrompt, speakingSystemPrompt } from './ai/prompts';
import type { ChatTurn, Providers, TextChatProvider } from './ai/types';
import { bearerToken, type AuthUser } from './auth';
import type { QuotaKind, QuotaResult, Repo, VoiceStartResult } from './data/repo';
import type { AppConfig, Env } from './env';
import { ApiError, logError, ProviderError, toApiError } from './errors';
import { EnglishEvaluationService } from './services/evaluation';

export type AppDeps = {
  config: AppConfig;
  verifyToken: ((token: string) => Promise<AuthUser | null>) | null;
  repoFor: ((token: string) => Repo) | null;
  providers: Providers;
};

type Vars = { deps: AppDeps; user: AuthUser; repo: Repo };
type AppEnv = { Bindings: Env; Variables: Vars };
type Ctx = Context<AppEnv>;

const HISTORY_LIMIT = 20;
const FALLBACK_SESSION_SECONDS = 1800;

export function createApp(resolveDeps: (env: Env) => AppDeps) {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use('*', async (c, next) => {
    c.set('deps', resolveDeps(c.env ?? {}));
    await next();
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
  });

  // CORS: same-origin requests (Pages serves the SPA and the API together) plus an explicit allowlist.
  app.use('*', async (c, next) => {
    const origin = c.req.header('Origin');
    const allowed = !origin || isAllowedOrigin(origin, c.req.url, c.get('deps').config.allowedOrigins);
    if (!allowed) {
      throw new ApiError('FORBIDDEN', 'Origin không được phép.');
    }
    return cors({
      origin: (o) => (o && allowed ? o : ''),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    })(c, next);
  });

  app.onError((error, c) => {
    const apiError = toApiError(error);
    if (apiError.code === 'INTERNAL' || apiError.code === 'PROVIDER_ERROR') logError(`${c.req.method} ${c.req.path}`, error);
    return c.json(apiError.toBody(), apiError.status as 400);
  });
  app.notFound((c) => c.json(new ApiError('NOT_FOUND', 'Không tìm thấy endpoint.').toBody(), 404));

  // ------------------------------------------------------------ public
  app.get('/health', (c) => {
    const { config } = c.get('deps');
    return c.json({
      ok: true,
      database: config.supabase !== null,
      features: { aiText: config.aiTextEnabled, aiVoice: config.aiVoiceEnabled },
    });
  });

  // ------------------------------------------------------------ authenticated
  const authed = new Hono<AppEnv>();
  authed.use('*', async (c, next) => {
    const { verifyToken, repoFor } = c.get('deps');
    if (!verifyToken || !repoFor) {
      throw new ApiError('FEATURE_DISABLED', 'Máy chủ chưa được cấu hình cơ sở dữ liệu (Supabase).');
    }
    const token = bearerToken(c.req.header('Authorization'));
    const user = token ? await verifyToken(token) : null;
    if (!token || !user) throw new ApiError('UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    c.set('user', user);
    c.set('repo', repoFor(token));
    await next();
  });

  authed.get('/config', async (c) => {
    const { config } = c.get('deps');
    const usage = await c.get('repo').usageToday();
    const body: AppConfigResponse = {
      features: {
        aiText: config.aiTextEnabled,
        aiVoice: config.aiVoiceEnabled,
        textModel: config.aiTextEnabled ? config.gemini?.textModel ?? null : null,
        liveModel: config.aiVoiceEnabled ? config.gemini?.liveModel ?? null : null,
      },
      limits: {
        chatPerDay: config.limits.chatPerDay,
        assistPerDay: config.limits.assistPerDay,
        evalPerDay: config.limits.evalPerDay,
        aiPerMinute: config.limits.aiPerMinute,
        voiceSecondsPerDay: config.limits.voiceSecondsPerDay,
        voiceSessionSeconds: config.limits.voiceSessionSeconds,
      },
      usage,
    };
    return c.json(body);
  });

  // ---- AI chat (streaming)
  authed.post('/chat/stream', async (c) => {
    const text = requireText(c);
    const body = await parseJson(c, chatStreamRequestSchema, 16_000);
    const user = c.get('user');
    const repo = c.get('repo');
    const evaluation = new EnglishEvaluationService(text);

    let conversation = body.conversationId ? await repo.getConversation(body.conversationId) : null;
    if (body.conversationId && !conversation) throw new ApiError('NOT_FOUND', 'Không tìm thấy hội thoại.');
    const scenario = getScenario(conversation?.scenario_id ?? body.scenarioId);
    if (body.scenarioId && !scenario) throw new ApiError('VALIDATION_ERROR', 'Tình huống nhập vai không tồn tại.');

    const quota = await consumeQuota(c, 'chat', body.autoCorrect ? 2 : 1, text);

    if (!conversation) {
      conversation = await repo.createConversation({
        user_id: user.id,
        title: scenario ? scenario.title : titleFrom(body.message),
        kind: scenario ? 'roleplay' : 'chat',
        mode: scenario ? 'roleplay' : body.mode,
        level: body.level,
        topic: body.topic || null,
        scenario_id: scenario?.id ?? null,
        auto_correct: body.autoCorrect,
      });
    }
    const conversationId = conversation.id;
    const history: ChatTurn[] = (await repo.recentMessages(conversationId, HISTORY_LIMIT)).map((m) => ({
      role: m.role,
      text: m.content,
    }));
    if (scenario && history.length === 0) history.push({ role: 'assistant', text: scenario.opening });
    const userMessage = await repo.insertMessage({ conversationId, userId: user.id, role: 'user', content: body.message });
    history.push({ role: 'user', text: body.message });

    const system = scenario
      ? roleplaySystemPrompt({ scenario, level: body.level, forVoice: false })
      : chatSystemPrompt({
          mode: conversation.mode === 'roleplay' ? body.mode : conversation.mode,
          level: body.level,
          topic: body.topic ?? conversation.topic,
          explanationLanguage: body.explanationLanguage,
          autoCorrect: body.autoCorrect,
        });

    // The correction runs in parallel with the streamed reply and never blocks it.
    const correctionPromise = body.autoCorrect
      ? evaluation.correctMessage(body.message, body.level, body.explanationLanguage).catch((error) => {
          logError('correction', error);
          return null;
        })
      : Promise.resolve(null);

    const abort = new AbortController();
    return streamSSE(c, async (stream) => {
      stream.onAbort(() => abort.abort());
      await stream.writeSSE({ event: 'meta', data: JSON.stringify({ conversationId, userMessageId: userMessage.id }) });
      let reply = '';
      try {
        for await (const delta of text.streamChat({ system, history, maxOutputTokens: 1024, signal: abort.signal })) {
          reply += delta;
          await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text: delta }) });
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          if (error instanceof ProviderError && quota.log_id) await safe(() => repo.markUsageError(quota.log_id!, error.kind));
          const apiError = toApiError(error);
          if (apiError.code !== 'PROVIDER_QUOTA') logError('chat_stream', error);
          await stream.writeSSE({ event: 'error', data: JSON.stringify(apiError.toBody().error) });
        }
      }
      let assistantMessageId: string | null = null;
      if (reply.trim()) {
        assistantMessageId = (
          await repo.insertMessage({ conversationId, userId: user.id, role: 'assistant', content: reply.trim() })
        ).id;
      }
      const correction = await correctionPromise;
      if (correction) {
        await safe(() => repo.setMessageCorrection(userMessage.id, correction));
        if (!abort.signal.aborted) {
          await stream.writeSSE({ event: 'correction', data: JSON.stringify({ messageId: userMessage.id, correction }) });
        }
      }
      if (!abort.signal.aborted) {
        await stream.writeSSE({ event: 'done', data: JSON.stringify({ assistantMessageId }) });
      }
    });
  });

  // ---- one-shot helpers: translate / explain vocabulary / rewrite / grammar check
  authed.post('/ai/assist', async (c) => {
    const text = requireText(c);
    const body = await parseJson(c, assistRequestSchema, 8_000);
    const result = await withQuota(c, 'assist', 1, text, () =>
      new EnglishEvaluationService(text).assist(body.task, body.text, body.level, body.explanationLanguage),
    );
    if (result.task === 'translate' && body.messageId) {
      await safe(() => c.get('repo').setMessageTranslation(body.messageId!, result.result.translation));
    }
    return c.json(result);
  });

  // ---- writing feedback
  authed.post('/writing/evaluate', async (c) => {
    const text = requireText(c);
    const body = await parseJson(c, writingEvaluateRequestSchema, 32_000);
    const feedback = await withQuota(c, 'evaluation', 1, text, () =>
      new EnglishEvaluationService(text).evaluateWriting({
        text: body.text,
        type: body.type,
        prompt: body.prompt,
        level: body.level,
        language: body.explanationLanguage,
      }),
    );
    await safe(() =>
      c.get('repo').insertProgress({
        userId: c.get('user').id,
        activity: 'writing',
        refId: body.type,
        itemsCount: body.text.split(/\s+/).filter(Boolean).length,
        completed: true,
      }),
    );
    return c.json(feedback);
  });

  // ---- end-of-conversation report (chat & roleplay)
  authed.post('/conversations/:id/report', async (c) => {
    const text = requireText(c);
    const body = await parseJson(c, conversationReportRequestSchema, 1_000);
    const repo = c.get('repo');
    const id = uuidParam(c);
    const conversation = await repo.getConversation(id);
    if (!conversation) throw new ApiError('NOT_FOUND', 'Không tìm thấy hội thoại.');
    const messages = await repo.recentMessages(id, 80);
    if (messages.filter((m) => m.role === 'user').length < 2) {
      throw new ApiError('VALIDATION_ERROR', 'Cần ít nhất 2 tin nhắn của bạn để tạo báo cáo.');
    }
    const report = await withQuota(c, 'evaluation', 1, text, () =>
      new EnglishEvaluationService(text).sessionReport({
        lines: messages.map((m) => ({ role: m.role, text: m.content })),
        level: conversation.level,
        language: body.explanationLanguage,
        source: 'chat',
      }),
    );
    await repo.saveConversationReport(id, report);
    if (conversation.kind === 'roleplay') {
      await safe(() => repo.insertProgress({ userId: c.get('user').id, activity: 'roleplay', refId: conversation.scenario_id ?? undefined, completed: true }));
    }
    return c.json(report);
  });

  // ---- speaking sessions
  authed.post('/speaking/sessions', async (c) => {
    const { config, providers } = c.get('deps');
    const body = await parseJson(c, speakingStartRequestSchema, 2_000);
    const user = c.get('user');
    const repo = c.get('repo');
    const scenario = getScenario(body.scenarioId);
    if (body.scenarioId && !scenario) throw new ApiError('VALIDATION_ERROR', 'Tình huống nhập vai không tồn tại.');

    if (body.transport === 'fallback') {
      const text = requireText(c);
      const session = await repo.createFallbackSession({
        userId: user.id,
        provider: `${text.name}+browser-speech`,
        model: text.model,
        level: body.level,
        topic: body.topic ?? null,
        scenarioId: scenario?.id ?? null,
        maxSeconds: FALLBACK_SESSION_SECONDS,
      });
      const opening = scenario?.opening ?? openingLine(body.topic);
      await repo.appendTranscripts(user.id, session.id, [{ role: 'assistant', text: opening }]);
      const response: SpeakingStartResponse = {
        transport: 'fallback',
        sessionId: session.id,
        maxSeconds: FALLBACK_SESSION_SECONDS,
        opening,
      };
      return c.json(response);
    }

    const live = providers.live;
    if (!config.aiVoiceEnabled || !live) {
      throw new ApiError('FEATURE_DISABLED', 'Luyện nói realtime chưa được bật trên máy chủ. Bạn có thể dùng chế độ dự phòng.');
    }
    const voice = body.voice ?? 'Kore';
    const start = await repo.startVoiceSession({
      userId: user.id,
      provider: live.name,
      model: live.model,
      level: body.level,
      topic: body.topic ?? null,
      scenarioId: scenario?.id ?? null,
      sessionSeconds: config.limits.voiceSessionSeconds,
      userDailySeconds: config.limits.voiceSecondsPerDay,
      minuteLimit: config.limits.aiPerMinute,
      globalDailySeconds: config.limits.globalVoiceSecondsPerDay,
      globalConcurrent: config.limits.voiceConcurrentGlobal,
    });
    if (!start.allowed || !start.session_id || !start.max_seconds) throw voiceQuotaError(start);

    const systemInstruction = scenario
      ? roleplaySystemPrompt({ scenario, level: body.level, forVoice: true })
      : speakingSystemPrompt({ level: body.level, topic: body.topic, forVoice: true });
    try {
      const grant = await live.createSession({ systemInstruction, voice, maxSeconds: start.max_seconds });
      const response: SpeakingStartResponse = {
        transport: 'realtime',
        sessionId: start.session_id,
        provider: 'gemini',
        model: live.model,
        token: grant.token,
        wsUrl: grant.wsUrl,
        setup: grant.setup,
        maxSeconds: start.max_seconds,
        expiresAt: grant.expiresAt,
        voice,
        inputSampleRate: grant.inputSampleRate,
        outputSampleRate: grant.outputSampleRate,
      };
      return c.json(response);
    } catch (error) {
      await safe(() => repo.finishSpeakingSession(user.id, start.session_id!, 'failed', 'token_error'));
      throw error;
    }
  });

  // Fallback mode only: one text turn (browser STT → AI text → browser TTS).
  authed.post('/speaking/sessions/:id/turn', async (c) => {
    const text = requireText(c);
    const body = await parseJson(c, speakingTurnRequestSchema, 4_000);
    const user = c.get('user');
    const repo = c.get('repo');
    const session = await repo.getSpeakingSession(user.id, uuidParam(c));
    if (!session) throw new ApiError('NOT_FOUND', 'Không tìm thấy phiên luyện nói.');
    if (session.transport !== 'fallback' || session.status !== 'active') {
      throw new ApiError('VALIDATION_ERROR', 'Phiên này không nhận lượt nói văn bản.');
    }
    if (Date.now() - Date.parse(session.started_at) > session.max_seconds * 1000) {
      throw new ApiError('QUOTA_EXCEEDED', 'Phiên luyện nói đã hết thời lượng cho phép.');
    }
    const history = (await repo.listTranscripts(user.id, session.id)).slice(-HISTORY_LIMIT);
    const scenario = getScenario(session.scenario_id);
    const system = scenario
      ? roleplaySystemPrompt({ scenario, level: session.level, forVoice: true })
      : speakingSystemPrompt({ level: session.level, topic: session.topic, forVoice: false });
    const reply = await withQuota(c, 'chat', 1, text, () =>
      text.complete({ system, history: [...history, { role: 'user', text: body.text }], maxOutputTokens: 400 }),
    );
    const clean = stripForSpeech(reply);
    await repo.appendTranscripts(user.id, session.id, [
      { role: 'user', text: body.text },
      { role: 'assistant', text: clean },
    ]);
    return c.json({ reply: clean });
  });

  authed.post('/speaking/sessions/:id/end', async (c) => {
    const body = await parseJson(c, speakingEndRequestSchema, 400_000);
    const user = c.get('user');
    const repo = c.get('repo');
    const session = await repo.getSpeakingSession(user.id, uuidParam(c));
    if (!session) throw new ApiError('NOT_FOUND', 'Không tìm thấy phiên luyện nói.');
    if (session.transport === 'realtime' && body.transcript?.length) {
      const existing = await repo.listTranscripts(user.id, session.id);
      if (existing.length === 0) await repo.appendTranscripts(user.id, session.id, body.transcript);
    }
    const result = await repo.finishSpeakingSession(user.id, session.id, body.status, body.errorCode);
    if (!result.ok) throw new ApiError('NOT_FOUND', 'Không tìm thấy phiên luyện nói.');
    return c.json({ durationSeconds: result.duration_seconds ?? 0, status: result.status });
  });

  authed.post('/speaking/sessions/:id/report', async (c) => {
    const text = requireText(c);
    const body = await parseJson(c, conversationReportRequestSchema, 1_000);
    const user = c.get('user');
    const repo = c.get('repo');
    const session = await repo.getSpeakingSession(user.id, uuidParam(c));
    if (!session) throw new ApiError('NOT_FOUND', 'Không tìm thấy phiên luyện nói.');
    if (session.status === 'active') throw new ApiError('VALIDATION_ERROR', 'Hãy kết thúc phiên trước khi tạo báo cáo.');
    if (session.report) return c.json(session.report);
    const lines = await repo.listTranscripts(user.id, session.id);
    if (!lines.some((l) => l.role === 'user')) {
      throw new ApiError('VALIDATION_ERROR', 'Không có lời nói nào của bạn được ghi nhận trong phiên này.');
    }
    const report = await withQuota(c, 'evaluation', 1, text, () =>
      new EnglishEvaluationService(text).sessionReport({
        lines,
        level: session.level,
        language: body.explanationLanguage,
        source: 'speech',
      }),
    );
    await repo.saveSessionReport(user.id, session.id, report);
    return c.json(report);
  });

  // ---- server-side speech-to-text (pronunciation practice on browsers without Web Speech)
  authed.post('/stt', async (c) => {
    const { providers } = c.get('deps');
    const text = requireText(c);
    if (!providers.stt) throw new ApiError('FEATURE_DISABLED', 'Nhận dạng giọng nói phía máy chủ chưa được bật.');
    const body = await parseJson(c, sttRequestSchema, 1_500_000);
    const transcript = await withQuota(c, 'stt', 1, text, () =>
      providers.stt!.transcribe({ audioBase64: body.audio, mimeType: body.mimeType }),
    );
    return c.json({ transcript });
  });

  // ---- account deletion (requires typing DELETE in the UI)
  authed.delete('/account', async (c) => {
    await parseJson(c, deleteAccountRequestSchema, 200);
    await c.get('repo').deleteAuthUser(c.get('user').id);
    return c.body(null, 204);
  });

  app.route('/', authed);
  return app;
}

// ------------------------------------------------------------------ helpers

function requireText(c: Ctx): TextChatProvider {
  const { config, providers } = c.get('deps');
  if (!config.aiTextEnabled || !providers.text) {
    throw new ApiError('FEATURE_DISABLED', 'Tính năng AI chưa được bật trên máy chủ (chưa cấu hình nhà cung cấp AI).');
  }
  return providers.text;
}

async function parseJson<T extends z.ZodType>(c: Ctx, schema: T, maxBytes: number): Promise<z.infer<T>> {
  const declared = Number(c.req.header('Content-Length') ?? '0');
  if (declared > maxBytes) throw new ApiError('PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.');
  const raw = await c.req.text();
  if (raw.length > maxBytes) throw new ApiError('PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.');
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Dữ liệu không phải JSON hợp lệ.');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Dữ liệu gửi lên không hợp lệ.',
      parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidParam(c: Ctx): string {
  const id = c.req.param('id') ?? '';
  if (!UUID.test(id)) throw new ApiError('NOT_FOUND', 'Không tìm thấy dữ liệu.');
  return id;
}

async function consumeQuota(c: Ctx, kind: QuotaKind, requests: number, provider: { name: string; model: string }) {
  const { config } = c.get('deps');
  const limits = config.limits;
  const dailyLimit = { chat: limits.chatPerDay, assist: limits.assistPerDay, evaluation: limits.evalPerDay, stt: limits.assistPerDay }[kind];
  const result = await c.get('repo').consumeQuota({
    userId: c.get('user').id,
    kind,
    units: 1,
    requests,
    dailyLimit,
    minuteLimit: limits.aiPerMinute,
    globalLimit: limits.globalAiPerDay,
    provider: provider.name,
    model: provider.model,
  });
  if (!result.allowed) throw quotaError(result);
  return result;
}

async function withQuota<T>(c: Ctx, kind: QuotaKind, requests: number, provider: TextChatProvider, fn: () => Promise<T>): Promise<T> {
  const quota = await consumeQuota(c, kind, requests, provider);
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ProviderError && quota.log_id) {
      await safe(() => c.get('repo').markUsageError(quota.log_id!, error.kind));
    }
    throw error;
  }
}

function quotaError(result: QuotaResult) {
  switch (result.reason) {
    case 'rate_limited':
      return new ApiError('RATE_LIMITED', 'Bạn gửi yêu cầu quá nhanh. Hãy đợi khoảng một phút rồi thử lại.');
    case 'global_daily':
      return new ApiError('GLOBAL_LIMIT', 'Hệ thống đã dùng hết hạn mức AI miễn phí của hôm nay. Vui lòng quay lại vào ngày mai.');
    default:
      return new ApiError('QUOTA_EXCEEDED', `Bạn đã dùng hết ${result.limit ?? ''} lượt hôm nay. Hạn mức sẽ đặt lại lúc 00:00 UTC (7:00 sáng giờ Việt Nam).`, {
        used: result.used,
        limit: result.limit,
      });
  }
}

function voiceQuotaError(result: VoiceStartResult) {
  switch (result.reason) {
    case 'session_active':
      return new ApiError('SESSION_ACTIVE', 'Bạn đang có một phiên luyện nói khác. Hãy kết thúc phiên đó trước (hoặc đợi vài phút để phiên cũ tự hết hạn).');
    case 'rate_limited':
      return new ApiError('RATE_LIMITED', 'Bạn thao tác quá nhanh. Hãy đợi khoảng một phút rồi thử lại.');
    case 'global_concurrent':
      return new ApiError('GLOBAL_LIMIT', 'Đang có quá nhiều người luyện nói cùng lúc. Vui lòng thử lại sau ít phút hoặc dùng chế độ dự phòng.');
    case 'global_daily_voice':
      return new ApiError('GLOBAL_LIMIT', 'Hệ thống đã dùng hết thời lượng luyện nói miễn phí hôm nay. Bạn vẫn có thể dùng chế độ dự phòng.');
    default:
      return new ApiError('QUOTA_EXCEEDED', 'Bạn đã dùng hết thời lượng luyện nói realtime hôm nay.', {
        usedSeconds: result.used_seconds,
        limitSeconds: result.limit_seconds,
      });
  }
}

export function isAllowedOrigin(origin: string, requestUrl: string, allowlist: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin === new URL(requestUrl).origin) return true;
  return allowlist.some((entry) => {
    if (entry === parsed.origin) return true;
    // "https://*.example.pages.dev" matches one subdomain level (preview deployments).
    const wildcard = /^(https?):\/\/\*\.(.+)$/.exec(entry);
    if (!wildcard) return false;
    const [, scheme, suffix] = wildcard;
    return parsed.protocol === `${scheme}:` && parsed.hostname.endsWith(`.${suffix}`) && !parsed.hostname.slice(0, -suffix.length - 1).includes('.');
  });
}

function titleFrom(message: string) {
  const firstLine = message.split('\n')[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine || 'New conversation';
}

function openingLine(topic: string | undefined) {
  if (!topic || topic === 'Free talk') return "Hi! It's nice to talk with you. How has your day been so far?";
  return `Hi! Today let's talk about ${topic.toLowerCase()}. To start, can you tell me a little about your experience with it?`;
}

/** Text that will be read by a speech synthesizer should not contain markdown. */
export function stripForSpeech(text: string) {
  return text
    .replace(/\*\*|__|`|#+\s/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function safe(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    logError('background', error);
  }
}
