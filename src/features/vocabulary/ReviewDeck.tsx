import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PartyPopper, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, Progress } from '@/components/ui/feedback';
import { SpeakButton } from '@/components/common/SpeakButton';
import { errorMessage } from '@/lib/api';
import { logProgress } from '@/lib/progress';
import { previewIntervals, type SrsRating } from '@/lib/srs';
import { useAuth } from '@/providers/AuthProvider';
import { useVocabMutations, type TrackedWord } from './api';

const RATINGS: { value: SrsRating; label: string; className: string }[] = [
  { value: 0, label: 'Quên', className: 'border-danger/40 text-danger hover:bg-danger-soft' },
  { value: 1, label: 'Khó', className: 'border-warning/40 text-warning hover:bg-warning-soft' },
  { value: 2, label: 'Nhớ', className: 'border-primary/40 text-primary hover:bg-primary-soft' },
  { value: 3, label: 'Dễ', className: 'border-success/40 text-success hover:bg-success-soft' },
];

export function ReviewDeck({ words }: { words: TrackedWord[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { review } = useVocabMutations();
  const due = useMemo(() => words.filter((w) => Date.parse(w.due_at) <= Date.now() && w.status !== 'mastered').slice(0, 30), [words]);
  const [queue] = useState(due);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={<PartyPopper className="h-6 w-6" />}
        title="Không có từ nào đến hạn ôn"
        description={words.length === 0 ? 'Hãy thêm từ vào sổ từ ở tab Khám phá.' : 'Bạn đã ôn hết. Quay lại sau để ôn tiếp nhé!'}
      />
    );
  }

  if (index >= queue.length) {
    return <EmptyState icon={<PartyPopper className="h-6 w-6" />} title={`Đã ôn ${reviewed} từ`} description="Lịch ôn tiếp theo đã được cập nhật theo câu trả lời của bạn." />;
  }

  const card = queue[index];
  const preview = previewIntervals(card);
  const rate = async (rating: SrsRating) => {
    try {
      await review.mutateAsync({ entry: card, rating, mode: 'flashcard' });
      const count = reviewed + 1;
      setReviewed(count);
      setFlipped(false);
      setIndex(index + 1);
      if (index + 1 >= queue.length && user) {
        await logProgress(user.id, { activity: 'vocabulary', ref_id: 'review', items_count: count, completed: true });
        void qc.invalidateQueries({ queryKey: ['vocab-tracked'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const v = card.vocabulary;
  return (
    <div className="mx-auto max-w-xl">
      <Progress value={index} max={queue.length} label="Tiến độ ôn tập" className="mb-4" />
      <Card className="min-h-64">
        <CardBody className="flex min-h-64 flex-col items-center justify-center text-center">
          <p className="text-3xl font-semibold">{v.word}</p>
          <p className="mt-1 flex items-center gap-1 text-muted">
            {v.part_of_speech} {v.ipa} <SpeakButton text={v.word} />
          </p>
          {flipped ? (
            <div className="mt-5 animate-fade-in space-y-1.5">
              <p className="text-lg font-medium text-fg">{v.meaning_vi}</p>
              {v.definition_en && <p className="text-sm text-fg-2">{v.definition_en}</p>}
              {v.example_en && (
                <p className="flex items-center justify-center gap-1 text-sm text-muted italic">
                  {v.example_en} <SpeakButton text={v.example_en} />
                </p>
              )}
            </div>
          ) : (
            <Button variant="soft" className="mt-6" onClick={() => setFlipped(true)}>
              <RotateCw className="h-4 w-4" aria-hidden /> Xem nghĩa
            </Button>
          )}
        </CardBody>
      </Card>
      {flipped && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={review.isPending}
              onClick={() => void rate(r.value)}
              className={`rounded-lg border bg-surface px-2 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${r.className}`}
            >
              {r.label}
              <span className="block text-xs font-normal opacity-80">{preview[r.value]}</span>
            </button>
          ))}
        </div>
      )}
      <p className="tabular mt-3 text-center text-xs text-muted">
        {index + 1}/{queue.length}
      </p>
    </div>
  );
}
