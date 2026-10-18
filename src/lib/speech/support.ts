// Feature detection for the speaking tiers. Nothing here asks for permissions.

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((ev: Event) => void) | null;
  onaudiostart: ((ev: Event) => void) | null;
  onspeechstart: ((ev: Event) => void) | null;
  onspeechend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((ev: { error: string; message?: string }) => void) | null;
  onend: ((ev: Event) => void) | null;
}

export type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number }; length: number }>;
};

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechSupport = {
  secureContext: boolean;
  microphone: boolean;
  realtimeAudio: boolean;
  webSocket: boolean;
  speechRecognition: boolean;
  speechSynthesis: boolean;
};

export function detectSpeechSupport(): SpeechSupport {
  const hasWindow = typeof window !== 'undefined';
  return {
    secureContext: hasWindow ? window.isSecureContext : false,
    microphone: hasWindow && Boolean(navigator.mediaDevices?.getUserMedia),
    realtimeAudio: hasWindow && typeof AudioWorkletNode !== 'undefined' && typeof AudioContext !== 'undefined',
    webSocket: hasWindow && typeof WebSocket !== 'undefined',
    speechRecognition: getSpeechRecognition() !== null,
    speechSynthesis: hasWindow && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
  };
}

export type SpeakingTier = 'realtime' | 'fallback' | 'text';

/** Pick the best tier available: realtime voice → browser STT/TTS → text. */
export function chooseTier(support: SpeechSupport, server: { aiVoice: boolean; aiText: boolean }): SpeakingTier {
  const canCapture = support.secureContext && support.microphone;
  if (server.aiVoice && canCapture && support.realtimeAudio && support.webSocket) return 'realtime';
  if (server.aiText && canCapture && support.speechRecognition && support.speechSynthesis) return 'fallback';
  return 'text';
}
