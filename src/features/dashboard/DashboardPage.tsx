import { Link } from 'react-router';
import { ArrowRight, BookA, CalendarCheck2, Clock, Flame, MessageSquareText, Mic, Target, Trophy } from 'lucide-react';
import { ACTIVITY_LABEL, type Activity } from '@shared/constants';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, Progress, Skeleton } from '@/components/ui/feedback';
import { StatCard } from '@/components/common/StatCard';
import { BarChartPanel } from '@/components/common/BarChartCard';
import { useLearnerContext, usePreferences, useProfile } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { formatDay, formatDuration, formatRelative, percent } from '@/lib/format';
import { suggestNext } from '@/lib/recommendations';
import { useActivePlan, useDashboardStats } from './useDashboard';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function DashboardPage() {
  const profile = useProfile();
  const prefs = usePreferences();
  const learner = useLearnerContext();
  const stats = useDashboardStats();
  const plan = useActivePlan();
  const s = stats.data;

  const goalSeconds = learner.dailyMinutes * 60;
  const todayPct = s ? percent(Math.min(s.today_seconds, goalSeconds), goalSeconds) : 0;
  const suggestions = s ? suggestNext(s, { dailyMinutes: learner.dailyMinutes, focusSkills: prefs.data?.focus_skills ?? [] }) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${profile.data?.display_name ?? 'bạn'}!`}
        description={`Trình độ hiện tại: ${learner.level}. Mục tiêu: ${learner.dailyMinutes} phút mỗi ngày.`}
        actions={
          <>
            <ButtonLink to="/app/chat" variant="outline">
              <MessageSquareText className="h-4 w-4" aria-hidden /> AI Chat
            </ButtonLink>
            <ButtonLink to="/app/speaking">
              <Mic className="h-4 w-4" aria-hidden /> Luyện nói
            </ButtonLink>
          </>
        }
      />

      {stats.isError ? (
        <Card>
          <ErrorState message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} />
        </Card>
      ) : (
        <>
          {/* Today */}
          <Card>
            <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary-soft p-3 text-primary">
                  <Target className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <p className="text-sm text-muted">Mục tiêu hôm nay</p>
                  {!s ? (
                    <Skeleton className="mt-1 h-6 w-32" />
                  ) : (
                    <p className="text-lg font-semibold">
                      {formatDuration(s!.today_seconds)} / {learner.dailyMinutes} phút
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <Progress value={todayPct} label="Tiến độ mục tiêu hôm nay" />
                <p className="mt-1.5 text-xs text-muted">{todayPct >= 100 ? 'Tuyệt vời! Bạn đã hoàn thành mục tiêu hôm nay.' : `${todayPct}% hoàn thành`}</p>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Chuỗi ngày học" icon={<Flame className="h-4 w-4" />} loading={!s} value={`${s?.streak_days ?? 0} ngày`} />
            <StatCard
              label="Tổng thời gian học"
              icon={<Clock className="h-4 w-4" />}
              loading={!s}
              value={formatDuration(s?.total_seconds ?? 0)}
              hint={s ? `7 ngày qua: ${formatDuration(s.week_seconds)}` : undefined}
            />
            <StatCard
              label="Từ vựng đang học"
              icon={<BookA className="h-4 w-4" />}
              loading={!s}
              value={s?.words_total ?? 0}
              hint={s ? `${s.words_mastered} đã thuộc · ${s.words_due} đến hạn ôn` : undefined}
            />
            <StatCard
              label="Bài tập đúng"
              icon={<Trophy className="h-4 w-4" />}
              loading={!s}
              value={s && s.exercises_total > 0 ? `${percent(s.exercises_correct, s.exercises_total)}%` : '—'}
              hint={s ? `${s.exercises_correct}/${s.exercises_total} câu · ${s.speaking_sessions} phiên luyện nói` : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Thời gian học 14 ngày qua" description="Phút học mỗi ngày, tính từ hoạt động thực tế." />
              <CardBody>
                {!s ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <BarChartPanel
                    ariaLabel="Số phút học mỗi ngày trong 14 ngày qua"
                    unit="phút"
                    data={s!.daily.map((d) => ({ label: formatDay(d.day).split(',')[0], tooltip: formatDay(d.day), value: Math.round(d.seconds / 60) }))}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Gợi ý tiếp theo" description="Dựa trên quy tắc từ dữ liệu học của bạn." />
              <CardBody className="space-y-2">
                {!s ? (
                  <>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </>
                ) : suggestions.length === 0 ? (
                  <p className="text-sm text-muted">Bạn đang làm rất tốt! Hãy tiếp tục kế hoạch hằng ngày.</p>
                ) : (
                  suggestions.map((sg) => (
                    <Link key={sg.title} to={sg.to} className="group flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:bg-surface-2">
                      <div>
                        <p className="text-sm font-medium">{sg.title}</p>
                        <p className="text-xs text-muted">{sg.description}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-primary" aria-hidden />
                    </Link>
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Kế hoạch hằng ngày"
                icon={<CalendarCheck2 className="h-5 w-5" />}
                description={plan.data?.title}
                action={
                  <Link to="/onboarding" className="text-sm text-primary hover:underline">
                    Tạo lại
                  </Link>
                }
              />
              <CardBody>
                {plan.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : !plan.data ? (
                  <EmptyState title="Chưa có kế hoạch" description="Hoàn thành thiết lập để nhận kế hoạch học." action={<ButtonLink to="/onboarding">Thiết lập</ButtonLink>} />
                ) : (
                  <ul className="space-y-2">
                    {plan.data.items.map((item) => {
                      const done = (s?.by_activity[item.skill] ?? 0) > 0 && s?.recent.some((r) => r.activity === item.skill && Date.now() - Date.parse(r.occurred_at) < 86_400_000);
                      return (
                        <li key={item.title}>
                          <Link to={item.to} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-surface-2">
                            <span className="text-sm font-medium">{item.title}</span>
                            <span className="tabular shrink-0 text-xs text-muted">{done ? '✓ đã học hôm nay' : `${item.minutes} phút`}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Hoạt động gần đây" action={<Link to="/app/progress" className="text-sm text-primary hover:underline">Xem tất cả</Link>} />
              <CardBody>
                {!s ? (
                  <Skeleton className="h-32 w-full" />
                ) : s!.recent.length === 0 ? (
                  <EmptyState title="Chưa có hoạt động" description="Bắt đầu một bài học, lịch sử sẽ xuất hiện ở đây." />
                ) : (
                  <ul className="divide-y divide-border">
                    {s!.recent.slice(0, 6).map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>
                          <span className="font-medium">{ACTIVITY_LABEL[r.activity as Activity] ?? r.activity}</span>
                          <span className="text-muted">
                            {r.completed ? ' · hoàn thành' : ''}
                            {r.score !== null ? ` · ${Math.round(Number(r.score))}%` : ''}
                            {r.duration_seconds > 0 ? ` · ${formatDuration(r.duration_seconds)}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">{formatRelative(r.occurred_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
