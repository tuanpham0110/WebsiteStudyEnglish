import { startMicCapture, type MicCapture } from './mic-capture';
import { concatInt16 } from './pcm';

export type PcmRecording = { result: Promise<Int16Array | null>; stop: () => void; abort: () => void };

/** One bounded capture shared by local journaling and acoustic assessment. */
export function recordPcm(onListening?: () => void, maxSeconds = 15): PcmRecording {
    const chunks: Int16Array[] = [];
    const maxSamples = Math.min(15, Math.max(1,maxSeconds)) * 16000;
    let samples = 0;
    let cancelled = false;
    let finished = false;
    let mic: MicCapture | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let release!: () => void;
    const done = new Promise<void>((resolve) => { release = resolve; });
    const stop = () => { finished = true; release(); };
    const result = (async () => {
        try {
            mic = await startMicCapture({ onChunk: ({ pcm }) => {
                if (finished || cancelled) return;
                const take = pcm.slice(0, maxSamples-samples);
                chunks.push(take); samples += take.length;
                if (samples >= maxSamples) stop();
            } });
            if (!cancelled && !finished) { onListening?.(); timer = setTimeout(stop,maxSeconds*1000); }
            await done;
            return cancelled ? null : concatInt16(chunks);
        } finally {
            clearTimeout(timer);
            await mic?.stop();
        }
    })();
    return { result, stop, abort: () => { cancelled = true; stop(); } };
}
