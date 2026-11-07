import { useCallback, useEffect, useRef, useState } from 'react';
import { audioUrlSchema } from '@shared/content';
import { englishVoices, loadVoices } from '@/lib/speech/tts';

type Line = { speaker: string; text: string; audioUrl?: string };

/** Prefer recorded clips; browser TTS is used only for lines without audio. */
export function useScriptPlayer(lines: Line[], options: { rate: number; preferredVoice?: string | null }) {
    const [current, setCurrent] = useState(-1);
    const [playing, setPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const audio = useRef<HTMLAudioElement | null>(null);
    const generation = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
    const recordedCount = lines.filter((line) => line.audioUrl).length;
    const pause = useCallback(() => {
        generation.current++;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        if (audio.current) {
            audio.current.onended = null; audio.current.onerror = null;
            audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); audio.current = null;
        }
        if (ttsSupported) window.speechSynthesis.cancel();
        setPlaying(false);
    }, [ttsSupported]);
    useEffect(() => {
        let active = true;
        if (ttsSupported) void loadVoices().then((v) => { if (active) setVoices(v); });
        return () => { active = false; pause(); };
    }, [ttsSupported, pause]);
    useEffect(() => { pause(); setCurrent(-1); setError(null); }, [lines, pause]);
    useEffect(() => { if (audio.current) audio.current.playbackRate = options.rate; }, [options.rate]);
    const playFrom = useCallback((start: number, single = false, forceTts = false) => {
        if (start < 0 || start >= lines.length) return;
        pause(); setError(null);
        const token = generation.current;
        const speakers = [...new Set(lines.map((line) => line.speaker))];
        const playLine = (i: number) => {
            if (generation.current !== token) return;
            if (i >= lines.length) { setPlaying(false); return; }
            const line = lines[i]; setCurrent(i); setPlaying(true);
            const fail = (message: string) => { if (generation.current === token) { pause(); setError(message); } };
            const next = () => {
                if (generation.current !== token) return;
                if (single) setPlaying(false);
                else timer.current = setTimeout(() => playLine(i+1), 350);
            };
            if (line.audioUrl && !forceTts) {
                if (!audioUrlSchema.safeParse(line.audioUrl).success) return fail('Đường dẫn audio không hợp lệ.');
                const clip = new Audio(line.audioUrl); audio.current = clip; clip.playbackRate = options.rate;
                clip.onended = next; clip.onerror = () => fail('Không tải được bản thu. Hãy thử lại hoặc chọn nghe bằng giọng máy.');
                void clip.play().catch(() => fail('Không phát được bản thu. Hãy chạm Phát để thử lại hoặc chọn giọng máy.'));
            } else {
                if (!ttsSupported) return fail('Câu này chưa có bản thu và thiết bị không hỗ trợ giọng máy.');
                const u = new SpeechSynthesisUtterance(line.text);
                const list = voices.length ? voices : englishVoices(); const idx = speakers.indexOf(line.speaker);
                const voice = (idx === 0 && options.preferredVoice ? list.find((v) => v.voiceURI === options.preferredVoice) : undefined) ?? list[idx % Math.max(1,list.length)];
                if (voice) u.voice = voice;
                u.lang = voice?.lang ?? 'en-US'; u.rate = options.rate;
                u.onend = next; u.onerror = () => fail('Không phát được giọng máy. Hãy thử lại.'); window.speechSynthesis.speak(u);
            }
        };
        playLine(start);
    }, [lines, options.rate, options.preferredVoice, pause, ttsSupported, voices]);
    return {
        supported: ttsSupported || recordedCount > 0, ttsSupported, recordedCount, current, playing, error,
        play: () => playFrom(current < 0 || current >= lines.length-1 ? 0 : current), pause, playLine: (i: number) => playFrom(i,true),
        retryWithTts: () => playFrom(Math.max(0,current),true,true), next: () => playFrom(Math.min(lines.length-1,current+1)), previous: () => playFrom(Math.max(0,current-1)),
        speakText: (text: string) => {
            const i = lines.findIndex((line) => line.text === text);
            if (i >= 0) return playFrom(i,true);
            pause();
            if (!ttsSupported) { setError('Câu chính tả này chưa có bản thu và thiết bị không hỗ trợ giọng máy.'); return; }
            const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = options.rate; window.speechSynthesis.speak(u);
        },
    };
}
