import { afterEach, describe, expect, it, vi } from 'vitest';
import { AzurePronunciationProvider, decodePronunciationAudio } from '../ai/azure-pronunciation';
import { loadConfig } from '../env';
import { makeTestApp } from './fakes';
import { bytesToBase64, encodeWav } from '../../src/lib/audio/pcm';
afterEach(() => vi.unstubAllGlobals());
const wav = () => encodeWav(new Int16Array(16000),16000);
const assessment = { provider: 'azure' as const, transcript: 'Think.', accuracy: 70, fluency: 80, completeness: 100, score: 77, words: [{ word: 'think', accuracy: 70, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'θ', accuracy: 35 }] }] };
describe('acoustic pronunciation', () => {
    it('requires an explicit flag and a trusted Azure resource endpoint', () => {
        expect(loadConfig({ AZURE_SPEECH_KEY: 'secret', AZURE_SPEECH_ENDPOINT: 'https://resource.cognitiveservices.azure.com' }).azureSpeech).toBeNull();
        expect(loadConfig({ AZURE_PRONUNCIATION_ENABLED: 'true', AZURE_SPEECH_KEY: 'secret', AZURE_SPEECH_ENDPOINT: 'https://evil.example' }).azureSpeech).toBeNull();
    });
    it('validates WAV format and duration instead of sending arbitrary payloads upstream', () => {
        expect(decodePronunciationAudio(bytesToBase64(wav()))).toEqual(wav());
        for (const audio of [new Uint8Array(100), encodeWav(new Int16Array(16000*16),16000), encodeWav(new Int16Array(16000),8000)]) {
            expect(() => decodePronunciationAudio(bytesToBase64(audio))).toThrow();
        }
    });
    it('requests phoneme-level assessment and retains real scores even when the transcript matches', async () => {
        const fetchMock = vi.fn(async () => Response.json({ RecognitionStatus: 'Success', NBest: [{ Display: 'Think.', AccuracyScore: 70, FluencyScore: 80, CompletenessScore: 100, PronScore: 77, Words: [{ Word: 'think', AccuracyScore: 70, ErrorType: 'Mispronunciation', Phonemes: [{ Phoneme: 'θ', AccuracyScore: 35 }] }] }] }));
        vi.stubGlobal('fetch',fetchMock);
        const provider = new AzurePronunciationProvider({ apiKey: 'secret', endpoint: 'https://resource.cognitiveservices.azure.com' });
        expect(await provider.assess(wav(),'Think.')).toEqual(assessment);
        const [url,request] = fetchMock.mock.calls[0] as unknown as [string,RequestInit];
        expect(url).not.toContain('secret');
        const headers = request.headers as Record<string,string>;
        expect(JSON.parse(atob(headers['Pronunciation-Assessment']))).toMatchObject({ ReferenceText: 'Think.', Granularity: 'Phoneme' });
        expect(headers['Ocp-Apim-Subscription-Key']).toBe('secret');
    });
    it('requires auth, reports unconfigured assessment honestly and applies quota before the provider', async () => {
        const provider = { name: 'azure', model: 'test', assess: vi.fn(async () => assessment) };
        const t = makeTestApp({ providers: { pronunciation: provider } });
        const json = { audio: bytesToBase64(wav()), mimeType: 'audio/wav', referenceText: 'Think.' };
        expect((await t.request('/api/pronunciation/assess',{ method: 'POST',json })).status).toBe(401);
        expect((await makeTestApp().request('/api/pronunciation/assess',{ method: 'POST',token: 'token-a',json })).status).toBe(503);
        const response = await t.request('/api/pronunciation/assess',{ method: 'POST',token: 'token-a',json });
        expect(await response.json()).toEqual(assessment); expect(t.db.usage[0].kind).toBe('stt'); expect(provider.assess).toHaveBeenCalledTimes(1);
    });
});
