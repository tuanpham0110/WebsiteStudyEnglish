import { describe, expect, it } from 'vitest';
import { EnglishEvaluationService } from '../services/evaluation';
import { FakeText } from './fakes';

describe('grounded language feedback', () => {
    it('preserves a correct message even when the provider suggests a stylistic rewrite', async () => {
        const text = new FakeText();
        text.json = { hasErrors: false, original: 'invented source', corrected: 'I would like to depart.', explanation: 'More formal', example: '' };
        expect(await new EnglishEvaluationService(text).correctMessage('I wanna go.','B1','vi')).toEqual({ hasErrors: false, original: 'I wanna go.', corrected: 'I wanna go.', explanation: '', example: '' });
    });
    it('rejects fabricated source edits and revised fragments missing from the corrected essay', async () => {
        const text = new FakeText();
        const service = new EnglishEvaluationService(text);
        const feedback = { correctedText: 'I went to work yesterday.', overallFeedback: 'Good.', coherence: { rating: 4, comment: 'Clear.' }, changes: [{ original: 'I goes', revised: 'I went', type: 'grammar', reason: 'Past.' }], vocabularySuggestions: [], strengths: [] };
        text.json = feedback;
        await expect(service.evaluateWriting({ text: 'I go to work yesterday.', type: 'paragraph', level: 'B1', language: 'vi' })).rejects.toMatchObject({ kind: 'invalid_output' });
        feedback.changes[0].original = 'I go'; feedback.changes[0].revised = 'I have gone';
        await expect(service.evaluateWriting({ text: 'I go to work yesterday.', type: 'paragraph', level: 'B1', language: 'vi' })).rejects.toMatchObject({ kind: 'invalid_output' });
        feedback.changes[0].revised = 'I went';
        await expect(service.evaluateWriting({ text: 'I go to work yesterday.', type: 'paragraph', level: 'B1', language: 'vi' })).resolves.toMatchObject({ correctedText: feedback.correctedText });
    });
});
