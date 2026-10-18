import type { Level, LiveVoice } from '@shared/constants';
import type { SpeakingStartResponse, TranscriptLine } from '@shared/schemas';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { base64ToInt16 } from '@/lib/audio/pcm';
import { micErrorFrom, startMicCapture, type MicCapture, type MicChunk } from '@/lib/audio/mic-capture';
import { PcmPlayer } from '@/lib/audio/pcm-player';
import { describeClose, GeminiLiveClient, type LiveEvents } from '@/lib/realtime/gemini-live-client';
import type { SpeechToTextProvider, SpeechToTextSession } from '@/lib/speech/stt';
import type { TextToSpeechProvider } from '@/lib/speech/tts';

export type SpeakingStatus =
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'waiting'
  | 'ending'
  | 'ended'
  | 'error';

export type TranscriptEntry = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
  interrupted?: boolean;
  /** Assistant audio kept in memory only (never uploaded) for "replay". */
  audio?: Int16Array[];
};

export type SpeakingState = {
  transport: 'realtime' | 'fallback';
  status: SpeakingStatus;
  sessionId: string | null;
  transcript: TranscriptEntry[];
  interim: string;
  startedAt: number | null;
  elapsed: number;
  maxSeconds: number;
  muted: boolean;
  micLive: boolean;
  error: string | null;
  errorCode: string | null;
  notice: string | null;
  endedReason: 'user' | 'time_limit' | 'error' | 'go_away' | null;
  durationSeconds: number | null;
};

const initialState = (transport: SpeakingState['transport']): SpeakingState => ({
  transport,
  status: 'idle',
  sessionId: null,
  transcript: [],
  interim: '',
  startedAt: null,
  elapsed: 0,
  maxSeconds: 0,
  muted: false,
  micLive: false,
  error: null,
  errorCode: null,
  notice: null,
  endedReason: null,
  durationSeconds: null,
});

type StartBody = { transport: 'realtime' | 'fallback'; level: Level; topic?: string; scenarioId?: string; voice?: LiveVoice };

export type SpeakingApi = {
  start(body: StartBody): Promise<SpeakingStartResponse>;
  turn(sessionId: string, text: string): Promise<{ reply: string }>;
  end(sessionId: string, body: { status: 'completed' | 'failed'; errorCode?: string; transcript?: TranscriptLine[] }): Promise<{
    durationSeconds: number;
  }>;
};

export const httpSpeakingApi: SpeakingApi = {
  start: (body) => api<SpeakingStartResponse>('/api/speaking/sessions', { body }),
  turn: (id, text) => api<{ reply: string }>(`/api/speaking/sessions/${id}/turn`, { body: { text } }),
  end: (id, body) => api<{ durationSeconds: number }>(`/api/speaking/sessions/${id}/end`, { body }),
};

const ACTIVE: SpeakingStatus[] = ['requesting_mic', 'connecting', 'listening', 'thinking', 'speaking', 'waiting'];

abstract class Store {
  protected state: SpeakingState;
  private listeners = new Set<() => void>();
  private nextId = 1;

