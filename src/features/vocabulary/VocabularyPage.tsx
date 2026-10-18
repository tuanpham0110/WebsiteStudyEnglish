import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BookmarkCheck, BookmarkPlus, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LEVELS } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Card, PageHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/form';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { SpeakButton } from '@/components/common/SpeakButton';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useLearnerContext } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { TOPIC_LABEL, useCatalog, useTrackedWords, useVocabMutations, type TrackedWord, type VocabWord } from './api';
import { ReviewDeck } from './ReviewDeck';
import { VocabQuiz } from './VocabQuiz';
import { toWordInput, WordFormDialog } from './WordForm';

type Tab = 'browse' | 'mine' | 'review' | 'quiz';
const STATUS_LABEL = { learning: 'Đang học', review: 'Đang ôn', mastered: 'Đã thuộc' } as const;

function WordRow({ word, tracked, actions }: { word: VocabWord; tracked?: TrackedWord; actions: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-semibold">{word.word}</span>
          {word.part_of_speech && <span className="text-xs text-muted">{word.part_of_speech}</span>}
          {word.ipa && <span className="text-sm text-muted">{word.ipa}</span>}
          <SpeakButton text={word.word} />
          {word.level && <Badge>{word.level}</Badge>}
          {word.owner_id && <Badge tone="primary">Của tôi</Badge>}
          {tracked && <Badge tone={tracked.status === 'mastered' ? 'success' : 'neutral'}>{STATUS_LABEL[tracked.status]}</Badge>}
        </p>
        <p className="text-sm text-fg">{word.meaning_vi}</p>
        {word.definition_en && <p className="text-sm text-fg-2">{word.definition_en}</p>}
        {word.example_en && (
          <p className="mt-0.5 text-sm text-muted italic">
            {word.example_en}
            {word.example_vi && <span className="not-italic"> — {word.example_vi}</span>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </li>
  );
}

export default function VocabularyPage() {
  const [params, setParams] = useSearchParams();
  const tab = (['browse', 'mine', 'review', 'quiz'].includes(params.get('tab') ?? '') ? params.get('tab') : 'browse') as Tab;
  const learner = useLearnerContext();
  const [level, setLevel] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [search, setSearch] = useState('');
  const [mineFilter, setMineFilter] = useState<'all' | 'favorite' | 'learning' | 'mastered' | 'personal'>('all');
  const [editing, setEditing] = useState<Partial<VocabWord> | null>(null);
  const [deleting, setDeleting] = useState<VocabWord | null>(null);
  useStudyTimer('vocabulary');

  const catalog = useCatalog({ level: level || undefined, topic: topic || undefined, search });
  const levelCatalog = useCatalog({ level: learner.level });
  const tracked = useTrackedWords();
  const m = useVocabMutations();
  const trackedMap = useMemo(() => new Map((tracked.data ?? []).map((t) => [t.vocabulary_id, t])), [tracked.data]);
  const dueCount = (tracked.data ?? []).filter((t) => Date.parse(t.due_at) <= Date.now() && t.status !== 'mastered').length;

  const setTab = (t: Tab) => setParams(t === 'browse' ? {} : { tab: t }, { replace: true });
  const notify = (p: Promise<unknown>, ok: string) => p.then(() => toast.success(ok)).catch((e) => toast.error(errorMessage(e)));

  const mine = (tracked.data ?? []).filter((t) =>
    mineFilter === 'all'
      ? true
      : mineFilter === 'favorite'
        ? t.is_favorite
        : mineFilter === 'personal'
          ? t.vocabulary.owner_id !== null
          : mineFilter === 'mastered'
            ? t.status === 'mastered'
            : t.status !== 'mastered',
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Từ vựng"
        description="Học từ theo trình độ và chủ đề, lưu vào sổ từ và ôn tập đúng lúc bằng spaced repetition."
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" aria-hidden /> Thêm từ
          </Button>
        }
      />
      <Tabs
        label="Chức năng từ vựng"
        value={tab}
        onChange={setTab}
        className="w-fit max-w-full"
        items={[
          { value: 'browse', label: 'Khám phá' },
          { value: 'mine', label: 'Sổ từ', badge: tracked.data ? <Badge>{tracked.data.length}</Badge> : undefined },
          { value: 'review', label: 'Ôn tập', badge: dueCount > 0 ? <Badge tone="warning">{dueCount}</Badge> : undefined },
          { value: 'quiz', label: 'Quiz' },
        ]}
      />

      {tab === 'browse' && (
        <Card>
          <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <label htmlFor="v-search" className="sr-only">
                Tìm từ
              </label>
              <Input id="v-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm từ tiếng Anh…" className="pl-9" />
            </div>
            <Select aria-label="Trình độ" value={level} onChange={(e) => setLevel(e.target.value)} className="sm:w-36">
              <option value="">Mọi trình độ</option>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
            <Select aria-label="Chủ đề" value={topic} onChange={(e) => setTopic(e.target.value)} className="sm:w-48">
              <option value="">Mọi chủ đề</option>
              {Object.entries(TOPIC_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          {catalog.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : catalog.isError ? (
            <ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} />
          ) : catalog.data?.length === 0 ? (
            <EmptyState title="Không tìm thấy từ nào" description="Thử bỏ bớt bộ lọc, hoặc tự thêm từ của bạn." />
          ) : (
            <ul className="divide-y divide-border">
              {catalog.data!.map((w) => {
                const t = trackedMap.get(w.id);
                return (
                  <WordRow
                    key={w.id}
                    word={w}
                    tracked={t}
                    actions={
                      t ? (
                        <Button variant="ghost" size="sm" onClick={() => void notify(m.untrack.mutateAsync(w.id), 'Đã bỏ khỏi sổ từ.')}>
                          <BookmarkCheck className="h-4 w-4 text-success" aria-hidden /> Đã lưu
                        </Button>
                      ) : (
                        <Button variant="soft" size="sm" onClick={() => void notify(m.track.mutateAsync(w.id), `Đã thêm “${w.word}”.`)}>
                          <BookmarkPlus className="h-4 w-4" aria-hidden /> Học từ này
                        </Button>
                      )
                    }
                  />
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'mine' && (
        <Card>
          <div className="border-b border-border p-4">
            <Tabs
              label="Lọc sổ từ"
              value={mineFilter}
              onChange={setMineFilter}
              items={[
                { value: 'all', label: 'Tất cả' },
                { value: 'favorite', label: 'Yêu thích' },
                { value: 'learning', label: 'Đang học' },
                { value: 'mastered', label: 'Đã thuộc' },
                { value: 'personal', label: 'Từ tôi thêm' },
              ]}
            />
          </div>
          {tracked.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : tracked.isError ? (
            <ErrorState message={errorMessage(tracked.error)} onRetry={() => void tracked.refetch()} />
          ) : mine.length === 0 ? (
            <EmptyState title="Sổ từ trống" description="Thêm từ từ tab Khám phá, bài đọc, báo cáo luyện nói — hoặc tự thêm." action={<Button variant="outline" onClick={() => setTab('browse')}>Khám phá từ</Button>} />
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((t) => (
                <WordRow
                  key={t.vocabulary_id}
                  word={t.vocabulary}
                  tracked={t}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                        aria-pressed={t.is_favorite}
                        onClick={() => void m.toggleFavorite.mutateAsync({ vocabularyId: t.vocabulary_id, value: !t.is_favorite }).catch((e) => toast.error(errorMessage(e)))}
                      >
                        <Star className={cn('h-4 w-4', t.is_favorite && 'fill-warning text-warning')} />
                      </Button>
                      {t.vocabulary.owner_id ? (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label="Sửa" onClick={() => setEditing(t.vocabulary)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Xóa từ" onClick={() => setDeleting(t.vocabulary)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="icon-sm" aria-label="Bỏ khỏi sổ từ" onClick={() => void notify(m.untrack.mutateAsync(t.vocabulary_id), 'Đã bỏ khỏi sổ từ.')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'review' && (
        <Card className="p-5">
          {tracked.isLoading ? <Skeleton className="h-64 w-full" /> : <ReviewDeck words={tracked.data ?? []} />}
        </Card>
      )}

      {tab === 'quiz' && (
        <Card className="p-5">
          {tracked.isLoading || levelCatalog.isLoading ? <Skeleton className="h-64 w-full" /> : <VocabQuiz tracked={tracked.data ?? []} catalog={levelCatalog.data ?? []} />}
          {(tracked.data?.length ?? 0) < 4 && <p className="mt-4 text-center text-xs text-muted">Quiz đang dùng từ ở trình độ {learner.level} vì sổ từ của bạn còn ít hơn 4 từ.</p>}
        </Card>
      )}

      <WordFormDialog
        open={editing !== null}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        saving={m.createWord.isPending || m.updateWord.isPending}
        onSubmit={async (values) => {
          try {
            if (editing?.id) {
              await m.updateWord.mutateAsync({ id: editing.id, ...toWordInput(values) });
              toast.success('Đã cập nhật từ.');
            } else {
              await m.createWord.mutateAsync(toWordInput(values));
              toast.success(`Đã thêm “${values.word}” vào sổ từ.`);
            }
            setEditing(null);
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Xóa từ này?"
        description={`“${deleting?.word}” và lịch sử ôn tập của nó sẽ bị xóa.`}
        confirmLabel="Xóa"
        danger
        loading={m.deleteWord.isPending}
        onConfirm={() => {
          if (!deleting) return;
          void notify(m.deleteWord.mutateAsync(deleting.id), 'Đã xóa từ.').then(() => setDeleting(null));
        }}
      />
    </div>
  );
}
