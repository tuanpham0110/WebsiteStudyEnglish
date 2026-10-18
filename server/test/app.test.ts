import { describe, expect, it } from 'vitest';
import { ProviderError } from '../errors';
import { isAllowedOrigin } from '../app';
import { makeTestApp, readSse, USERS } from './fakes';

const A = USERS['token-a'].id;

describe('auth & configuration', () => {
  it('health is public and reports feature flags', async () => {
    const { request } = makeTestApp();
    const res = await request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, features: { aiText: true, aiVoice: true } });
  });

  it('rejects requests without a valid bearer token', async () => {
    const { request } = makeTestApp();
    expect((await request('/api/config')).status).toBe(401);
    expect((await request('/api/config', { token: 'forged' })).status).toBe(401);
    const res = await request('/api/config', { token: 'token-a' });
    expect(res.status).toBe(200);
  });

  it('reports FEATURE_DISABLED when the database is not configured', async () => {
    const { request } = makeTestApp({ noDb: true });
    const res = await request('/api/config', { token: 'token-a' });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'FEATURE_DISABLED' } });
  });

  it('keeps cost-incurring features off unless explicitly enabled', async () => {
    const { request, config } = makeTestApp({ env: { AI_TEXT_ENABLED: 'false', AI_VOICE_ENABLED: undefined } });
    expect(config.aiTextEnabled).toBe(false);
    expect(config.aiVoiceEnabled).toBe(false);
    const res = await request('/api/chat/stream', {
      method: 'POST',
      token: 'token-a',
      json: { message: 'Hello', level: 'A2' },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'FEATURE_DISABLED' } });
  });

  it('turns AI off when no API key is configured even if the flag is on', () => {
    const { config } = makeTestApp({ env: { GEMINI_API_KEY: undefined } });
    expect(config.aiTextEnabled).toBe(false);
  });
});

describe('CORS', () => {
  it('allows same-origin, listed and wildcard preview origins only', () => {
    const list = ['https://englishai.pages.dev', 'https://*.englishai.pages.dev'];
    expect(isAllowedOrigin('https://app.test', 'https://app.test/api/x', [])).toBe(true);
    expect(isAllowedOrigin('https://englishai.pages.dev', 'https://other/api', list)).toBe(true);
    expect(isAllowedOrigin('https://abc123.englishai.pages.dev', 'https://other/api', list)).toBe(true);
    expect(isAllowedOrigin('https://a.b.englishai.pages.dev', 'https://other/api', list)).toBe(false);
    expect(isAllowedOrigin('https://evil.com', 'https://other/api', list)).toBe(false);
    expect(isAllowedOrigin('https://englishai.pages.dev.evil.com', 'https://other/api', list)).toBe(false);
  });

  it('rejects cross-origin requests from unknown sites', async () => {
    const { request } = makeTestApp();
    const res = await request('/api/health', { headers: { Origin: 'https://evil.com' } });
    expect(res.status).toBe(403);
    const ok = await request('/api/health', { headers: { Origin: 'https://englishai.pages.dev' } });
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://englishai.pages.dev');
  });
});

