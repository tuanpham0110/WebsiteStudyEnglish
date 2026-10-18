import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState, Progress } from '@/components/ui/feedback';
import { SpeakButton } from '@/components/common/SpeakButton';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { logAttempts, logProgress } from '@/lib/progress';
import { useAuth } from '@/providers/AuthProvider';
import { useVocabMutations, type TrackedWord, type VocabWord } from './api';

type Question = { word: VocabWord; tracked?: TrackedWord; options: string[]; answer: number };

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuiz(pool: VocabWord[], tracked: TrackedWord[], size = 10): Question[] {
  const unique = [...new Map(pool.map((w) => [w.meaning_vi, w])).values()];
  if (unique.length < 4) return [];
  return shuffle(unique)
    .slice(0, size)
    .map((word) => {
      const distractors = shuffle(unique.filter((w) => w.id !== word.id)).slice(0, 3).map((w) => w.meaning_vi);
      const options = shuffle([word.meaning_vi, ...distractors]);
      return { word, tracked: tracked.find((t) => t.vocabulary_id === word.id), options, answer: options.indexOf(word.meaning_vi) };
    });
}

export function VocabQuiz({ tracked, catalog }: { tracked: TrackedWord[]; catalog: VocabWord[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { review } = useVocabMutations();
  const [seed, setSeed] = useState(0);
  const questions = useMemo(() => {
    const pool = tracked.length >= 4 ? tracked.map((t) => t.vocabulary) : catalog;
    return buildQuiz(pool, tracked);
    // Rebuild only when a new quiz is requested (seed) or the word pool size changes,
    // not on every refetch triggered by answering.
  }, [seed, tracked.length, catalog.length]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  if (questions.length === 0) return <EmptyState title="Chưa đủ từ để làm quiz" description="Cần ít nhất 4 từ có nghĩa khác nhau." />;

  if (index >= questions.length) {
    return (
      <div className="text-center">
        <p className="text-4xl font-semibold">
          {score}/{questions.length}
        </p>
        <p className="mt-1 text-sm text-muted">câu đúng</p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => {
            setSeed((s) => s + 1);
            setIndex(0);
            setScore(0);
            setPicked(null);
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Làm quiz mới
        </Button>
      </div>
    );
  }

  const q = questions[index];
  const choose = async (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === q.answer;
    if (correct) setScore((s) => s + 1);
    if (!user) return;
    try {
      await logAttempts(user.id, [{ exercise_id: null, lesson_id: null, skill: 'vocabulary', answer: { word: q.word.word, choice: q.options[i] }, is_correct: correct }]);
      if (q.tracked) await review.mutateAsync({ entry: q.tracked, rating: correct ? 2 : 0, mode: 'quiz' });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const next = async () => {
    setPicked(null);
    if (index + 1 >= questions.length && user) {
      await logProgress(user.id, { activity: 'vocabulary', ref_id: 'quiz', items_count: questions.length, completed: true, score: Math.round((score / questions.length) * 100) }).catch(() => {});
      void qc.invalidateQueries({ queryKey: ['vocab-tracked'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
    setIndex(index + 1);
  };

  return (
    <div className="mx-auto max-w-xl">
      <Progress value={index} max={questions.length} label="Tiến độ quiz" className="mb-5" />
      <p className="text-sm text-muted">Chọn nghĩa đúng của từ:</p>
      <p className="mt-1 flex items-center gap-1 text-3xl font-semibold">
        {q.word.word} <SpeakButton text={q.word.word} />
      </p>
      {q.word.ipa && <p className="text-muted">{q.word.ipa}</p>}
      <div className="mt-5 grid gap-2">
        {q.options.map((o, i) => (
          <button
            key={o}
            type="button"
            onClick={() => void choose(i)}
            disabled={picked !== null}
            className={cn(
              'flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors',
              picked === null ? 'border-border-strong hover:bg-surface-2' : i === q.answer ? 'border-success bg-success-soft' : i === picked ? 'border-danger bg-danger-soft' : 'border-border opacity-60',
            )}
          >
            {o}
            {picked !== null && i === q.answer && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Đáp án đúng" />}
            {picked === i && i !== q.answer && <XCircle className="h-4 w-4 text-danger" aria-label="Sai" />}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted italic">{q.word.example_en}</p>
          <Button onClick={() => void next()}>{index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp'}</Button>
        </div>
      )}
    </div>
  );
}
