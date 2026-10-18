import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Level } from '@shared/constants';
import { db, unwrap } from '@/lib/supabase';
import { schedule, type SrsRating } from '@/lib/srs';
import { useAuth } from '@/providers/AuthProvider';

export type VocabWord = {
  id: string;
  owner_id: string | null;
  word: string;
  part_of_speech: string | null;
  ipa: string | null;
  meaning_vi: string;
  definition_en: string | null;
  example_en: string | null;
  example_vi: string | null;
  level: Level | null;
  topic: string | null;
};

export type TrackedWord = {
  vocabulary_id: string;
  status: 'learning' | 'review' | 'mastered';
  is_favorite: boolean;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: string;
  last_reviewed_at: string | null;
  created_at: string;
  vocabulary: VocabWord;
};

const VOCAB_COLUMNS = 'id, owner_id, word, part_of_speech, ipa, meaning_vi, definition_en, example_en, example_vi, level, topic';
const TRACKED_COLUMNS = `vocabulary_id, status, is_favorite, ease_factor, interval_days, repetitions, lapses, due_at, last_reviewed_at, created_at, vocabulary(${VOCAB_COLUMNS})`;

export const TOPIC_LABEL: Record<string, string> = {
  daily_life: 'Đời sống',
  food: 'Ẩm thực',
  travel: 'Du lịch',
  work: 'Công việc',
  technology: 'Công nghệ',
  education: 'Học tập',
  health: 'Sức khỏe',
  environment: 'Môi trường',
  emotions: 'Cảm xúc & giao tiếp',
  business: 'Kinh doanh',
  general: 'Từ thông dụng',
};

function normalizeTracked(rows: unknown[]): TrackedWord[] {
  return (rows as TrackedWord[]).map((r) => ({ ...r, ease_factor: Number(r.ease_factor) }));
}

export function useCatalog(filters: { level?: string; topic?: string; search?: string }) {
  return useQuery({
    queryKey: ['vocab-catalog', filters],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let query = db().from('vocabulary').select(VOCAB_COLUMNS).is('owner_id', null).order('level').order('word').limit(200);
      if (filters.level) query = query.eq('level', filters.level);
      if (filters.topic) query = query.eq('topic', filters.topic);
      if (filters.search?.trim()) query = query.ilike('word', `%${filters.search.trim().replace(/[%_]/g, '')}%`);
      return unwrap(await query) as VocabWord[];
    },
  });
}

export function useTrackedWords() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vocab-tracked', user?.id],
    enabled: Boolean(user),
    queryFn: async () =>
      normalizeTracked(
        unwrap(await db().from('user_vocabulary').select(TRACKED_COLUMNS).order('created_at', { ascending: false }).limit(1000)) ?? [],
      ),
  });
}

export function useVocabMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vocab-tracked'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const track = useMutation({
    mutationFn: async (vocabularyId: string) => {
      unwrap(
        await db()
          .from('user_vocabulary')
          .upsert({ user_id: user!.id, vocabulary_id: vocabularyId }, { onConflict: 'user_id,vocabulary_id', ignoreDuplicates: true }),
      );
    },
    onSuccess: invalidate,
  });

  const untrack = useMutation({
    mutationFn: async (vocabularyId: string) => {
      unwrap(await db().from('user_vocabulary').delete().eq('user_id', user!.id).eq('vocabulary_id', vocabularyId));
    },
    onSuccess: invalidate,
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ vocabularyId, value }: { vocabularyId: string; value: boolean }) => {
      unwrap(await db().from('user_vocabulary').update({ is_favorite: value }).eq('user_id', user!.id).eq('vocabulary_id', vocabularyId));
    },
    onSuccess: invalidate,
  });

  const createWord = useMutation({
    mutationFn: async (input: Omit<VocabWord, 'id' | 'owner_id'>) => {
      const row = unwrap(
        await db()
          .from('vocabulary')
          .insert({ ...input, owner_id: user!.id })
          .select('id')
          .single(),
      ) as { id: string };
      unwrap(await db().from('user_vocabulary').insert({ user_id: user!.id, vocabulary_id: row.id }));
      return row.id;
    },
    onSuccess: invalidate,
  });

  const updateWord = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<VocabWord> & { id: string }) => {
      const { owner_id: _ignored, ...rest } = patch;
      void _ignored;
      unwrap(await db().from('vocabulary').update(rest).eq('id', id).eq('owner_id', user!.id));
    },
    onSuccess: invalidate,
  });

  const deleteWord = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await db().from('vocabulary').delete().eq('id', id).eq('owner_id', user!.id));
    },
    onSuccess: invalidate,
  });

  /** Save a word found in a text: reuse the catalog entry if it exists, else create a personal word. */
  const saveFromText = useMutation({
    mutationFn: async (input: { word: string; meaningVi: string; example?: string; ipa?: string; partOfSpeech?: string; definitionEn?: string }) => {
      const word = input.word.trim().slice(0, 80);
      const existing = unwrap(
        await db().from('vocabulary').select('id').ilike('word', word.replace(/[%_]/g, '')).limit(1),
      ) as { id: string }[];
      const id =
        existing[0]?.id ??
        (
          unwrap(
            await db()
              .from('vocabulary')
              .insert({
                owner_id: user!.id,
                word,
                meaning_vi: input.meaningVi.slice(0, 300) || '—',
                example_en: input.example?.slice(0, 500) || null,
                ipa: input.ipa?.slice(0, 80) || null,
                part_of_speech: input.partOfSpeech?.slice(0, 30) || null,
                definition_en: input.definitionEn?.slice(0, 500) || null,
              })
              .select('id')
              .single(),
          ) as { id: string }
        ).id;
      unwrap(
        await db()
          .from('user_vocabulary')
          .upsert({ user_id: user!.id, vocabulary_id: id }, { onConflict: 'user_id,vocabulary_id', ignoreDuplicates: true }),
      );
      return id;
    },
    onSuccess: invalidate,
  });

  const review = useMutation({
    mutationFn: async ({ entry, rating, mode }: { entry: TrackedWord; rating: SrsRating; mode: 'flashcard' | 'quiz' }) => {
      const next = schedule(entry, rating);
      unwrap(
        await db()
          .from('user_vocabulary')
          .update({
            ease_factor: next.ease_factor,
            interval_days: next.interval_days,
            repetitions: next.repetitions,
            lapses: next.lapses,
            due_at: next.due_at,
            last_reviewed_at: next.last_reviewed_at,
            status: next.status,
          })
          .eq('user_id', user!.id)
          .eq('vocabulary_id', entry.vocabulary_id),
      );
      unwrap(
        await db()
          .from('vocabulary_reviews')
          .insert({ user_id: user!.id, vocabulary_id: entry.vocabulary_id, rating, mode, interval_days: next.interval_days }),
      );
      return next;
    },
  });

  return { track, untrack, toggleFavorite, createWord, updateWord, deleteWord, saveFromText, review, invalidate };
}
