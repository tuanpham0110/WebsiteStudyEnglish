// Real-provider smoke test for the Gemini integration used by EnglishAI.
//   GEMINI_API_KEY=... npm run smoke:gemini
// Checks: text generation, structured JSON, ephemeral token minting, and a real
// Live API session (WebSocket) that returns transcribed audio. Uses a few
// requests of your quota. Never prints the API key or the token.
import { loadEnv, report } from './load-env.mjs';

const env = loadEnv();
const KEY = env.GEMINI_API_KEY;
const TEXT_MODEL = env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
const LIVE_MODEL = env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
const VERSION = env.GEMINI_LIVE_API_VERSION || 'v1beta';
const BASE = 'https://generativelanguage.googleapis.com';

if (!KEY) {
  console.error('GEMINI_API_KEY is not set (env or .dev.vars). Integration pending.');
  process.exit(2);
}

async function post(path, body, version = 'v1beta') {
  const res = await fetch(`${BASE}/${version}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 429 ? ' (free-tier quota exhausted or rate limited)' : res.status === 404 ? ' (model not found — check the model id)' : '';
    throw new Error(`HTTP ${res.status} ${json.error?.status ?? ''} ${json.error?.message ?? ''}${hint}`.trim());
  }
  return json;
}

const text = (json) => (json.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join('');
const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
};

await check(`text generation (${TEXT_MODEL})`, async () => {
  const json = await post(`models/${TEXT_MODEL}:generateContent`, {
    contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: Hello learner' }] }],
    generationConfig: { maxOutputTokens: 50 },
  });
  const out = text(json);
  if (!out) throw new Error('empty response');
  return `"${out.trim().slice(0, 60)}" · tokens ${json.usageMetadata?.totalTokenCount ?? '?'}`;
});

await check('structured JSON output (responseSchema)', async () => {
  const json = await post(`models/${TEXT_MODEL}:generateContent`, {
    contents: [{ role: 'user', parts: [{ text: 'Correct this sentence: "She go to school yesterday."' }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { corrected: { type: 'STRING' } }, required: ['corrected'] },
      maxOutputTokens: 200,
    },
  });
  const parsed = JSON.parse(text(json));
  if (typeof parsed.corrected !== 'string') throw new Error('schema not respected');
  return parsed.corrected;
});

let token = null;
await check(`ephemeral token (${VERSION}/auth_tokens, ${LIVE_MODEL})`, async () => {
  const now = Date.now();
  const json = await post(
    'auth_tokens',
    {
      uses: 1,
      expireTime: new Date(now + 120_000).toISOString(),
      newSessionExpireTime: new Date(now + 60_000).toISOString(),
      bidiGenerateContentSetup: {
        model: `models/${LIVE_MODEL}`,
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
        systemInstruction: { parts: [{ text: 'You are a friendly English tutor. Keep answers to one short sentence.' }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    },
    VERSION,
  );
  if (!json.name?.startsWith('auth_tokens/')) throw new Error('response has no token name');
  token = json.name;
  return 'token received (not printed)';
});

await check('Live API session over WebSocket with the ephemeral token', async () => {
  if (!token) throw new Error('skipped: no token');
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${VERSION}.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    let transcript = '';
    let audioBytes = 0;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`timeout (audio bytes ${audioBytes}, transcript "${transcript}")`));
    }, 25_000);
    ws.onopen = () => ws.send(JSON.stringify({ setup: { model: `models/${LIVE_MODEL}`, generationConfig: { responseModalities: ['AUDIO'] } } }));
    ws.onerror = () => {};
    ws.onclose = (e) => {
      clearTimeout(timer);
      if (audioBytes === 0) reject(new Error(`closed ${e.code} ${e.reason}`));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
      if (msg.setupComplete) ws.send(JSON.stringify({ realtimeInput: { text: 'Hello! Please greet me.' } }));
      for (const part of msg.serverContent?.modelTurn?.parts ?? []) if (part.inlineData?.data) audioBytes += Buffer.from(part.inlineData.data, 'base64').length;
      if (msg.serverContent?.outputTranscription?.text) transcript += msg.serverContent.outputTranscription.text;
      if (msg.serverContent?.turnComplete) {
        clearTimeout(timer);
        ws.close(1000);
        resolve(`${(audioBytes / 48000).toFixed(1)} s of 24 kHz audio · transcript: "${transcript.trim().slice(0, 80)}"`);
      }
    };
  });
});

report(results);