describe('AI chat', () => {
  it('validates input', async () => {
    const { request } = makeTestApp();
    const empty = await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: '  ', level: 'A2' } });
    expect(empty.status).toBe(400);
    const badMode = await request('/api/chat/stream', {
      method: 'POST',
      token: 'token-a',
      json: { message: 'hi', level: 'A2', mode: 'jailbreak' },
    });
    expect(badMode.status).toBe(400);
    const tooLong = await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'x'.repeat(2001), level: 'A2' } });
    expect(tooLong.status).toBe(400);
  });

  it('streams a reply, persists both messages and attaches the correction to the user message', async () => {
    const { request, db, text } = makeTestApp();
    const res = await request('/api/chat/stream', {
      method: 'POST',
      token: 'token-a',
      json: { message: 'I goes to school every day', level: 'A2', mode: 'conversation_partner', model: 'gemini-ultra-expensive' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const events = await readSse(res);
    expect(events.map((e) => e.event)).toEqual(['meta', 'delta', 'delta', 'delta', 'correction', 'done']);
    const text1 = events.filter((e) => e.event === 'delta').map((e) => e.data.text).join('');
    expect(text1).toBe('Nice to meet you! What do you do?');

    const convId = events[0].data.conversationId as string;
    expect(db.conversations.get(convId)).toMatchObject({ user_id: A, title: 'I goes to school every day', kind: 'chat' });
    const stored = db.messages.filter((m) => m.conversation_id === convId);
    expect(stored.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(stored[0].correction).toMatchObject({ hasErrors: true, corrected: 'I go' });
    // The client-supplied "model" field is ignored: the provider is fixed server-side.
    expect(text.calls).toHaveLength(1);
    expect(text.calls[0].system).toContain('elementary (CEFR A2)');
  });

  it('sends recent history from the database, not from the client', async () => {
    const { request, text } = makeTestApp();
    const first = await readSse(
      await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'Hi', level: 'B1', autoCorrect: false } }),
    );
    const conversationId = first[0].data.conversationId;
    await readSse(
      await request('/api/chat/stream', {
        method: 'POST',
        token: 'token-a',
        json: { conversationId, message: 'Tell me more', level: 'B1', autoCorrect: false },
      }),
    );
    expect(text.calls[1].history.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(text.calls[1].history.at(-1)?.text).toBe('Tell me more');
  });

  it('refuses to continue another user\'s conversation', async () => {
    const { request } = makeTestApp();
    const first = await readSse(
      await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'Hi', level: 'B1' } }),
    );
    const res = await request('/api/chat/stream', {
      method: 'POST',
      token: 'token-b',
      json: { conversationId: first[0].data.conversationId, message: 'hijack', level: 'B1' },
    });
    expect(res.status).toBe(404);
  });

  it('stops at the daily quota without calling the provider', async () => {
    const { request, text } = makeTestApp({ env: { LIMIT_CHAT_PER_DAY: '1' } });
    await readSse(await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'one', level: 'A1' } }));
    const res = await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'two', level: 'A1' } });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: 'QUOTA_EXCEEDED' } });
    expect(text.calls).toHaveLength(1);
  });

  it('maps rate limiting and the global cap to distinct errors', async () => {
    const { request, db } = makeTestApp();
    db.quotaOverride = { allowed: false, reason: 'rate_limited' };
    const r1 = await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'x', level: 'A1' } });
    expect(await r1.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    db.quotaOverride = { allowed: false, reason: 'global_daily' };
    const r2 = await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'x', level: 'A1' } });
    expect(await r2.json()).toMatchObject({ error: { code: 'GLOBAL_LIMIT' } });
  });

  it('reports provider quota exhaustion in-stream and refunds the user quota', async () => {
    const { request, text, db } = makeTestApp();
    text.streamError = new ProviderError('quota', 'gemini 429 RESOURCE_EXHAUSTED');
    const events = await readSse(
      await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'Hello', level: 'A2', autoCorrect: false } }),
    );
    const error = events.find((e) => e.event === 'error');
    expect(error?.data).toMatchObject({ code: 'PROVIDER_QUOTA' });
    expect(String(error?.data.message)).toContain('không tự chuyển sang gói trả phí');
    expect(db.usage[0]).toMatchObject({ status: 'error', code: 'quota' });
  });

  it('builds roleplay prompts from the server-side scenario only', async () => {
    const { request, text, db } = makeTestApp();
    const events = await readSse(
      await request('/api/chat/stream', {
        method: 'POST',
        token: 'token-a',
        json: { message: 'Hi, a table please', level: 'A2', scenarioId: 'restaurant-order', autoCorrect: false },
      }),
    );
    const conv = db.conversations.get(events[0].data.conversationId as string);
    expect(conv).toMatchObject({ kind: 'roleplay', scenario_id: 'restaurant-order', mode: 'roleplay' });
    expect(text.calls[0].system).toContain('a friendly waiter named Marco');
    expect(text.calls[0].history[0]).toMatchObject({ role: 'assistant' });

    const unknown = await request('/api/chat/stream', {
      method: 'POST',
      token: 'token-a',
      json: { message: 'x', level: 'A2', scenarioId: 'made-up' },
    });
    expect(unknown.status).toBe(400);
  });
});

