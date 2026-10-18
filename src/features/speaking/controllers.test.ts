import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeakingStartResponse } from '@shared/schemas';
import { ApiRequestError } from '@/lib/api';
import { int16ToBase64 } from '@/lib/audio/pcm';
import { MicError, type MicChunk } from '@/lib/audio/mic-capture';
import type { LiveEvents } from '@/lib/realtime/gemini-live-client';
import { chooseTier, type SpeechSupport } from '@/lib/speech/support';
import type { SpeechToTextProvider } from '@/lib/speech/stt';
import type { TextToSpeechProvider } from '@/lib/speech/tts';
import { FallbackSpeakingController, RealtimeSpeakingController, type SpeakingApi } from './controllers';

const grant: SpeakingStartResponse = {
  transport: 'realtime',
  sessionId: 'sess-1',
  provider: 'gemini',
  model: 'gemini-3.8-live',
  token: 'auth_tokens/x',
  wsUrl: 'wss://example.test/ws',
  setup: { model: 'models/gemini-3.8-live' },
  maxSeconds: 60,
  expiresAt: new Date().toISOString(),
  voice: 'Kore',
  inputSampleRate: 16000,
  outputSampleRate: 24000,
};

function setup(overrides: { startMic?: () => Promise<never>; apiStart?: SpeakingApi['start']; connect?: () => Promise<void> } = {}) {
  let now = 1_000_000;
  let onChunk: ((c: MicChunk) => void) | null = null;
  let events: LiveEvents = {};
  const mic = { stop: vi.fn(async () => {}), setMuted: vi.fn(), isLive: vi.fn(() => true), stream: {} as MediaStream, sampleRate: 16000 };
  const player = {
    enqueue: vi.fn(),
    interrupt: vi.fn(),
    close: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    playClip: vi.fn(),
    onDrained: vi.fn(() => () => true),
    playing: false,
  };
  const client = {
    connect: vi.fn(overrides.connect ?? (async () => {})),
    sendAudio: vi.fn(),
    sendAudioStreamEnd: vi.fn(),
    sendText: vi.fn(),
    close: vi.fn(),
  };
  const api: SpeakingApi = {
    start: vi.fn(overrides.apiStart ?? (async () => grant)),
    turn: vi.fn(),
    end: vi.fn(async () => ({ durationSeconds: 12 })),
  };
  const controller = new RealtimeSpeakingController(
    { level: 'B1', topic: 'Travel', voice: 'Kore' },
    {
      api,
      now: () => now,
      startMic:
        overrides.startMic ??
        (async (opts) => {
          onChunk = opts.onChunk;
          return mic;
        }),
      createPlayer: () => player,
      createClient: (opts) => {
        events = opts.events;
        return client;
      },
    },
  );
  return {
    controller,
    mic,
    player,
    client,
    api,
    events: () => events,
    chunk: (rms: number) => onChunk?.({ pcm: new Int16Array(1600), rms }),
    advance: (ms: number) => {
      now += ms;
      vi.advanceTimersByTime(ms);
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RealtimeSpeakingController', () => {
  it('stops before contacting the server when microphone permission is denied', async () => {
    const t = setup({
      startMic: async () => {
        throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      },
    });
    await t.controller.start();
    const s = t.controller.getState();
    expect(s.status).toBe('error');
    expect(s.errorCode).toBe('mic_denied');
    expect(s.error).toContain('cho phép dùng micro');
    expect(t.api.start).not.toHaveBeenCalled();
    expect(s.micLive).toBe(false);
  });

  it('reports an unsupported browser', async () => {
    const t = setup({
      startMic: async () => {
        throw new MicError('unsupported', 'Trình duyệt này không hỗ trợ thu âm thời gian thực.');
      },
    });
    await t.controller.start();
    expect(t.controller.getState()).toMatchObject({ status: 'error', errorCode: 'mic_unsupported' });
  });

  it('releases the microphone when the server refuses (quota exceeded)', async () => {
    const t = setup({
      apiStart: async () => {
        throw new ApiRequestError('QUOTA_EXCEEDED', 'Bạn đã dùng hết thời lượng luyện nói realtime hôm nay.', 429);
      },
    });
    await t.controller.start();
    expect(t.controller.getState()).toMatchObject({ status: 'error', errorCode: 'QUOTA_EXCEEDED' });
    expect(t.mic.stop).toHaveBeenCalled();
    expect(t.client.connect).not.toHaveBeenCalled();
  });

  it('handles a failed connection: error state, mic released, session reported as failed', async () => {
    const t = setup({
      connect: async () => {
        throw new Error('Phiên kết nối đã hết hạn hoặc không hợp lệ.');
      },
    });
    await t.controller.start();
    expect(t.controller.getState()).toMatchObject({ status: 'error', errorCode: 'connect_failed' });
    expect(t.mic.stop).toHaveBeenCalled();
    expect(t.api.end).toHaveBeenCalledWith('sess-1', expect.objectContaining({ status: 'failed', errorCode: 'connect_failed' }));
  });

  it('only streams audio after the session is connected, then tracks listening/thinking/speaking', async () => {
    const t = setup();
    const startPromise = t.controller.start();
    await startPromise;
    expect(t.controller.getState().status).toBe('listening');
    expect(t.client.sendText).toHaveBeenCalledTimes(1);

    t.chunk(0.1); // user speaking
    expect(t.client.sendAudio).toHaveBeenCalledTimes(1);
    t.events().onInputTranscript?.('Hello, I ');
    t.events().onInputTranscript?.('want to travel');
    t.advance(1000);
    t.chunk(0.001); // silence after speech
    expect(t.controller.getState().status).toBe('thinking');

    t.events().onAudio?.(int16ToBase64(new Int16Array([1, 2, 3])));
    t.events().onOutputTranscript?.('Great! Where to?');
    expect(t.controller.getState().status).toBe('speaking');
    expect(t.player.enqueue).toHaveBeenCalled();

    t.events().onTurnComplete?.();
    const s = t.controller.getState();
    expect(s.status).toBe('listening');
    expect(s.transcript.map((e) => [e.role, e.text, e.final])).toEqual([
      ['user', 'Hello, I want to travel', true],
      ['assistant', 'Great! Where to?', true],
    ]);
  });

  it('stops playback immediately when the learner interrupts', async () => {
    const t = setup();
    await t.controller.start();
    t.events().onAudio?.(int16ToBase64(new Int16Array([5, 5])));
    t.events().onInterrupted?.();
    expect(t.player.interrupt).toHaveBeenCalled();
    expect(t.controller.getState().status).toBe('listening');
    expect(t.controller.getState().transcript[0]).toMatchObject({ interrupted: true, final: true });
  });

  it('mute stops sending audio and signals end of stream', async () => {
    const t = setup();
    await t.controller.start();
    t.controller.setMuted(true);
    expect(t.mic.setMuted).toHaveBeenCalledWith(true);
    expect(t.client.sendAudioStreamEnd).toHaveBeenCalled();
    t.chunk(0.2);
    expect(t.client.sendAudio).not.toHaveBeenCalled();
    expect(t.controller.getState().muted).toBe(true);
  });

  it('ending the session releases the mic, closes the socket and saves the transcript', async () => {
    const t = setup();
    await t.controller.start();
    t.events().onInputTranscript?.('I like pho');
    t.events().onTurnComplete?.();
    await t.controller.end('user');
    const s = t.controller.getState();
    expect(s.status).toBe('ended');
    expect(s.durationSeconds).toBe(12);
    expect(t.mic.stop).toHaveBeenCalled();
    expect(t.client.close).toHaveBeenCalled();
    expect(t.api.end).toHaveBeenCalledWith('sess-1', {
      status: 'completed',
      errorCode: undefined,
      transcript: [{ role: 'user', text: 'I like pho' }],
    });
    t.chunk(0.3);
    expect(t.client.sendAudio).not.toHaveBeenCalled();
  });

  it('ends automatically when the granted time runs out', async () => {
    const t = setup();
    await t.controller.start();
    t.advance(61_000);
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(['ending', 'ended']).toContain(t.controller.getState().status);
    expect(t.controller.getState().endedReason).toBe('time_limit');
    expect(t.mic.stop).toHaveBeenCalled();
  });

  it('turns an unexpected socket close into an error and stops recording', async () => {
    const t = setup();
    await t.controller.start();
    t.events().onClose?.({ code: 1011, reason: 'internal', wasClean: false });
    await vi.waitFor(() => expect(t.controller.getState().status).toBe('error'));
    expect(t.mic.stop).toHaveBeenCalled();
    expect(t.controller.getState().error).toContain('sự cố');
  });

  it('releases a just-created server session if the user cancels while connecting', async () => {
    let resolveStart: (g: SpeakingStartResponse) => void = () => {};
    const t = setup({ apiStart: () => new Promise((r) => (resolveStart = r)) });
    const p = t.controller.start();
    await vi.waitFor(() => expect(t.api.start).toHaveBeenCalled());
    await t.controller.end('user');
    resolveStart(grant);
    await p;
    expect(t.client.connect).not.toHaveBeenCalled();
    expect(t.api.end).toHaveBeenCalledWith('sess-1', expect.objectContaining({ status: 'failed', errorCode: 'cancelled' }));
    expect(t.controller.getState().status).toBe('ended');
  });
});

describe('FallbackSpeakingController', () => {
  function fallback(withStt = true) {
    const tts: TextToSpeechProvider = {
      name: 'fake',
      isSupported: () => true,
      speak: vi.fn((_text, opts) => opts?.onEnd?.()),
      cancel: vi.fn(),
      speaking: () => false,
    };
    let resolveListen: (text: string) => void = () => {};
    let listeningCb: (() => void) | undefined;
    const stt: SpeechToTextProvider = {
      name: 'browser',
      listen: vi.fn((cb) => {
        listeningCb = cb?.onListening;
        return { result: new Promise<string>((r) => (resolveListen = r)), stop: vi.fn(), abort: vi.fn() };
      }),
    };
    const api: SpeakingApi = {
      start: vi.fn(async () => ({ transport: 'fallback' as const, sessionId: 'fb-1', maxSeconds: 1800, opening: 'Hi! How are you?' })),
      turn: vi.fn(async () => ({ reply: 'Nice! What did you eat today?' })),
      end: vi.fn(async () => ({ durationSeconds: 30 })),
    };
    const controller = new FallbackSpeakingController({ level: 'A2' }, { api, stt: withStt ? stt : null, tts });
    return { controller, tts, stt, api, hear: (t: string) => resolveListen(t), micOn: () => listeningCb?.() };
  }

  it('speaks the opening, then listens only once the mic is actually capturing', async () => {
    const f = fallback();
    await f.controller.start();
    expect(f.tts.speak).toHaveBeenCalledWith('Hi! How are you?', expect.anything());
    expect(f.controller.getState().status).toBe('requesting_mic');
    f.micOn();
    expect(f.controller.getState().status).toBe('listening');

    f.hear('I am fine thank you');
    await vi.waitFor(() => expect(f.api.turn).toHaveBeenCalledWith('fb-1', 'I am fine thank you'));
    await vi.waitFor(() => expect(f.controller.getState().transcript).toHaveLength(3));
    expect(f.tts.speak).toHaveBeenLastCalledWith('Nice! What did you eat today?', expect.anything());
  });

  it('works as a typing-only session when speech recognition is unavailable', async () => {
    const f = fallback(false);
    await f.controller.start();
    expect(f.controller.getState().status).toBe('waiting');
    await f.controller.sendText('I like noodles');
    expect(f.api.turn).toHaveBeenCalledWith('fb-1', 'I like noodles');
    expect(f.stt.listen).not.toHaveBeenCalled();
  });

  it('ends cleanly and stops speech output', async () => {
    const f = fallback();
    await f.controller.start();
    await f.controller.end();
    expect(f.controller.getState()).toMatchObject({ status: 'ended', durationSeconds: 30, micLive: false });
    expect(f.tts.cancel).toHaveBeenCalled();
  });
});

describe('speaking tier selection', () => {
  const full: SpeechSupport = {
    secureContext: true,
    microphone: true,
    realtimeAudio: true,
    webSocket: true,
    speechRecognition: true,
    speechSynthesis: true,
  };
  it('prefers realtime, then browser speech, then text', () => {
    expect(chooseTier(full, { aiVoice: true, aiText: true })).toBe('realtime');
    expect(chooseTier(full, { aiVoice: false, aiText: true })).toBe('fallback');
    expect(chooseTier({ ...full, speechRecognition: false }, { aiVoice: false, aiText: true })).toBe('text');
    expect(chooseTier({ ...full, secureContext: false }, { aiVoice: true, aiText: true })).toBe('text');
  });
});
