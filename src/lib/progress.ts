import type { Activity } from '@shared/constants';
import { env } from './env';
import { currentAccessToken, db } from './supabase';

type ProgressRow = {
  activity: Activity;
  ref_id?: string | null;
  duration_seconds?: number;
  items_count?: number;
  score?: number | null;
  completed?: boolean;
};

/** Append one activity row for the signed-in user (RLS enforces ownership). */
export async function logProgress(userId: string, row: ProgressRow) {
  const { error } = await db()
    .from('learning_progress')
    .insert({ user_id: userId, ...row, duration_seconds: Math.min(3600, Math.max(0, Math.round(row.duration_seconds ?? 0))) });
  if (error) throw new Error(error.message);
}

/** Fire-and-forget variant that survives page unload (fetch keepalive to PostgREST). */
export function logProgressOnUnload(userId: string, row: ProgressRow) {
  const token = currentAccessToken();
  if (!token || !env.supabaseUrl) return;
  try {
    void fetch(`${env.supabaseUrl}/rest/v1/learning_progress`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: env.supabaseKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ user_id: userId, ...row, duration_seconds: Math.min(3600, Math.round(row.duration_seconds ?? 0)) }),
    });
  } catch {
    /* best effort */
  }
}

export async function logAttempts(
  userId: string,
  attempts: { exercise_id: string | null; lesson_id: string | null; skill: string; answer: unknown; is_correct: boolean; score?: number | null }[],
) {
  if (attempts.length === 0) return;
  const { error } = await db()
    .from('exercise_attempts')
    .insert(attempts.map((a) => ({ user_id: userId, ...a })));
  if (error) throw new Error(error.message);
}
