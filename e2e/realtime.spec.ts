import { expect, test } from '@playwright/test';
import { WebSocketServer, type WebSocket } from 'ws';
import { fixtures, horizontalOverflow, mockBackend, signIn } from './mocks';

// Exercises the real browser audio pipeline (fake microphone → AudioWorklet →
// 16 kHz PCM → WebSocket → 24 kHz playback) against a local server that speaks
// the Gemini Live message protocol. It verifies our client, not Google's service.

test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
});

function sinePcmBase64(seconds: number, rate = 24000) {
  const samples = new Int16Array(Math.round(seconds * rate));
  for (let i = 0; i < samples.length; i++) samples[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000);
  return Buffer.from(samples.buffer).toString('base64');
}

type Received = { setup: unknown; audioChunks: { mimeType: string; samples: number }[]; texts: string[]; streamEnds: number; closed: boolean; tokenParam: string | null };

async function startFakeLive(port: number) {
  const received: Received = { setup: null, audioChunks: [], texts: [], streamEnds: 0, closed: false, tokenParam: null };
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });
  wss.on('connection', (socket: WebSocket, request) => {
    received.tokenParam = new URL(request.url ?? '/', 'http://x').searchParams.get('access_token');
    let answeredUser = false;
    const send = (msg: unknown) => socket.send(Buffer.from(JSON.stringify(msg))); // binary frames, like the real API
    socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.setup) {
        received.setup = msg.setup;
        send({ setupComplete: {} });
        return;
      }
      const input = msg.realtimeInput;
      if (input?.text) {
        received.texts.push(input.text);
        send({ serverContent: { outputTranscription: { text: 'Hello! ' } } });
        send({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: sinePcmBase64(0.4) } }] }, outputTranscription: { text: 'How are you today?' } } });
        send({ serverContent: { generationComplete: true } });
        send({ serverContent: { turnComplete: true } });
      }
      if (input?.audioStreamEnd) received.streamEnds++;
      if (input?.audio) {
        received.audioChunks.push({ mimeType: input.audio.mimeType, samples: Buffer.from(input.audio.data, 'base64').length / 2 });
        if (received.audioChunks.length === 15 && !answeredUser) {
          answeredUser = true;
          send({ serverContent: { inputTranscription: { text: 'I am fine, ' } } });
          send({ serverContent: { inputTranscription: { text: 'thank you.' } } });
          send({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: sinePcmBase64(0.3) } }] }, outputTranscription: { text: 'Great to hear that!' } } });
          send({ serverContent: { turnComplete: true } });
        }
      }
    });
    socket.on('close', () => (received.closed = true));
  });
  return { received, close: () => new Promise<void>((r) => wss.close(() => r())) };
}

test('realtime voice: mic audio streams as 16 kHz PCM, AI audio plays, session ends cleanly', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' && info.project.name !== 'mobile');
  const port = info.project.name === 'desktop' ? 8791 : 8792;
  const live = await startFakeLive(port);
  let endBody: { status: string; transcript: { role: string; text: string }[] } | null = null;
  try {
    await signIn(page);
    await mockBackend(page);
    await page.route('**/api/config', (route) => route.fulfill({ json: { ...fixtures.config, features: { ...fixtures.config.features, aiVoice: true, liveModel: 'gemini-3.8-live' } } }));
    await page.route('**/api/speaking/sessions', (route) =>
      route.fulfill({
        json: {
          transport: 'realtime',
          sessionId: '44444444-4444-4444-8444-444444444444',
          provider: 'gemini',
          model: 'gemini-3.8-live',
          token: 'auth_tokens/e2e-token',
          wsUrl: `ws://127.0.0.1:${port}/ws`,
          setup: { model: 'models/gemini-3.8-live', generationConfig: { responseModalities: ['AUDIO'] } },
          maxSeconds: 120,
          expiresAt: new Date(Date.now() + 140_000).toISOString(),
          voice: 'Kore',
          inputSampleRate: 16000,
          outputSampleRate: 24000,
        },
      }),
    );
    await page.route('**/api/speaking/sessions/*/end', async (route) => {
      endBody = route.request().postDataJSON();
      await route.fulfill({ json: { durationSeconds: 3, status: 'completed' } });
    });

    await page.goto('/app/speaking');
    await expect(page.getByRole('button', { name: /Realtime voice/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Bắt đầu phiên' }).click();

    await expect(page.getByText('Micro đang hoạt động')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Hello! How are you today?')).toBeVisible();
    await expect(page.getByText('I am fine, thank you.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Great to hear that!')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `e2e-screens/${info.project.name}-speaking-realtime.png`, fullPage: true });

    // Protocol checks: token passed as access_token, setup sent first, audio as 100 ms 16 kHz PCM chunks.
    expect(live.received.tokenParam).toBe('auth_tokens/e2e-token');
    expect(live.received.setup).toMatchObject({ model: 'models/gemini-3.8-live' });
    expect(live.received.texts.length).toBe(1);
    expect(live.received.audioChunks.length).toBeGreaterThanOrEqual(15);
    expect(new Set(live.received.audioChunks.map((c) => c.mimeType))).toEqual(new Set(['audio/pcm;rate=16000']));
    expect(new Set(live.received.audioChunks.map((c) => c.samples))).toEqual(new Set([1600]));

    // Mute signals end of audio stream and stops sending.
    await page.getByRole('button', { name: 'Tắt micro' }).click();
    await expect(page.getByText('Micro đang tắt').first()).toBeVisible();
    await expect.poll(() => live.received.streamEnds).toBe(1);
    const afterMute = live.received.audioChunks.length;
    await page.waitForTimeout(600);
    expect(live.received.audioChunks.length).toBe(afterMute);

    await page.getByRole('button', { name: 'Kết thúc phiên' }).click();
    await expect(page.getByText(/Phiên đã kết thúc/)).toBeVisible();
    await expect.poll(() => live.received.closed).toBe(true);
    expect(endBody).toMatchObject({ status: 'completed' });
    expect(endBody!.transcript).toEqual([
      { role: 'assistant', text: 'Hello! How are you today?' },
      { role: 'user', text: 'I am fine, thank you.' },
      { role: 'assistant', text: 'Great to hear that!' },
    ]);
    // After ending, the microphone is released and replay of AI audio becomes available.
    await expect(page.getByText('Micro đang tắt').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phát lại câu trả lời' }).first()).toBeVisible();
  } finally {
    await live.close();
  }
});

test('realtime voice: a refused session (quota) shows the reason and releases the mic', async ({ page }) => {
  await signIn(page);
  await mockBackend(page);
  await page.route('**/api/config', (route) => route.fulfill({ json: { ...fixtures.config, features: { ...fixtures.config.features, aiVoice: true } } }));
  await page.route('**/api/speaking/sessions', (route) =>
    route.fulfill({ status: 429, json: { error: { code: 'QUOTA_EXCEEDED', message: 'Bạn đã dùng hết thời lượng luyện nói realtime hôm nay.' } } }),
  );
  await page.goto('/app/speaking');
  await page.getByRole('button', { name: 'Bắt đầu phiên' }).click();
  await expect(page.getByText('Bạn đã dùng hết thời lượng luyện nói realtime hôm nay.')).toBeVisible();
  await expect(page.getByText('Micro đang tắt').first()).toBeVisible();
});
