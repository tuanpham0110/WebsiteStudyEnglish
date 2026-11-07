import { z } from 'zod';
import { pronunciationResultSchema, type PronunciationResult } from '../../shared/schemas';
import { ApiError, ProviderError } from '../errors';

/** Accept only the bounded, canonical 16 kHz mono PCM WAV our recorder emits. */
export function decodePronunciationAudio(base64: string): Uint8Array {
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)); }
    catch { throw new ApiError('VALIDATION_ERROR', 'Bản ghi âm không hợp lệ.'); }
    const view = new DataView(bytes.buffer);
    const tag = (at: number, value: string) => [...value].every((c,i) => bytes[at+i] === c.charCodeAt(0));
    if (bytes.length < 44 + 12800 || bytes.length > 44 + 16000*2*15 || !tag(0,'RIFF') || !tag(8,'WAVE') || !tag(12,'fmt ') || !tag(36,'data') ||
        view.getUint32(4,true) !== bytes.length-8 || view.getUint32(16,true) !== 16 || view.getUint16(20,true) !== 1 || view.getUint16(22,true) !== 1 ||
        view.getUint32(24,true) !== 16000 || view.getUint32(28,true) !== 32000 || view.getUint16(32,true) !== 2 || view.getUint16(34,true) !== 16 || view.getUint32(40,true) !== bytes.length-44 || bytes.length % 2 !== 0) {
        throw new ApiError('VALIDATION_ERROR', 'Cần bản ghi WAV PCM 16 kHz mono, dài từ 0,4 đến 15 giây.');
    }
    return bytes;
}
const score = z.number().min(0).max(100);
const scores = z.object({ AccuracyScore: score, FluencyScore: score, CompletenessScore: score, PronScore: score });
const phoneme = z.object({ Phoneme: z.string(), AccuracyScore: score.optional(), PronunciationAssessment: z.object({ AccuracyScore: score }).optional() });
const word = z.object({ Word: z.string(), AccuracyScore: score.optional(), ErrorType: z.string().optional(), PronunciationAssessment: z.object({ AccuracyScore: score.optional(), ErrorType: z.string().optional() }).optional(), Phonemes: z.array(phoneme).max(100).optional() });
const result = z.object({ RecognitionStatus: z.string(), DisplayText: z.string().optional(), NBest: z.array(z.looseObject({ Display: z.string().optional(), PronunciationAssessment: scores.optional(), Words: z.array(word).max(300).optional() })).optional() });

export class AzurePronunciationProvider {
    readonly name = 'azure';
    readonly model = 'pronunciation-en-us';
    constructor(private readonly config: { apiKey: string; endpoint: string }) {}
    async assess(audio: Uint8Array, referenceText: string): Promise<PronunciationResult> {
        // Prosody is deliberately not enabled: Azure can charge it separately.
        const params = { ReferenceText: referenceText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: 'True', PhonemeAlphabet: 'IPA' };
        const header = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(params))));
        let response: Response;
        try {
            response = await fetch(`${this.config.endpoint}/stt/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`, {
                method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': this.config.apiKey, 'Pronunciation-Assessment': header, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json' },
                body: audio as Uint8Array<ArrayBuffer>, signal: AbortSignal.timeout(30_000),
            });
        } catch { throw new ProviderError('unavailable','Azure speech request failed'); }
        if (!response.ok) throw new ProviderError(response.status === 429 ? 'quota' : response.status === 401 || response.status === 403 ? 'auth' : 'unavailable', `Azure speech ${response.status}`,response.status);
        let raw: unknown;
        try { raw = await response.json(); } catch { throw new ProviderError('invalid_output','Azure returned invalid JSON'); }
        const parsed = result.safeParse(raw);
        if (!parsed.success) throw new ProviderError('invalid_output','Azure speech schema mismatch');
        if (parsed.data.RecognitionStatus !== 'Success') throw new ProviderError('invalid_output','Azure could not recognize speech');
        const best = parsed.data.NBest?.[0];
        const values = scores.safeParse(best?.PronunciationAssessment ?? best);
        if (!best || !values.success) throw new ProviderError('invalid_output','Azure returned no acoustic scores');
        const normalized = pronunciationResultSchema.safeParse({ provider: 'azure', transcript: best.Display ?? parsed.data.DisplayText ?? '',
            accuracy: values.data.AccuracyScore, fluency: values.data.FluencyScore, completeness: values.data.CompletenessScore, score: values.data.PronScore,
            words: (best.Words ?? []).map((w) => ({ word: w.Word, accuracy: w.PronunciationAssessment?.AccuracyScore ?? w.AccuracyScore ?? null, errorType: w.PronunciationAssessment?.ErrorType ?? w.ErrorType ?? 'None', phonemes: (w.Phonemes ?? []).map((p) => ({ phoneme: p.Phoneme, accuracy: p.PronunciationAssessment?.AccuracyScore ?? p.AccuracyScore })) })),
        });
        if (!normalized.success) throw new ProviderError('invalid_output','Azure phoneme score missing');
        return normalized.data;
    }
}