describe('assist & writing', () => {
  it('translates and stores the translation on an owned message', async () => {
    const { request, text, db } = makeTestApp();
    const events = await readSse(
      await request('/api/chat/stream', { method: 'POST', token: 'token-a', json: { message: 'Hello', level: 'A2', autoCorrect: false } }),
    );
    const messageId = db.messages.find((m) => m.role === 'assistant')!.id;
    expect(events.at(-1)?.event).toBe('done');
    text.json = { translation: 'Rất vui được gặp bạn!' };
    const res = await request('/api/ai/assist', {
      method: 'POST',
      token: 'token-a',
      json: { task: 'translate', text: 'Nice to meet you!', level: 'A2', messageId },
    });
    expect(await res.json()).toEqual({ task: 'translate', result: { translation: 'Rất vui được gặp bạn!' } });
    expect(db.messages.find((m) => m.id === messageId)?.translation_vi).toBe('Rất vui được gặp bạn!');
  });

  it('rejects malformed AI output instead of passing it to the client', async () => {
    const { request, text } = makeTestApp();
    text.json = { nonsense: true };
    const res = await request('/api/writing/evaluate', {
      method: 'POST',
      token: 'token-a',
      json: { text: 'Dear Sir, I am write to ask about the job offer you posted.', type: 'email', level: 'B1' },
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'PROVIDER_ERROR' } });
  });

  it('returns validated writing feedback and logs progress', async () => {
    const { request, text, db } = makeTestApp();
    text.json = {
      correctedText: 'Dear Sir, I am writing to ask about the job you posted.',
      overallFeedback: 'Tốt.',
      coherence: { rating: 4, comment: 'Mạch lạc.' },
      changes: [{ original: 'am write', revised: 'am writing', type: 'grammar', reason: 'Thì hiện tại tiếp diễn.' }],
      vocabularySuggestions: [],
      strengths: ['Lịch sự'],
    };
    const res = await request('/api/writing/evaluate', {
      method: 'POST',
      token: 'token-a',
      json: { text: 'Dear Sir, I am write to ask about the job offer you posted.', type: 'email', level: 'B1' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).changes).toHaveLength(1);
    expect(db.progress).toEqual([{ user_id: A, activity: 'writing' }]);
  });
});

