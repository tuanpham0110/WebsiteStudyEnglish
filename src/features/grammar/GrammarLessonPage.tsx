import { useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Lightbulb, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { SpeakButton } from '@/components/common/SpeakButton';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useLearnerContext } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { ExerciseRunner } from '@/features/lessons/ExerciseRunner';
import { saveLessonResults } from '@/features/lessons/LessonList';
import { useLesson, type GrammarContent } from '@/features/lessons/api';

export default function GrammarLessonPage() {
  const { lessonId } = useParams();
  const { user } = useAuth();
  const learner = useLearnerContext();
  const qc = useQueryClient();
  const query = useLesson<GrammarContent>(lessonId);
  const [lang, setLang] = useState<'vi' | 'en'>(learner.explanationLanguage);
  useStudyTimer('grammar', { refId: lessonId });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return <EmptyState title="Không tìm thấy bài học" action={<ButtonLink to="/app/grammar">Về danh sách</ButtonLink>} />;
  const { lesson, exercises } = query.data;
  const c = lesson.content;

  return (
    <div className="space-y-6">
      <ButtonLink to="/app/grammar" variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Ngữ pháp
      </ButtonLink>
      <div>
        <Badge tone="primary">{lesson.level}</Badge>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lesson.title_vi}</h1>
        <p className="text-muted">{lesson.title}</p>
      </div>

      <Card>
        <CardHeader
          title="Giải thích"
          action={
            <Tabs
              label="Ngôn ngữ giải thích"
              value={lang}
              onChange={setLang}
              items={[
                { value: 'vi', label: 'Tiếng Việt' },
                { value: 'en', label: 'English' },
              ]}
            />
          }
        />
        <CardBody className="space-y-5">
          <p className="leading-relaxed whitespace-pre-line text-fg-2">{lang === 'vi' ? c.explanationVi : c.explanationEn}</p>
          <div>
            <p className="mb-2 text-sm font-semibold">Cấu trúc</p>
            <ul className="flex flex-wrap gap-2">
              {c.structure.map((s) => (
                <li key={s} className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-sm">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Ví dụ đúng và sai</p>
            <ul className="space-y-2">
              {c.examples.map((ex) => (
                <li key={ex.en} className={ex.correct ? 'rounded-lg bg-success-soft p-3' : 'rounded-lg bg-danger-soft p-3'}>
                  <p className="flex items-start gap-2 text-sm">
                    {ex.correct ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Đúng" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Sai" />
                    )}
                    <span className={ex.correct ? 'font-medium' : 'line-through decoration-danger/60'}>{ex.en}</span>
                    {ex.correct && <SpeakButton text={ex.en} />}
                  </p>
                  {ex.vi && <p className="mt-1 pl-6 text-sm text-fg-2">{ex.vi}</p>}
                  {ex.fix && (
                    <p className="mt-1 pl-6 text-sm">
                      → <span className="font-medium text-success">{ex.fix}</span>
                      {ex.note && <span className="text-fg-2"> — {ex.note}</span>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {c.tips.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-border p-3 text-sm text-fg-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div>{c.tips.join(' ')}</div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Bài tập" description="Kết quả được lưu vào tiến độ của bạn." />
        <CardBody>
          <ExerciseRunner
            exercises={exercises}
            explanationLanguage={lang}
            onComplete={async (results) => {
              if (!user) return;
              try {
                const score = await saveLessonResults(user.id, 'grammar', lesson.id, results);
                toast.success(`Đã lưu kết quả: ${score}%`);
                void qc.invalidateQueries({ queryKey: ['completed-lessons'] });
                void qc.invalidateQueries({ queryKey: ['dashboard'] });
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