  constructor(transport: SpeakingState['transport']) {
    this.state = initialState(transport);
  }

  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  protected set(patch: Partial<SpeakingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  get active() {
    return ACTIVE.includes(this.state.status);
  }

  protected addEntry(role: TranscriptEntry['role'], text: string, final: boolean): TranscriptEntry {
    const entry: TranscriptEntry = { id: this.nextId++, role, text, final };
    this.set({ transcript: [...this.state.transcript, entry] });
    return entry;
  }

  protected updateEntry(id: number, patch: Partial<TranscriptEntry>) {
    this.set({ transcript: this.state.transcript.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  protected transcriptForServer(): TranscriptLine[] {
    return this.state.transcript
      .filter((e) => e.text.trim())
      .slice(-300)
      .map((e) => ({ role: e.role, text: e.text.trim().slice(0, 4000) }));
  }

  abstract start(): Promise<void>;
  abstract end(reason?: SpeakingState['endedReason']): Promise<void>;
  abstract setMuted(muted: boolean): void;
  abstract replay(entryId: number): void;
  abstract destroy(): void;
}

// ---------------------------------------------------------------------------
// Tier 1: realtime voice-to-voice (Gemini Live over WebSocket)
// ---------------------------------------------------------------------------

export type RealtimeDeps = {
  api: SpeakingApi;
  startMic: typeof startMicCapture;
  createPlayer: (sampleRate: number) => Pick<PcmPlayer, 'enqueue' | 'interrupt' | 'close' | 'resume' | 'playClip' | 'onDrained' | 'playing'>;
  createClient: (options: ConstructorParameters<typeof GeminiLiveClient>[0]) => Pick<
    GeminiLiveClient,
    'connect' | 'sendAudio' | 'sendAudioStreamEnd' | 'sendText' | 'close'
  >;
  now: () => number;
};

const defaultRealtimeDeps: RealtimeDeps = {
  api: httpSpeakingApi,
  startMic: startMicCapture,
  createPlayer: (rate) => new PcmPlayer(rate),
  createClient: (options) => new GeminiLiveClient(options),
  now: () => Date.now(),
};

const SPEECH_RMS = 0.02;
const THINKING_SILENCE_MS = 900;
const MAX_AUDIO_TURNS = 20;

export class RealtimeSpeakingController extends Store {
  private readonly deps: RealtimeDeps;
  private mic: MicCapture | null = null;
  private player: ReturnType<RealtimeDeps['createPlayer']> | null = null;
  private replayPlayer: ReturnType<RealtimeDeps['createPlayer']> | null = null;
  private client: ReturnType<RealtimeDeps['createClient']> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private currentUser: number | null = null;
  private currentAssistant: number | null = null;
  private userSpeechAt = 0;
  private userSpokeThisTurn = false;
  private modelAudioThisTurn = false;
  private outputRate = 24000;
  private ending = false;

  constructor(
    private readonly options: { level: Level; topic?: string; scenarioId?: string; voice: LiveVoice },
    deps: Partial<RealtimeDeps> = {},
  ) {
    super('realtime');
    this.deps = { ...defaultRealtimeDeps, ...deps };
  }

  async start() {
    if (this.active) return;
    this.ending = false;
    Object.assign(this, { currentUser: null, currentAssistant: null, userSpokeThisTurn: false, modelAudioThisTurn: false });
    this.set({ ...initialState('realtime'), status: 'requesting_mic' });

    // Created synchronously inside the click so the browser allows audio output.
    this.player = this.deps.createPlayer(this.outputRate);
    void this.player.resume();

    try {
      this.mic = await this.deps.startMic({ onChunk: (chunk) => this.onMicChunk(chunk) });
    } catch (error) {
      if (this.ending) return;
      const micError = micErrorFrom(error);
      await this.cleanup();
      return this.fail(micError.message, `mic_${micError.reason}`);
    }
    if (this.state.status !== 'requesting_mic') return void this.cleanup();
    this.set({ status: 'connecting', micLive: true });

    let grant: SpeakingStartResponse;
    try {
      grant = await this.deps.api.start({
        transport: 'realtime',
        level: this.options.level,
        topic: this.options.topic,
        scenarioId: this.options.scenarioId,
        voice: this.options.voice,
      });
      if (grant.transport !== 'realtime') throw new Error('unexpected transport');
    } catch (error) {
      if (this.ending) return;
      await this.cleanup();
      return this.fail(errorMessage(error), error instanceof ApiRequestError ? error.code : 'start_failed');
    }

    this.outputRate = grant.outputSampleRate;
    this.set({ sessionId: grant.sessionId, maxSeconds: grant.maxSeconds });
    if (this.ending) {
      // The user ended while we were waiting: release the server-side session right away.
      await this.reportEnd('failed', 'cancelled');
      return;
    }
    if (grant.outputSampleRate !== 24000) {
      void this.player.close();
      this.player = this.deps.createPlayer(grant.outputSampleRate);
    }

    this.client = this.deps.createClient({
      wsUrl: grant.wsUrl,
      token: grant.token,
      setup: grant.setup,
      inputSampleRate: grant.inputSampleRate,
      events: this.events(),
    });
    try {
      await this.client.connect();
    } catch (error) {
      if (this.ending) return;
      await this.cleanup();
      await this.reportEnd('failed', 'connect_failed');
      return this.fail(errorMessage(error), 'connect_failed');
    }
    if (this.ending) return;

    this.connected = true;
    this.set({ status: 'listening', startedAt: this.deps.now() });
    this.timer = setInterval(() => this.tick(), 250);
    // Ask the model to open the conversation (instructions are locked in the token).
    this.client.sendText('(The learner has joined the call. Greet them briefly and start the conversation.)');
  }

  private events(): LiveEvents {
    return {
      onAudio: (b64) => {
        if (!this.connected) return;
        const pcm = base64ToInt16(b64);
        this.player?.enqueue(pcm);
        this.modelAudioThisTurn = true;
        const entry = this.ensureAssistant();
        const audio = entry.audio ?? [];
        audio.push(pcm);
        this.updateEntry(entry.id, { audio });
        if (this.state.status !== 'speaking') this.set({ status: 'speaking' });
      },
      onOutputTranscript: (text) => {
        const entry = this.ensureAssistant();
        this.updateEntry(entry.id, { text: entry.text + text });
      },
      onInputTranscript: (text) => {
        this.userSpokeThisTurn = true;
        if (this.currentUser === null) this.currentUser = this.addEntry('user', '', false).id;
        const entry = this.state.transcript.find((e) => e.id === this.currentUser)!;
        this.updateEntry(entry.id, { text: entry.text + text });
      },
      onInterrupted: () => {
        this.player?.interrupt();
        if (this.currentAssistant !== null) this.updateEntry(this.currentAssistant, { final: true, interrupted: true });
        this.currentAssistant = null;
        this.modelAudioThisTurn = false;
        if (this.connected) this.set({ status: 'listening' });
      },
      onTurnComplete: () => {
        if (this.currentUser !== null) this.updateEntry(this.currentUser, { final: true });
        if (this.currentAssistant !== null) this.updateEntry(this.currentAssistant, { final: true });
        this.currentUser = null;
        this.currentAssistant = null;
        this.userSpokeThisTurn = false;
        this.modelAudioThisTurn = false;
        this.trimAudio();
        const toListening = () => {
          if (this.connected && (this.state.status === 'speaking' || this.state.status === 'thinking')) this.set({ status: 'listening' });
        };
        if (this.player?.playing) {
          const off = this.player.onDrained(() => {
            off();
            toListening();
          });
        } else toListening();
      },
      onVoiceActivity: (type) => {
        if (type === 'end' && this.connected && this.state.status === 'listening' && !this.modelAudioThisTurn) {
          this.set({ status: 'thinking' });
        }
      },
      onGoAway: () => void this.end('go_away'),
      onClose: (info) => {
        if (this.ending) return;
        const elapsed = this.state.elapsed;
        void (async () => {
          await this.cleanup();
          await this.reportEnd(elapsed > 15 ? 'completed' : 'failed', 'connection_closed');
          this.fail(describeClose(info.code, info.reason), 'connection_closed');
        })();
      },
    };
  }

  private ensureAssistant(): TranscriptEntry {
    if (this.currentAssistant === null) {
      if (this.currentUser !== null) {
        this.updateEntry(this.currentUser, { final: true });
        this.currentUser = null;
      }
      this.currentAssistant = this.addEntry('assistant', '', false).id;
    }
    return this.state.transcript.find((e) => e.id === this.currentAssistant)!;
  }

  private trimAudio() {
    const withAudio = this.state.transcript.filter((e) => e.audio?.length);
    if (withAudio.length <= MAX_AUDIO_TURNS) return;
    const drop = new Set(withAudio.slice(0, withAudio.length - MAX_AUDIO_TURNS).map((e) => e.id));
    this.set({ transcript: this.state.transcript.map((e) => (drop.has(e.id) ? { ...e, audio: undefined } : e)) });
  }

  private onMicChunk({ pcm, rms }: MicChunk) {
    if (!this.connected || this.state.muted) return;
    this.client?.sendAudio(pcm);
    const now = this.deps.now();
    if (rms > SPEECH_RMS) {
      this.userSpeechAt = now;
      this.userSpokeThisTurn = true;
      if (this.state.status === 'thinking') this.set({ status: 'listening' });
    } else if (
      this.userSpokeThisTurn &&
      !this.modelAudioThisTurn &&
      this.state.status === 'listening' &&
      now - this.userSpeechAt > THINKING_SILENCE_MS
    ) {
      this.set({ status: 'thinking' });
    }
  }

  private tick() {
    if (!this.connected || this.state.startedAt === null) return;
    const elapsed = (this.deps.now() - this.state.startedAt) / 1000;
    this.set({ elapsed });
    if (this.mic && !this.mic.isLive()) {
      void this.end('error').then(() => this.set({ notice: 'Micro đã bị ngắt kết nối nên phiên được kết thúc.' }));
      return;
    }
    if (this.state.maxSeconds > 0 && elapsed >= this.state.maxSeconds) void this.end('time_limit');
  }

  setMuted(muted: boolean) {
    if (!this.mic) return;
    this.mic.setMuted(muted);
    if (muted) this.client?.sendAudioStreamEnd();
    this.set({ muted });
  }

  async end(reason: SpeakingState['endedReason'] = 'user') {
    if (!this.active || this.ending) return;
    this.ending = true;
    const wasConnected = this.connected;
    this.set({ status: 'ending', endedReason: reason });
    if (this.currentUser !== null) this.updateEntry(this.currentUser, { final: true });
    if (this.currentAssistant !== null) this.updateEntry(this.currentAssistant, { final: true });
    await this.cleanup();
    const result = wasConnected || this.state.sessionId ? await this.reportEnd('completed') : null;
    this.set({
      status: 'ended',
      durationSeconds: result?.durationSeconds ?? Math.round(this.state.elapsed),
      notice: reason === 'time_limit' ? 'Đã hết thời lượng cho phép của phiên này.' : reason === 'go_away' ? 'Máy chủ giọng nói yêu cầu kết thúc phiên.' : null,
    });
  }

  private async reportEnd(status: 'completed' | 'failed', errorCode?: string) {
    const sessionId = this.state.sessionId;
    if (!sessionId) return null;
    try {
      return await this.deps.api.end(sessionId, { status, errorCode, transcript: this.transcriptForServer() });
    } catch {
      return null;
    }
  }

  /** Release the microphone, socket and audio output. Safe to call repeatedly. */
  private async cleanup() {
    this.connected = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const mic = this.mic;
    this.mic = null;
    this.client?.close();
    this.client = null;
    const player = this.player;
    this.player = null;
    await Promise.allSettled([mic?.stop(), player?.close()]);
    this.set({ micLive: false });
  }

  private fail(message: string, code: string) {
    this.ending = true;
    this.set({ status: 'error', error: message, errorCode: code, endedReason: 'error' });
  }

  replay(entryId: number) {
    if (this.active) return;
    const entry = this.state.transcript.find((e) => e.id === entryId);
    if (!entry?.audio?.length) return;
    this.replayPlayer ??= this.deps.createPlayer(this.outputRate);
    void this.replayPlayer.resume();
    this.replayPlayer.playClip(entry.audio);
  }

  destroy() {
    if (this.active) void this.end('user');
    else void this.cleanup();
    void this.replayPlayer?.close();
    this.replayPlayer = null;
  }
}

// ---------------------------------------------------------------------------
// Tier 2/3: browser speech recognition + AI text + browser speech synthesis,
// or typing only when speech recognition is unavailable.
// ---------------------------------------------------------------------------

export type FallbackDeps = {
  api: SpeakingApi;
  stt: SpeechToTextProvider | null;
  tts: TextToSpeechProvider | null;
  now: () => number;
};

export class FallbackSpeakingController extends Store {
  private readonly deps: FallbackDeps;
  private listening: SpeechToTextSession | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private silentAttempts = 0;
  private autoListen = true;
  private ended = false;

  constructor(
    private readonly options: { level: Level; topic?: string; scenarioId?: string; ttsRate?: number; ttsVoice?: string | null },
    deps: Partial<FallbackDeps> & Pick<FallbackDeps, 'stt' | 'tts'>,
  ) {
    super('fallback');
    this.deps = { api: httpSpeakingApi, now: () => Date.now(), ...deps };
  }

  get canListen() {
    return this.deps.stt !== null;
  }

  setAutoListen(value: boolean) {
    this.autoListen = value;
  }

  async start() {
    if (this.active) return;
    this.ended = false;
    this.silentAttempts = 0;
    this.set({ ...initialState('fallback'), status: 'connecting' });
    let grant: SpeakingStartResponse;
    try {
      grant = await this.deps.api.start({
        transport: 'fallback',
        level: this.options.level,
        topic: this.options.topic,
        scenarioId: this.options.scenarioId,
      });
      if (grant.transport !== 'fallback') throw new Error('unexpected transport');
    } catch (error) {
      return this.fail(errorMessage(error), error instanceof ApiRequestError ? error.code : 'start_failed');
    }
    if (this.ended) return;
    this.set({ sessionId: grant.sessionId, maxSeconds: grant.maxSeconds, startedAt: this.deps.now() });
    this.timer = setInterval(() => this.tick(), 500);
    this.addEntry('assistant', grant.opening, true);
    this.say(grant.opening);
  }

  private tick() {
    if (this.state.startedAt === null) return;
    const elapsed = (this.deps.now() - this.state.startedAt) / 1000;
    this.set({ elapsed });
    if (this.state.maxSeconds > 0 && elapsed >= this.state.maxSeconds) void this.end('time_limit');
  }

  private say(text: string) {
    if (this.ended) return;
    const after = () => {
      if (this.ended) return;
      if (this.autoListen && this.canListen && !this.state.muted) this.listen();
      else this.set({ status: 'waiting' });
    };
    if (!this.deps.tts?.isSupported()) return after();
    this.set({ status: 'speaking' });
    this.deps.tts.speak(text, { rate: this.options.ttsRate, voiceURI: this.options.ttsVoice, onEnd: after });
  }

  /** Start listening once (also used by the "Nói" push-to-talk button). */
  listen() {
    if (this.ended || !this.deps.stt || this.listening) return;
    this.deps.tts?.cancel();
    // Not "listening" until the browser reports the microphone is actually capturing.
    this.set({ status: 'requesting_mic', interim: '', muted: false });
    const session = this.deps.stt.listen({
      onListening: () => {
        if (!this.ended) this.set({ status: 'listening', micLive: true });
      },
      onInterim: (text) => this.set({ interim: text }),
    });
    this.listening = session;
    session.result
      .then((text) => {
        if (this.listening !== session || this.ended) return;
        this.listening = null;
        this.set({ interim: '', micLive: false });
        if (text) {
          this.silentAttempts = 0;
          void this.handleUserText(text);
        } else if (++this.silentAttempts < 2 && this.autoListen) {
          this.listen();
        } else {
          this.set({ status: 'waiting', notice: 'Không nghe thấy gì. Nhấn “Nói” để thử lại hoặc gõ câu trả lời.' });
        }
      })
      .catch((error: Error & { reason?: string }) => {
        if (this.listening !== session) return;
        this.listening = null;
        this.set({ interim: '', micLive: false });
        if (error.reason === 'not-allowed' || error.reason === 'service-not-allowed') {
          void this.end('error').then(() => this.set({ status: 'error', error: error.message, errorCode: 'mic_denied' }));
        } else {
          this.set({ status: 'waiting', notice: `${error.message} Bạn vẫn có thể gõ câu trả lời.` });
        }
      });
  }

  stopListening() {
    this.listening?.stop();
  }

  async sendText(text: string) {
    const clean = text.trim();
    if (!clean || this.ended || !this.state.sessionId) return;
    if (this.listening) {
      const s = this.listening;
      this.listening = null;
      s.abort();
    }
    await this.handleUserText(clean);
  }

  private async handleUserText(text: string) {
    this.addEntry('user', text, true);
    this.set({ status: 'thinking', notice: null });
    try {
      const { reply } = await this.deps.api.turn(this.state.sessionId!, text);
      if (this.ended) return;
      this.addEntry('assistant', reply, true);
      this.say(reply);
    } catch (error) {
      if (this.ended) return;
      this.set({ status: 'waiting', notice: errorMessage(error) });
    }
  }

  setMuted(muted: boolean) {
    this.set({ muted });
    if (muted) {
      const s = this.listening;
      this.listening = null;
      s?.abort();
      this.set({ status: 'waiting', micLive: false, interim: '' });
    } else if (this.canListen && this.state.status === 'waiting') {
      this.listen();
    }
  }

  async end(reason: SpeakingState['endedReason'] = 'user') {
    if (this.ended) return;
    this.ended = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const s = this.listening;
    this.listening = null;
    s?.abort();
    this.deps.tts?.cancel();
    this.set({ status: 'ending', endedReason: reason, micLive: false, interim: '' });
    let duration: number | null = null;
    if (this.state.sessionId) {
      try {
        duration = (await this.deps.api.end(this.state.sessionId, { status: 'completed' })).durationSeconds;
      } catch {
        duration = null;
      }
    }
    this.set({
      status: 'ended',
      durationSeconds: duration ?? Math.round(this.state.elapsed),
      notice: reason === 'time_limit' ? 'Đã hết thời lượng cho phép của phiên này.' : this.state.notice,
    });
  }

  private fail(message: string, code: string) {
    this.ended = true;
    if (this.timer) clearInterval(this.timer);
    this.set({ status: 'error', error: message, errorCode: code, endedReason: 'error' });
  }

  replay(entryId: number) {
    const entry = this.state.transcript.find((e) => e.id === entryId);
    if (entry && this.deps.tts?.isSupported()) {
      this.deps.tts.speak(entry.text, { rate: this.options.ttsRate, voiceURI: this.options.ttsVoice });
    }
  }

  destroy() {
    if (!this.ended && this.state.status !== 'idle') void this.end('user');
    this.deps.tts?.cancel();
  }
}
