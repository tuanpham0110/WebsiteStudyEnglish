// Spaced repetition (SM-2 style). Ratings: 0 again · 1 hard · 2 good · 3 easy.

export type SrsState = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
};

export type SrsRating = 0 | 1 | 2 | 3;

export type SrsResult = SrsState & {
  due_at: string;
  last_reviewed_at: string;
  status: 'learning' | 'review' | 'mastered';
};

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const MASTERED_DAYS = 21;
const DAY = 86_400_000;

const clampEase = (e: number) => Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, e)) * 100) / 100;

export function schedule(state: SrsState, rating: SrsRating, now = new Date()): SrsResult {
  let { ease_factor: ease, interval_days: interval, repetitions, lapses } = state;
  let dueMs: number;

  if (rating === 0) {
    repetitions = 0;
    lapses += 1;
    interval = 0;
    ease = clampEase(ease - 0.2);
    dueMs = now.getTime() + 10 * 60_000; // see it again in 10 minutes
  } else {
    if (rating === 1) {
      interval = Math.max(1, Math.round(Math.max(interval, 1) * 1.2));
      ease = clampEase(ease - 0.15);
    } else if (rating === 2) {
      interval = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.round(interval * ease);
    } else {
      interval = repetitions === 0 ? 3 : Math.round(Math.max(interval, 1) * ease * 1.3);
      ease = clampEase(ease + 0.15);
    }
    interval = Math.min(3650, Math.max(1, interval));
    repetitions += 1;
    dueMs = now.getTime() + interval * DAY;
  }

  return {
    ease_factor: ease,
    interval_days: interval,
    repetitions,
    lapses,
    due_at: new Date(dueMs).toISOString(),
    last_reviewed_at: now.toISOString(),
    status: interval >= MASTERED_DAYS ? 'mastered' : repetitions > 0 ? 'review' : 'learning',
  };
}

export function previewIntervals(state: SrsState): Record<SrsRating, string> {
  const label = (r: SrsRating) => {
    const res = schedule(state, r);
    if (r === 0) return '10 phút';
    return res.interval_days >= 30 ? `${Math.round(res.interval_days / 30)} tháng` : `${res.interval_days} ngày`;
  };
  return { 0: label(0), 1: label(1), 2: label(2), 3: label(3) };
}
