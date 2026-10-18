import { api } from '@/lib/api';
import { bytesToBase64, concatInt16, encodeWav } from '@/lib/audio/pcm';
import { startMicCapture, type MicCapture } from '@/lib/audio/mic-capture';
import { getSpeechRecognition, type BrowserSpeechRecognition } from './support';

// SpeechToTextProvider implementations used outside realtime sessions.
// - browser: Web Speech API (in Chrome the audio is processed by Google's service)
// - server:  records 16 kHz WAV locally and sends it to /api/stt (counts toward AI quota)

export type ListenCallbacks = {
  onListening?: () => void;
  onInterim?: (text: string) => void;
};

export interface SpeechToTextSession {
  /** Resolves with the final transcript ('' if nothing was recognised). */
  result: Promise<string>;
  stop(): void;
  abort(): void;
}

export interface SpeechToTextProvider {
  readonly name: 'browser' | 'server';
  listen(callbacks?: ListenCallbacks): SpeechToTextSession;
}

export class SttError extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
  }
}

const RECOGNITION_ERRORS: Record<string, string> = {
  'not-allowed': 'Bạn chưa cho phép dùng micro hoặc nhận dạng giọng nói.',
  'service-not-allowed': 'Trình duyệt không cho phép dịch vụ nhận dạng giọng nói.',
  'audio-capture': 'Không thu được âm thanh từ micro.',
  network: 'Dịch vụ nhận dạng giọng nói của trình duyệt cần kết nối mạng.',
  'language-not-supported': 'Trình duyệt không hỗ trợ nhận dạng tiếng Anh.',
};

export const browserSTT: SpeechToTextProvider = {
  name: 'browser',
  listen(callbacks = {}) {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      return { result: Promise.reject(new SttError('unsupported', 'Trình duyệt không hỗ trợ nhận dạng giọng nói.')), stop() {}, abort() {} };
    }
    const recognition: BrowserSpeechRecognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalText = '';
    let aborted = false;
    const result = new Promise<string>((resolve, reject) => {
      recognition.onaudiostart = () => callbacks.onListening?.();
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        callbacks.onInterim?.((finalText + ' ' + interim).trim());
      };
      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        reject(new SttError(event.error, RECOGNITION_ERRORS[event.error] ?? 'Nhận dạng giọng nói gặp lỗi.'));
      };
      recognition.onend = () => resolve(aborted ? '' : finalText.trim());
    });
    try {
      recognition.start();
    } catch {
      return { result: Promise.reject(new SttError('busy', 'Không khởi động được nhận dạng giọng nói.')), stop() {}, abort() {} };
    }
    return {
      result,
      stop: () => recognition.stop(),
      abort: () => {
        aborted = true;
        recognition.abort();
      },
    };
  },
};

/** Records up to `maxSeconds` of audio and transcribes it on the server. */
export function serverSTT(maxSeconds = 15): SpeechToTextProvider & { lastRecording: () => Int16Array | null } {
  let last: Int16Array | null = null;
  return {
    name: 'server',
    lastRecording: () => last,
    listen(callbacks = {}) {
      const chunks: Int16Array[] = [];
      let mic: MicCapture | null = null;
      let finish: (() => void) | null = null;
      let cancelled = false;
      const recorded = new Promise<void>((resolve) => (finish = resolve));
      const result = (async () => {
        mic = await startMicCapture({ onChunk: ({ pcm }) => chunks.push(pcm) });
        callbacks.onListening?.();
        const timer = setTimeout(() => finish?.(), maxSeconds * 1000);
        await recorded;
        clearTimeout(timer);
        await mic.stop();
        if (cancelled) return '';
        const pcm = concatInt16(chunks);
        last = pcm;
        if (pcm.length < 16000 * 0.4) return '';
        const audio = bytesToBase64(encodeWav(pcm, 16000));
        const { transcript } = await api<{ transcript: string }>('/api/stt', { body: { audio, mimeType: 'audio/wav' } });
        return transcript;
      })();
      return {
        result,
        stop: () => finish?.(),
        abort: () => {
          cancelled = true;
          finish?.();
        },
      };
    },
  };
}
