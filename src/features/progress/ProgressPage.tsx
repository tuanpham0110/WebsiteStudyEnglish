import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ACTIVITY_LABEL, SKILL_INFO, type Activity, type Skill } from '@shared/constants';
import type { SessionReport } from '@shared/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { BarChartPanel } from '@/components/common/BarChartCard';
import { SessionReportView } from '@/components/common/SessionReportView';
import { StatCard } from '@/components/common/StatCard';
import { errorMessage } from '@/lib/api';
import { formatDay, formatDuration, formatRelative, percent } from '@/lib/format';
import { db, unwrap } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useDashboardStats } from '@/features/dashboard/useDashboard';

const PAGE = 30;

type SessionRow = {
  id: string;
  transport: 'realtime' | 'fallback';
  status: string;
  level: string;
  topic: string | null;
  scenario_id: string | null;
  duration_seconds: number | null;
  started_at: string;
  report: SessionReport | null;
};

function MeterList({ rows, unit }: { rows: { label: string; value: number; display: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted">Chưa có dữ liệu trong 30 ngày qua.</p>;
  return (
    <ul className="space-y-3" aria-label={unit}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{r.label}</span>
            <span className="tabular text-muted">{r.display}</span>
          </div>
          <div className="h-2 rounded-full bg-primary-soft">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--chart-1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ProgressPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const stats = useDashboardStats();
  const [reportOf, setReportOf] = useState<SessionRow | null>(null);
  const [deleting, setDeleting] = useState<SessionRow | null>(null);

  const history = useInfiniteQuery({
    queryKey: ['progress-history', user?.id],
    enabled: Boolean(user),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await db()
          .from('learning_progress')
          .select('id, activity, ref_id, duration_seconds, items_count, score, completed, occurred_at')
          .order('occurred_at', { ascending: false })
          .range(pageParam, pageParam + PAGE - 1),
      ) as { id: number; activity: Activity; ref_id: string | null; duration_seconds: number; items_count: number; score: number | null; completed: boolean; occurred_at: string }[],
    getNextPageParam: (last, pages) => (last.length === PAGE ? pages.length * PAGE : undefined),
  });

  const sessions = useQuery({
    queryKey: ['speaking-sessions', user?.id],
    enabled: Boolean(user),
    queryFn: async () =>
      unwrap(
        await db()
          .from('speaking_sessions')
          .select('id, transport, status, level, topic, scenario_id, duration_seconds, started_at, report')
          .order('started_at', { ascending: false })
          .limit(30),
      ) as SessionRow[],
  });

  const transcript = useQuery({
    queryKey: ['transcript', reportOf?.id],
    enabled: Boolean(reportOf),
    queryFn: async () =>
      unwrap(await db().from('speaking_transcripts').select('seq, role, text').eq('session_id', reportOf!.id).order('seq')) as { seq: number; role: string; text: string }[],
  });

  const removeSession = useMutation({
    mutationFn: async (id: string) => unwrap(await db().from('speaking_sessions').delete().eq('id', id)),
    onSuccess: () => {
      toast.success('Đã xóa phiên và bản ghi.');
      void qc.invalidateQueries({ queryKey: ['speaking-sessions'] });
      setDeleting(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = stats.data;
  const activityRows = s
    ? Object.entries(s.by_activity)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({ label: ACTIVITY_LABEL[k as Activity] ?? k, value: v, display: formatDuration(v) }))
    : [];
  const accuracyRows = s
    ? Object.entries(s.skill_accuracy).map(([k, v]) => ({
        label: SKILL_INFO[k as Skill] ?? k,
        value: percent(v.correct, v.total),
        display: `${percent(v.correct, v.total)}% (${v.correct}/${v.total})`,
      }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Tiến độ học tập" description="Mọi số liệu được tính từ hoạt động thực tế của bạn." />
      {stats.isError ? (
        <ErrorState message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Chuỗi ngày" loading={!s} value={`${s?.streak_days ?? 0} ngày`} />
            <StatCard label="Tổng thời gian" loading={!s} value={formatDuration(s?.total_seconds ?? 0)} />
            <StatCard label="Bài học hoàn thành" loading={!s} value={s?.lessons_completed ?? 0} />
            <StatCard label="Thời gian luyện nói" loading={!s} value={formatDuration(s?.speaking_seconds ?? 0)} hint={s ? `${s.speaking_sessions} phiên` : undefined} />
          </div>

          <Card>
            <CardHeader title="Phút học mỗi ngày (14 ngày)" />
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Thời gian theo hoạt động (30 ngày)" />
              <CardBody>{!s ? <Skeleton className="h-40 w-full" /> : <MeterList rows={activityRows} unit="Thời gian theo hoạt động" />}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Độ chính xác bài tập (30 ngày)" />
              <CardBody>{!s ? <Skeleton className="h-40 w-full" /> : <MeterList rows={accuracyRows} unit="Độ chính xác theo kỹ năng" />}</CardBody>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader title="Phiên luyện nói" description="Bản ghi văn bản được lưu; âm thanh không được lưu." />
        <CardBody>
          {sessions.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : sessions.isError ? (
            <ErrorState message={errorMessage(sessions.error)} onRetry={() => void sessions.refetch()} />
          ) : !sessions.data?.length ? (
            <EmptyState title="Chưa có phiên luyện nói" />
          ) : (
            <ul className="divide-y divide-border">
              {sessions.data.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={row.transport === 'realtime' ? 'primary' : 'neutral'}>{row.transport === 'realtime' ? 'Realtime' : 'Dự phòng'}</Badge>
                    <span className="font-medium">{row.scenario_id ? `Nhập vai: ${row.scenario_id}` : row.topic ?? 'Tự do'}</span>
                    <span className="text-muted">
                      {row.level} · {formatDuration(row.duration_seconds ?? 0)} · {formatRelative(row.started_at)}
                    </span>
                    {row.status === 'failed' && <Badge tone="danger">Lỗi kết nối</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setReportOf(row)}>
                      {row.report ? 'Báo cáo & bản ghi' : 'Bản ghi'}
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Xóa phiên" onClick={() => setDeleting(row)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lịch sử học" />
        <CardBody>
          {history.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : history.isError ? (
            <ErrorState message={errorMessage(history.error)} onRetry={() => void history.refetch()} />
          ) : !history.data?.pages[0]?.length ? (
            <EmptyState title="Chưa có hoạt động" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Hoạt động</th>
                      <th className="py-2 pr-4 font-medium">Chi tiết</th>
                      <th className="py-2 pr-4 text-right font-medium">Thời gian</th>
                      <th className="py-2 text-right font-medium">Khi nào</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.pages.flat().map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 pr-4 font-medium">{ACTIVITY_LABEL[r.activity] ?? r.activity}</td>
                        <td className="py-2 pr-4 text-fg-2">
                          {r.completed ? 'Hoàn thành' : 'Luyện tập'}
                          {r.score !== null ? ` · ${Math.round(Number(r.score))}%` : ''}
                          {r.items_count > 0 ? ` · ${r.items_count} mục` : ''}
                        </td>
                        <td className="tabular py-2 pr-4 text-right">{r.duration_seconds > 0 ? formatDuration(r.duration_seconds) : '—'}</td>
                        <td className="py-2 text-right whitespace-nowrap text-muted">{formatRelative(r.occurred_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history.hasNextPage && (
                <Button variant="outline" className="mt-4" onClick={() => void history.fetchNextPage()} loading={history.isFetchingNextPage}>
                  Xem thêm
                </Button>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Dialog open={reportOf !== null} onClose={() => setReportOf(null)} title="Phiên luyện nói" className="max-w-3xl">
        <div className="max-h-[70dvh] space-y-4 overflow-y-auto">
          {reportOf?.report && <SessionReportView report={reportOf.report} />}
          <div>
            <p className="mb-2 text-sm font-semibold">Bản ghi</p>
            {transcript.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !transcript.data?.length ? (
              <p className="text-sm text-muted">Không có bản ghi.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {transcript.data.map((t) => (
                  <li key={t.seq}>
                    <span className="font-semibold">{t.role === 'user' ? 'Bạn' : 'AI'}:</span> {t.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Xóa phiên luyện nói?"
        description="Bản ghi và báo cáo của phiên này sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa"
        danger
        loading={removeSession.isPending}
        onConfirm={() => deleting && removeSession.mutate(deleting.id)}
      />
    </div>
  );
}
