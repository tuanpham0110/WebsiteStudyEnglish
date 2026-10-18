import { useCallback, useEffect, useRef, useState } from 'react';
import { englishVoices, loadVoices } from '@/lib/speech/tts';

type Line = { speaker: string; text: string };

/**
 * Plays a dialogue line by line with the browser's speech synthesizer, giving
 * each speaker a different English voice when the device has several.
 */
export function useScriptPlayer(lines: Line[], options: { rate: number; preferredVoice?: string | null }) {
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const stopRef = useRef(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    void loadVoices().then(setVoices);
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const voiceFor = useCallback(
    (speaker: string) => {
      const list = voices.length ? voices : englishVoices();
      if (!list.length) return undefined;
      const preferred = options.preferredVoice ? list.find((v) => v.voiceURI === options.preferredVoice) : undefined;
      const idx = speakers.indexOf(speaker);
      if (idx === 0 && preferred) return preferred;
      return list[idx % list.length];
    },
    [voices, speakers, options.preferredVoice],
  );

  const playFrom = useCallback(
    (start: number, single = false) => {
      if (!supported || start < 0 || start >= lines.length) return;
      window.speechSynthesis.cancel();
      stopRef.current = false;
      setPlaying(true);
      const playLine = (i: number) => {
        if (stopRef.current || i >= lines.length) {
          setPlaying(false);
          return;
        }
        setCurrent(i);
        const u = new SpeechSynthesisUtterance(lines[i].text);
        const voice = voiceFor(lines[i].speaker);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        } else u.lang = 'en-US';
        u.rate = options.rate;
        u.onend = () => {
          if (single) setPlaying(false);
          else setTimeout(() => playLine(i + 1), 350);
        };
        u.onerror = () => setPlaying(false);
        window.speechSynthesis.speak(u);
      };
      playLine(start);
    },
    [supported, lines, voiceFor, options.rate],
  );

  const pause = useCallback(() => {
    stopRef.current = true;
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }, []);

  return {
    supported,
    current,
    playing,
    play: () => playFrom(current < 0 || current >= lines.length - 1 ? 0 : current),
    pause,
    playLine: (i: number) => playFrom(i, true),
    next: () => playFrom(Math.min(lines.length - 1, current + 1)),
    previous: () => playFrom(Math.max(0, current - 1)),
    speakText: (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voiceFor(speakers[0] ?? '');
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = 'en-US';
      u.rate = options.rate;
      window.speechSynthesis.speak(u);
    },
  };
}
