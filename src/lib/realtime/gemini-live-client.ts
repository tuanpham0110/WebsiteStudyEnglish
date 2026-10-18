import { int16ToBase64 } from '@/lib/audio/pcm';

/**
 * Minimal client for the Gemini Live API WebSocket protocol
 * (https://ai.google.dev/api/live). The browser connects directly with a
 * short-lived, single-use token minted by our server; no API key is ever here.
 */
export type LiveEvents = {
  onAudio?: (base64Pcm: string) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onVoiceActivity?: (type: 'start' | 'end') => void;
  onGoAway?: (timeLeft: string | undefined) => void;
  onClose?: (info: { code: number; reason: string; wasClean: boolean }) => void;
};

type ServerMessage = {
  setupComplete?: object;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string }; text?: string }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
    generationComplete?: boolean;
  };
  voiceActivity?: { type?: string };
  goAway?: { timeLeft?: string };
};

export class LiveConnectionError extends Error {
  readonly code: number;
  constructor(message: string, code = 0) {
    super(message);
    this.code = code;
  }
}

export function describeClose(code: number, reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('quota') || r.includes('resource_exhausted') || r.includes('rate')) {
    return 'Nhà cung cấp AI đã hết hạn mức miễn phí tạm thời. Hệ thống không tự chuyển sang gói trả phí.';
  }
  if (r.includes('token') || r.includes('auth') || r.includes('expired') || code === 1008) {
    return 'Phiên kết nối đã hết hạn hoặc không hợp lệ. Hãy bắt đầu phiên mới.';
  }
  if (code === 1011) return 'Máy chủ giọng nói gặp sự cố. Vui lòng thử lại.';
  if (code === 1006) return 'Mất kết nối mạng tới máy chủ giọng nói.';
  return 'Kết nối giọng nói đã đóng.';
}

export class GeminiLiveClient {
  private socket: WebSocket | null = null;
  private readonly decoder = new TextDecoder();
  private closedByUser = false;

  constructor(
    private readonly options: {
      wsUrl: string;
      token: string;
      setup: Record<string, unknown>;
      inputSampleRate: number;
      events: LiveEvents;
      WebSocketImpl?: typeof WebSocket;
      connectTimeoutMs?: number;
    },
  ) {}

  /** Open the socket, send setup and resolve once the server confirms `setupComplete`. */
  connect(): Promise<void> {
    const Impl = this.options.WebSocketImpl ?? WebSocket;
    const url = `${this.options.wsUrl}?access_token=${encodeURIComponent(this.options.token)}`;
    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = new Impl(url);
      socket.binaryType = 'arraybuffer';
      this.socket = socket;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new LiveConnectionError('Kết nối tới máy chủ giọng nói quá lâu. Kiểm tra mạng và thử lại.'));
        this.close();
      }, this.options.connectTimeoutMs ?? 15000);

      socket.onopen = () => socket.send(JSON.stringify({ setup: this.options.setup }));
      socket.onerror = () => {
        /* details arrive in onclose */
      };
      socket.onclose = (event) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new LiveConnectionError(describeClose(event.code, event.reason), event.code));
          return;
        }
        if (!this.closedByUser) {
          this.options.events.onClose?.({ code: event.code, reason: event.reason, wasClean: event.wasClean });
        }
      };
      socket.onmessage = (event) => {
        const message = this.parse(event.data);
        if (!message) return;
        if (message.setupComplete && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
          return;
        }
        this.dispatch(message);
      };
    });
  }

  private parse(data: unknown): ServerMessage | null {
    try {
      const text = typeof data === 'string' ? data : this.decoder.decode(data as ArrayBuffer);
      return JSON.parse(text) as ServerMessage;
    } catch {
      return null;
    }
  }

  private dispatch(message: ServerMessage) {
    const { events } = this.options;
    const content = message.serverContent;
    if (content) {
      // One message can carry several fields at once; handle all of them.
      if (content.interrupted) events.onInterrupted?.();
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) events.onAudio?.(part.inlineData.data);
      }
      if (content.inputTranscription?.text) events.onInputTranscript?.(content.inputTranscription.text);
      if (content.outputTranscription?.text) events.onOutputTranscript?.(content.outputTranscription.text);
      if (content.turnComplete) events.onTurnComplete?.();
    }
    if (message.voiceActivity?.type === 'ACTIVITY_START') events.onVoiceActivity?.('start');
    if (message.voiceActivity?.type === 'ACTIVITY_END') events.onVoiceActivity?.('end');
    if (message.goAway) events.onGoAway?.(message.goAway.timeLeft);
  }

  get isOpen() {
    return this.socket?.readyState === 1;
  }

  sendAudio(pcm: Int16Array) {
    if (!this.isOpen) return;
    this.socket!.send(
      JSON.stringify({
        realtimeInput: { audio: { data: int16ToBase64(pcm), mimeType: `audio/pcm;rate=${this.options.inputSampleRate}` } },
      }),
    );
  }

  /** Tell the server the mic paused (mute) so it can flush cached audio. */
  sendAudioStreamEnd() {
    if (this.isOpen) this.socket!.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  sendText(text: string) {
    if (this.isOpen) this.socket!.send(JSON.stringify({ realtimeInput: { text } }));
  }

  close() {
    this.closedByUser = true;
    const socket = this.socket;
    this.socket = null;
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) socket.close(1000, 'client ended session');
  }
}
