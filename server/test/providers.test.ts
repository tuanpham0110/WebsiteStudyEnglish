import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiRealtimeVoiceProvider } from '../ai/gemini/live';
import { GeminiTextChatProvider, toContents } from '../ai/gemini/text';
import { ProviderError, redact } from '../errors';
import { parseSseJson } from '../lib/sse';

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('SSE parser', () => {
  it('reassembles events split across chunks', async () => {
    const events: unknown[] = [];
    for await (const e of parseSseJson(streamOf(['data: {"a"', ':1}\r\n\r\ndata: {"b":2}\n', '\ndata: [DONE]\n\n']))) events.push(e);
    expect(events).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('Gemini text provider', () => {
  it('maps history to alternating user/model contents starting with user', () => {
    expect(
      toContents([
        { role: 'assistant', text: 'Welcome!' },
        { role: 'user', text: 'Hi' },
        { role: 'user', text: 'there' },
      ]),
    ).toEqual([
      { role: 'user', parts: [{ text: '(The learner has joined. Begin.)' }] },
      { role: 'model', parts: [{ text: 'Welcome!' }] },
      { role: 'user', parts: [{ text: 'Hi\nthere' }] },
    ]);
  });

  it('streams visible text, skips thought parts and sends the key in a header', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        streamOf([
          'data: {"candidates":[{"content":{"parts":[{"text":"thinking…","thought":true}]}}]}\n\n',
          'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
          'data: {"candidates":[{"content":{"parts":[{"text":" world"}]},"finishReason":"STOP"}]}\n\n',
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiTextChatProvider({ apiKey: 'AIzaTESTKEY', model: 'gemini-3.5-flash-lite' });
    let out = '';
    for await (const d of provider.streamChat({ system: 'sys', history: [{ role: 'user', text: 'Hi' }] })) out += d;
    expect(out).toBe('Hello world');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse');
    expect(url).not.toContain('AIza');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaTESTKEY');
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('classifies HTTP 429 as a quota error and blocked prompts as blocked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }, { status: 429 })));
    const provider = new GeminiTextChatProvider({ apiKey: 'k', model: 'm-1' });
    await expect(provider.complete({ system: 's', history: [{ role: 'user', text: 'x' }] })).rejects.toMatchObject({ kind: 'quota' });

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } })));
    await expect(provider.complete({ system: 's', history: [{ role: 'user', text: 'x' }] })).rejects.toBeInstanceOf(ProviderError);
  });

  it('requests JSON with a response schema and rejects non-JSON output', async () => {
    const fetchMock = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: '{"translation":"Xin chào"}' }] } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiTextChatProvider({ apiKey: 'k', model: 'm-1', thinkingLevel: 'low' });
    const out = await provider.generateJson({ system: 's', prompt: 'p', schema: { type: 'OBJECT', properties: { translation: { type: 'STRING' } } } });
    expect(out).toEqual({ translation: 'Xin chào' });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } });

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })));
    await expect(provider.generateJson({ system: 's', prompt: 'p', schema: { type: 'OBJECT' } })).rejects.toMatchObject({ kind: 'invalid_output' });
  });
});

describe('Gemini Live ephemeral token', () => {
  it('mints a single-use token with the whole setup locked and a short expiry', async () => {
    const fetchMock = vi.fn(async () => Response.json({ name: 'auth_tokens/abc123' }));
    vi.stubGlobal('fetch', fetchMock);
    const before = Date.now();
    const provider = new GeminiRealtimeVoiceProvider({ apiKey: 'AIzaSECRET', model: 'gemini-3.8-live', apiVersion: 'v1beta' });
    const grant = await provider.createSession({ systemInstruction: 'Be a tutor', voice: 'Kore', maxSeconds: 300 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/auth_tokens');
    const body = JSON.parse(init.body as string);
    expect(body.uses).toBe(1);
    expect(body.fieldMask).toBeUndefined(); // no mask => setup comes entirely from the token
    expect(body.bidiGenerateContentSetup).toEqual({
      model: 'models/gemini-3.8-live',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
      systemInstruction: { parts: [{ text: 'Be a tutor' }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    });
    const expire = Date.parse(body.expireTime);
    expect(expire - before).toBeGreaterThanOrEqual(320_000 - 1000);
    expect(expire - before).toBeLessThan(330_000);
    expect(Date.parse(body.newSessionExpireTime) - before).toBeLessThanOrEqual(61_000);

    expect(grant.token).toBe('auth_tokens/abc123');
    expect(grant.wsUrl).toBe(
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
    );
    expect(JSON.stringify(grant)).not.toContain('AIzaSECRET');
  });

  it('fails safely when the token response is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({})));
    const provider = new GeminiRealtimeVoiceProvider({ apiKey: 'k', model: 'gemini-3.8-live', apiVersion: 'v1beta' });
    await expect(provider.createSession({ systemInstruction: 's', voice: 'Kore', maxSeconds: 60 })).rejects.toMatchObject({ kind: 'invalid_output' });
  });
});

describe('log redaction', () => {
  it('removes keys and tokens', () => {
    const out = redact(
      'fail key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWX Bearer eyJhbGc.x.y sb_secret_abc123 auth_tokens/zzz ?access_token=qq',
    );
    expect(out).not.toMatch(/AIzaSy|eyJhbGc|abc123|zzz|qq/);
  });
});