describe('speaking sessions', () => {
  it('issues a realtime grant with a locked, server-built prompt', async () => {
    const { request, live, db } = makeTestApp();
    const res = await request('/api/speaking/sessions', {
      method: 'POST',
      token: 'token-a',
      json: { transport: 'realtime', level: 'B1', topic: 'Travel', voice: 'Puck' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ transport: 'realtime', token: 'auth_tokens/fake', maxSeconds: 300, voice: 'Puck' });
    expect(live.requests[0].systemInstruction).toContain('Topic: Travel');
    expect(live.requests[0].maxSeconds).toBe(300);
    expect(db.sessions.get(body.sessionId)?.status).toBe('active');
  });

  it('rejects unknown voices and refuses when voice is disabled', async () => {
    const { request } = makeTestApp();
    const badVoice = await request('/api/speaking/sessions', {
      method: 'POST',
      token: 'token-a',
      json: { transport: 'realtime', level: 'B1', voice: 'Expensive' },
    });
    expect(badVoice.status).toBe(400);
    const off = makeTestApp({ env: { AI_VOICE_ENABLED: 'false' } });
    const res = await off.request('/api/speaking/sessions', { method: 'POST', token: 'token-a', json: { transport: 'realtime', level: 'B1' } });
    expect(res.status).toBe(503);
  });

  it('allows only one active realtime session per user', async () => {
    const { request } = makeTestApp();
    const start = () => request('/api/speaking/sessions', { method: 'POST', token: 'token-a', json: { transport: 'realtime', level: 'A2' } });
    expect((await start()).status).toBe(200);
    const second = await start();
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: { code: 'SESSION_ACTIVE' } });
  });

  it('maps voice budget exhaustion to QUOTA_EXCEEDED', async () => {
    const { request, db } = makeTestApp();
    db.voiceOverride = { allowed: false, reason: 'user_daily_voice' };
    const res = await request('/api/speaking/sessions', { method: 'POST', token: 'token-a', json: { transport: 'realtime', level: 'A2' } });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: 'QUOTA_EXCEEDED' } });
  });

  it('marks the session failed if the provider cannot mint a token', async () => {
    const { request, live, db } = makeTestApp();
    live.fail = true;
    const res = await request('/api/speaking/sessions', { method: 'POST', token: 'token-a', json: { transport: 'realtime', level: 'A2' } });
    expect(res.status).toBe(502);
    const [session] = [...db.sessions.values()];
    expect(session).toMatchObject({ status: 'failed', error_code: 'token_error' });
  });

  it('ends a session, stores the transcript once and blocks other users', async () => {
    const { request, db } = makeTestApp();
    const start = await (await request('/api/speaking/sessions', { method: 'POST', token: 'token-a', json: { transport: 'realtime', level: 'A2' } })).json();
    const transcript = [
      { role: 'assistant', text: 'Hi! How are you?' },
      { role: 'user', text: 'I am fine thank you' },
    ];
    const other = await request(`/api/speaking/sessions/${start.sessionId}/end`, { method: 'POST', token: 'token-b', json: { status: 'completed', transcript } });
    expect(other.status).toBe(404);
    const end = await request(`/api/speaking/sessions/${start.sessionId}/end`, { method: 'POST', token: 'token-a', json: { status: 'completed', transcript } });
    expect(await end.json()).toEqual({ durationSeconds: 42, status: 'completed' });
    expect(db.transcripts).toHaveLength(2);
  });

  it('runs a fallback session: opening, text turn, report', async () => {
    const { request, text, db } = makeTestApp({ env: { AI_VOICE_ENABLED: 'false' } });
    const start = await (
      await request('/api/speaking/sessions', { method: 'POST', token: 'token-a', json: { transport: 'fallback', level: 'A2', topic: 'Food' } })
    ).json();
    expect(start).toMatchObject({ transport: 'fallback' });
    expect(start.opening).toContain('food');

    text.reply = ['**Great!** What is your favourite dish?'];
    const turn = await request(`/api/speaking/sessions/${start.sessionId}/turn`, { method: 'POST', token: 'token-a', json: { text: 'I like pho' } });
    expect(await turn.json()).toEqual({ reply: 'Great! What is your favourite dish?' });
    expect(db.transcripts.map((t) => t.role)).toEqual(['assistant', 'user', 'assistant']);

    const early = await request(`/api/speaking/sessions/${start.sessionId}/report`, { method: 'POST', token: 'token-a', json: {} });
    expect(early.status).toBe(400);

    await request(`/api/speaking/sessions/${start.sessionId}/end`, { method: 'POST', token: 'token-a', json: { status: 'completed' } });
    text.json = { summary: 'Good chat', strengths: [], goodSentences: [], grammarIssues: [], newVocabulary: [], naturalAlternatives: [], nextGoals: [] };
    const report = await (await request(`/api/speaking/sessions/${start.sessionId}/report`, { method: 'POST', token: 'token-a', json: {} })).json();
    expect(report.summary).toBe('Good chat');
    expect(report.pronunciationNote).toContain('Không có chấm điểm phát âm chi tiết');
    expect(report.basedOnTurns).toBe(1);
  });
});

describe('account', () => {
  it('requires explicit confirmation to delete the account', async () => {
    const { request, db } = makeTestApp();
    expect((await request('/api/account', { method: 'DELETE', token: 'token-a', json: {} })).status).toBe(400);
    expect((await request('/api/account', { method: 'DELETE', token: 'token-a', json: { confirm: 'DELETE' } })).status).toBe(204);
    expect(db.deletedUsers).toEqual([A]);
  });
});
