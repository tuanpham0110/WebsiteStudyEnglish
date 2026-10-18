import { describe, expect, it } from 'vitest';
import { gradeExercise, isAcceptedAnswer, type ExerciseRow } from './answers';
import { diffWords } from './diff';
import { buildPlan, estimateLevel, suggestNext, type DashboardStats } from './recommendations';
import { schedule } from './srs';
import { alignWords, matchScore, normalizeWords } from './text-compare';
import { base64ToInt16, encodeWav, int16ToBase64 } from './audio/pcm';

const fresh = { ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0 };
const now = new Date('2026-10-10T00:00:00Z');

describe('spaced repetition', () => {
  it('schedules good answers 1 → 3 → ~8 days and masters after long intervals', () => {
    const r1 = schedule(fresh, 2, now);
    expect(r1).toMatchObject({ interval_days: 1, repetitions: 1, status: 'review' });
    const r2 = schedule(r1, 2, now);
    expect(r2.interval_days).toBe(3);
    const r3 = schedule(r2, 2, now);
    expect(r3.interval_days).toBe(8);
    const r4 = schedule({ ...r3, interval_days: 10 }, 2, now);
    expect(r4.interval_days).toBe(25);
    expect(r4.status).toBe('mastered');
  });

  it('resets on "again", lowers ease and brings the card back in 10 minutes', () => {
    const r = schedule({ ease_factor: 2.5, interval_days: 12, repetitions: 4, lapses: 0 }, 0, now);
    expect(r).toMatchObject({ interval_days: 0, repetitions: 0, lapses: 1, ease_factor: 2.3, status: 'learning' });
    expect(Date.parse(r.due_at) - now.getTime()).toBe(10 * 60_000);
  });

  it('keeps ease within database bounds', () => {
    let s = { ...fresh, ease_factor: 1.35 };
    for (let i = 0; i < 5; i++) s = schedule(s, 1, now);
    expect(s.ease_factor).toBeGreaterThanOrEqual(1.3);
    let e = { ...fresh, ease_factor: 2.95 };
    for (let i = 0; i < 5; i++) e = schedule(e, 3, now);
    expect(e.ease_factor).toBeLessThanOrEqual(3);
  });
});

describe('transcript comparison (not acoustic scoring)', () => {
  it('normalises case, punctuation and contractions', () => {
    expect(normalizeWords("I'm FINE, thanks!")).toEqual(['i', 'am', 'fine', 'thanks']);
  });

  it('detects missing and misrecognised words', () => {
    const a = alignWords('I think this is the third time', 'I tink this is third time');
    expect(a.filter((x) => x.kind === 'substitution')).toEqual([{ kind: 'substitution', expected: 'think', heard: 'tink' }]);
    expect(a.filter((x) => x.kind === 'missing')).toEqual([{ kind: 'missing', expected: 'the' }]);
    expect(matchScore(a)).toBe(71);
  });

  it('gives 100 for a perfect transcript and 0 for silence', () => {
    expect(matchScore(alignWords('Thank you for everything.', 'thank you for everything'))).toBe(100);
    expect(matchScore(alignWords('Thank you', ''))).toBe(0);
  });
});

describe('writing diff', () => {
  it('marks removed and added words', () => {
    const parts = diffWords('I am write a letter', 'I am writing a letter');
    expect(parts.filter((p) => p.type === 'removed').map((p) => p.text.trim())).toEqual(['write']);
    expect(parts.filter((p) => p.type === 'added').map((p) => p.text.trim())).toEqual(['writing']);
    expect(parts.map((p) => (p.type === 'removed' ? '' : p.text)).join('')).toBe('I am writing a letter');
  });
});

describe('exercise grading', () => {
  const base: Omit<ExerciseRow, 'type' | 'data' | 'answer'> = {
    id: 'x',
    lesson_id: 'l',
    level: 'A1',
    prompt: '',
    explanation_vi: null,
    explanation_en: null,
    sort_order: 0,
  };
  it('accepts answers regardless of case, curly quotes and final punctuation', () => {
    expect(isAcceptedAnswer("  Don’t work. ", ["don't work"])).toBe(true);
    expect(isAcceptedAnswer('', [''])).toBe(false);
  });
  it('grades each exercise type', () => {
    expect(gradeExercise({ ...base, type: 'multiple_choice', data: { options: ['a', 'b'] }, answer: { index: 1 } }, { index: 1 })).toBe(true);
    expect(gradeExercise({ ...base, type: 'fill_blank', data: {}, answer: { accepted: ['goes'] } }, { text: 'Goes' })).toBe(true);
    expect(
      gradeExercise({ ...base, type: 'reorder', data: { tokens: [] }, answer: { sentence: 'he never eats meat' } }, { order: ['He', 'never', 'eats', 'meat'] }),
    ).toBe(true);
    expect(gradeExercise({ ...base, type: 'error_correction', data: {}, answer: { accepted: ['I go.'] } }, { text: 'I goes' })).toBe(false);
  });
});

describe('placement & recommendation logic (rule-based)', () => {
  it('estimates the highest level reached without gaps', () => {
    const r = (level: 'A1' | 'A2' | 'B1' | 'B2', correct: boolean) => ({ level, correct });
    expect(
      estimateLevel([r('A1', true), r('A1', true), r('A2', true), r('A2', false), r('A2', true), r('B1', false), r('B1', false), r('B2', true)]).level,
    ).toBe('A2');
    expect(estimateLevel([r('A1', false), r('A1', false)]).level).toBe('A1');
  });

  it('builds a plan that fits the daily time and goals', () => {
    const plan = buildPlan({ level: 'B1', goals: ['interview'], dailyMinutes: 20, focusSkills: ['writing'] });
    expect(plan.map((p) => p.skill)).toEqual(['speaking', 'writing', 'vocabulary', 'roleplay']);
    expect(plan[0].minutes).toBe(7);
  });

  it('suggests due reviews first and speaking after a break', () => {
    const stats = {
      words_due: 4,
      words_total: 30,
      recent: [],
      skill_accuracy: { grammar: { total: 10, correct: 5 } },
      today_seconds: 0,
      by_activity: {},
      conversations: 2,
    } as unknown as DashboardStats;
    const s = suggestNext(stats, { dailyMinutes: 15, focusSkills: ['listening'] });
    expect(s[0].title).toContain('Ôn 4 từ');
    expect(s.map((x) => x.to)).toContain('/app/speaking');
    expect(s.map((x) => x.to)).toContain('/app/grammar');
  });
});

describe('PCM helpers', () => {
  it('round-trips base64 PCM and writes a valid WAV header', () => {
    const pcm = new Int16Array([0, 1, -1, 32767, -32768]);
    expect(Array.from(base64ToInt16(int16ToBase64(pcm)))).toEqual(Array.from(pcm));
    const wav = encodeWav(pcm, 16000);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(16000);
    expect(wav.length).toBe(44 + pcm.length * 2);
  });
});
