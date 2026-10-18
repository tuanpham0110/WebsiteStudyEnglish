import { useQuery } from '@tanstack/react-query';
import type { Level } from '@shared/constants';
import type { ExerciseRow } from '@/lib/answers';
import { db, unwrap } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type LessonKind = 'grammar' | 'reading' | 'listening' | 'pronunciation';

export type LessonRow<C = Record<string, unknown>> = {
  id: string;
  kind: LessonKind;
  level: Level;
  topic: string;
  title: string;
  title_vi: string | null;
  summary: string | null;
  content: C;
  sort_order: number;
};

export type GrammarContent = {
  explanationVi: string;
  explanationEn: string;
  structure: string[];
  examples: { en: string; vi?: string; correct: boolean; fix?: string; note?: string }[];
  tips: string[];
};
export type ReadingContent = { passage: string; summaryVi: string; wordCount: number };
export type ListeningContent = { script: { speaker: string; text: string }[]; summaryVi: string; dictation: string[] };
export type PronunciationContent = { tipsVi: string; sentences: { text: string }[] };

const LESSON_COLUMNS = 'id, kind, level, topic, title, title_vi, summary, content, sort_order';

export function useLessons<C>(kind: LessonKind) {
  return useQuery({
    queryKey: ['lessons', kind],
    staleTime: 10 * 60_000,
    queryFn: async () =>
      unwrap(await db().from('lessons').select(LESSON_COLUMNS).eq('kind', kind).order('level').order('sort_order')) as LessonRow<C>[],
  });
}

export function useLesson<C>(id: string | undefined) {
  return useQuery({
    queryKey: ['lesson', id],
    enabled: Boolean(id),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const lesson = unwrap(await db().from('lessons').select(LESSON_COLUMNS).eq('id', id!).maybeSingle()) as LessonRow<C> | null;
      const exercises = unwrap(
        await db()
          .from('exercises')
          .select('id, lesson_id, type, level, prompt, data, answer, explanation_vi, explanation_en, sort_order')
          .eq('lesson_id', id!)
          .order('sort_order'),
      ) as ExerciseRow[];
      return lesson ? { lesson, exercises } : null;
    },
  });
}

/** Map of lesson id → best score (or null) for lessons the user completed. */
export function useCompletedLessons(activity: LessonKind) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['completed-lessons', user?.id, activity],
    enabled: Boolean(user),
    queryFn: async () => {
      const rows = unwrap(
        await db().from('learning_progress').select('ref_id, score').eq('activity', activity).eq('completed', true).not('ref_id', 'is', null).limit(1000),
      ) as { ref_id: string; score: number | null }[];
      const map = new Map<string, number | null>();
      for (const r of rows ?? []) {
        const prev = map.get(r.ref_id);
        const score = r.score === null ? null : Number(r.score);
        map.set(r.ref_id, prev === undefined || prev === null ? score : Math.max(prev, score ?? 0));
      }
      return map;
    },
  });
}
