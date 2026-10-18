import { Fragment, useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { SpeakButton } from '@/components/common/SpeakButton';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useLearnerContext } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { ExerciseRunner } from '@/features/lessons/ExerciseRunner';
import { saveLessonResults } from '@/features/lessons/LessonList';
import { useLesson, type ReadingContent } from '@/features/lessons/api';
import { WordLookup } from './WordLookup';

function sentenceAround(paragraph: string, index: number) {
  const before = paragraph.lastIndexOf('.', index);
  const after = paragraph.indexOf('.', index);
  return paragraph.slice(before + 1, after === -1 ? undefined : after + 1).trim();
}

export default function ReadingLessonPage() {
  const { lessonId } = useParams();
  const { user } = useAuth();
  const learner = useLearnerContext();
  const qc = useQueryClient();
  const query = useLesson<ReadingContent>(lessonId);
  const [lookup, setLookup] = useState<{ word: string; context: string } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  useStudyTimer('reading', { refId: lessonId });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return <EmptyState title="Không tìm thấy bài đọc" action={<ButtonLink to="/app/reading">Về danh sách</ButtonLink>} />;
  const { lesson, exercises } = query.data;
  const paragraphs = lesson.content.passage.split(/\n\s*\n/);

  return (
    <div className="space-y-6">
      <ButtonLink to="/app/reading" variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Đọc hiểu
      </ButtonLink>
      <div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{lesson.level}</Badge>
          <Badge>{lesson.content.wordCount} từ</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="text-muted">{lesson.title_vi}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader title="Bài đọc" description="Nhấn vào một từ để tra nghĩa." action={<SpeakButton text={lesson.content.passage} label="Nghe cả bài" />} />
          <CardBody className="space-y-4 text-[17px] leading-8">
            {paragraphs.map((p, pi) => (
              <p key={pi}>
                {p.split(/(\s+)/).map((token, ti) => {
                  if (/^\s+$/.test(token) || !/[A-Za-z]/.test(token)) return <Fragment key={ti}>{token}</Fragment>;
                  const word = token.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, '');
                  const offset = p.split(/(\s+)/).slice(0, ti).join('').length;
                  return (
                    <Fragment key={ti}>
                      {token.slice(0, token.indexOf(word))}
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setLookup({ word, context: sentenceAround(p, offset) })}
                        className="rounded px-0.5 hover:bg-primary-soft focus-visible:bg-primary-soft"
                      >
                        {word}
                      </button>
                      {token.slice(token.indexOf(word) + word.length)}
                    </Fragment>
                  );
                })}
              </p>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {lookup ? (
            <WordLookup key={lookup.word} word={lookup.word} context={lookup.context} onClose={() => setLookup(null)} />
          ) : (
            <Card className="p-4 text-sm text-muted">
              <p>Chọn một từ trong bài để xem nghĩa, phát âm và lưu vào sổ từ.</p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get('word')?.toString().trim();
                  if (value) setLookup({ word: value, context: lesson.content.passage.slice(0, 600) });
                }}
              >
                <label htmlFor="lookup-word" className="sr-only">
                  Tra từ
                </label>
                <Input id="lookup-word" name="word" placeholder="Gõ từ cần tra…" className="h-9" maxLength={80} />
                <Button type="submit" size="sm" variant="outline">
                  Tra
                </Button>
              </form>
            </Card>
          )}
          <Card>
            <button type="button" className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold" onClick={() => setShowSummary((s) => !s)} aria-expanded={showSummary}>
              Tóm tắt (tiếng Việt)
              <ChevronDown className={showSummary ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} aria-hidden />
            </button>
            {showSummary && <p className="px-4 pb-4 text-sm text-fg-2">{lesson.content.summaryVi}</p>}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Câu hỏi đọc hiểu" />
        <CardBody>
          <ExerciseRunner
            exercises={exercises}
            explanationLanguage={learner.explanationLanguage}
            onComplete={async (results) => {
              if (!user) return;
              try {
                const score = await saveLessonResults(user.id, 'reading', lesson.id, results);
                toast.success(`Đã lưu kết quả: ${score}%`);
                void qc.invalidateQueries({ queryKey: ['completed-lessons'] });
              } catch (error) {
                toast.error(`Không lưu được kết quả: ${errorMessage(error)}`);
              }
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
