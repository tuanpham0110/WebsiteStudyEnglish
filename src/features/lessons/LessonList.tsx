import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { LEVELS, type Level } from '@shared/constants';
import { Card, PageHeader } from '@/components/ui/card';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { useLearnerContext } from '@/hooks/useUserData';
import type { ExerciseResult } from './ExerciseRunner';
import { useCompletedLessons, useLessons, type LessonKind } from './api';
import { logAttempts, logProgress } from '@/lib/progress';

export function LessonList({ kind, title, description, basePath }: { kind: LessonKind; title: string; description: string; basePath: string }) {
  const lessons = useLessons(kind);
  const completed = useCompletedLessons(kind);
  const learner = useLearnerContext();
  const [level, setLevel] = useState<'all' | Level>('all');
  const visible = useMemo(() => (lessons.data ?? []).filter((l) => level === 'all' || l.level === level), [lessons.data, level]);
  const levelsPresent = LEVELS.filter((l) => lessons.data?.some((x) => x.level === l));

  return (
    <div>
      <PageHeader title={title} description={description} />
      <Tabs
        label="Lọc theo trình độ"
        value={level}
        onChange={setLevel}
        className="mb-5 w-fit max-w-full"
        items={[{ value: 'all' as const, label: 'Tất cả' }, ...levelsPresent.map((l) => ({ value: l, label: l + (l === learner.level ? ' · bạn' : '') }))]}
      />
      {lessons.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : lessons.isError ? (
        <Card>
          <ErrorState message={errorMessage(lessons.error)} onRetry={() => void lessons.refetch()} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có bài học" description="Dữ liệu bài học (seed) chưa được nạp vào cơ sở dữ liệu." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((lesson) => {
            const done = completed.data?.has(lesson.id);
            const best = completed.data?.get(lesson.id);
            return (
              <Link key={lesson.id} to={`${basePath}/${lesson.id}`} className="group">
                <Card className="flex h-full items-center gap-4 p-4 transition-colors group-hover:border-primary">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge tone="primary">{lesson.level}</Badge>
                      {done && (
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3" aria-hidden /> Đã học{best !== null && best !== undefined ? ` · ${Math.round(best)}%` : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="font-semibold">{lesson.title_vi ?? lesson.title}</p>
                    <p className="text-sm text-muted">{lesson.title_vi ? lesson.title : null}</p>
                    {lesson.summary && <p className="mt-1 line-clamp-2 text-sm text-fg-2">{lesson.summary}</p>}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted group-hover:text-primary" aria-hidden />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Persist exercise attempts and mark the lesson completed with its score. */
export async function saveLessonResults(userId: string, kind: 'grammar' | 'reading' | 'listening', lessonId: string, results: ExerciseResult[]) {
  if (results.length === 0) return 0;
  const score = Math.round((results.filter((r) => r.correct).length / results.length) * 100);
  await logAttempts(
    userId,
    results.map((r) => ({
      exercise_id: r.exercise.id,
      lesson_id: lessonId,
      skill: kind,
      answer: r.response,
      is_correct: r.correct,
    })),
  );
  await logProgress(userId, { activity: kind, ref_id: lessonId, completed: true, score, items_count: results.length });
  return score;
}
