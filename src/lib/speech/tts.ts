// TextToSpeechProvider — the browser's speechSynthesis (free, on-device or
// OS-provided voices). Quality depends on the voices installed on the device.

export interface TextToSpeechProvider {
  readonly name: string;
  isSupported(): boolean;
  speak(text: string, options?: { rate?: number; voiceURI?: string | null; lang?: string; onEnd?: () => void; onStart?: () => void }): void;
  cancel(): void;
  speaking(): boolean;
}

export function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
}

/** Resolves once the browser has loaded its voice list (Chrome loads it asynchronously). */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve([]);
    const now = englishVoices();
    if (now.length) return resolve(now);
    const timer = setTimeout(() => resolve(englishVoices()), timeoutMs);
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearTimeout(timer);
        resolve(englishVoices());
      },
      { once: true },
    );
  });
}

function stripMarkdown(text: string) {
  return text.replace(/\*\*|__|`|#+\s|\(Hint:[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

export const browserTTS: TextToSpeechProvider = {
  name: 'browser-speech-synthesis',
  isSupported: () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  speak(text, options = {}) {
    if (!this.isSupported()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
    utterance.lang = options.lang ?? 'en-US';
    utterance.rate = options.rate ?? 1;
    const voices = englishVoices();
    const voice =
      (options.voiceURI && voices.find((v) => v.voiceURI === options.voiceURI)) ||
      voices.find((v) => v.lang === utterance.lang) ||
      voices[0];
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();
    synth.speak(utterance);
  },
  cancel() {
    if (this.isSupported()) window.speechSynthesis.cancel();
  },
  speaking() {
    return this.isSupported() && window.speechSynthesis.speaking;
  },
};
