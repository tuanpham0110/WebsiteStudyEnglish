import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Mic, Users } from 'lucide-react';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { Alert, Badge, ErrorState, Skeleton } from '@/components/ui/feedback';
import { BarChartPanel } from '@/components/common/BarChartCard';
import { StatCard } from '@/components/common/StatCard';
import { useAppConfig } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { formatDay, formatNumber } from '@/lib/format';
import { db, unwrap } from '@/lib/supabase';

type Overview = {
  users_total: number;
  users_new_7d: number;
  users_onboarded: number;
  active_today: number;
  requests_today: Record<string, number>;
  errors_today: number;
  voice_seconds_today: number;
  voice_active_now: number;
  daily: { day: string; requests: number; voice_seconds: number }[];
  top_users_today: { user_ref: string; display_name: string | null; requests: number }[];
  content: { lessons: number; exercises: number; vocabulary: number };
};

const KIND_LABEL: Record<string, string> = { chat: 'Chat', assist: 'Trợ giúp', evaluation: 'Chấm bài/báo cáo', stt: 'Nhận dạng giọng nói', tts: 'Đọc văn bản' };

export default function AdminPage() {
  const overview = useQuery({
    queryKey: ['admin-overview'],
    refetchInterval: 60_000,
    queryFn: async () => unwrap(await db().rpc('admin_overview')) as Overview,
  });
  const config = useAppConfig();
  const o = overview.data;
  const totalRequests = o ? Object.values(o.requests_today).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Quản trị" description="Số liệu tổng hợp (không chứa nội dung tin nhắn hay email). Ngày tính theo UTC." />
      {overview.isError ? (
        <ErrorState message={errorMessage(overview.error)} onRetry={() => void overview.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Người dùng" icon={<Users className="h-4 w-4" />} loading={overview.isLoading} value={formatNumber(o?.users_total ?? 0)} hint={o ? `+${o.users_new_7d} trong 7 ngày · ${o.users_onboarded} đã thiết lập` : undefined} />
            <StatCard label="Hoạt động hôm nay" icon={<Activity className="h-4 w-4" />} loading={overview.isLoading} value={formatNumber(o?.active_today ?? 0)} hint="người có hoạt động học" />
            <StatCard
              label="Yêu cầu AI hôm nay"
              icon={<Activity className="h-4 w-4" />}
              loading={overview.isLoading}
              value={formatNumber(totalRequests)}
              hint={config.data ? `Trần hệ thống do máy chủ cấu hình` : undefined}
            />
            <StatCard
              label="Luyện nói realtime hôm nay"
              icon={<Mic className="h-4 w-4" />}
              loading={overview.isLoading}
              value={`${Math.round((o?.voice_seconds_today ?? 0) / 60)} phút`}
              hint={o ? `${o.voice_active_now} phiên đang diễn ra` : undefined}
            />
          </div>

          {o && o.errors_today > 0 && (
            <Alert tone="warning" title={`${o.errors_today} lỗi từ nhà cung cấp AI hôm nay`}>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Có thể do hết hạn mức miễn phí (HTTP 429) hoặc nhà cung cấp gặp sự cố.
              </span>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Yêu cầu AI mỗi ngày" description="Số lần gọi nhà cung cấp AI (14 ngày)." />
              <CardBody>
                {overview.isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <BarChartPanel ariaLabel="Số yêu cầu AI mỗi ngày" unit="yêu cầu" data={o!.daily.map((d) => ({ label: formatDay(d.day).split(',')[0], tooltip: formatDay(d.day), value: d.requests }))} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Phút luyện nói realtime mỗi ngày" description="Thời lượng do máy chủ đo (14 ngày)." />
              <CardBody>
                {overview.isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <BarChartPanel ariaLabel="Số phút luyện nói realtime mỗi ngày" unit="phút" data={o!.daily.map((d) => ({ label: formatDay(d.day).split(',')[0], tooltip: formatDay(d.day), value: Math.round(d.voice_seconds / 60) }))} />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Yêu cầu theo loại (hôm nay)" />
              <CardBody>
                {overview.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : Object.keys(o!.requests_today).length === 0 ? (
                  <p className="text-sm text-muted">Chưa có yêu cầu nào hôm nay.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {Object.entries(o!.requests_today).map(([k, v]) => (
                      <li key={k} className="flex justify-between py-2">
                        <span>{KIND_LABEL[k] ?? k}</span>
                        <span className="tabular">{formatNumber(v)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Người dùng nhiều nhất hôm nay" description="Mã rút gọn để phát hiện lạm dụng." />
              <CardBody>
                {overview.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : o!.top_users_today.length === 0 ? (
                  <p className="text-sm text-muted">Chưa có dữ liệu.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {o!.top_users_today.map((u) => (
                      <li key={u.user_ref} className="flex justify-between py-2">
                        <span>
                          {u.display_name ?? 'Ẩn danh'} <span className="font-mono text-xs text-muted">{u.user_ref}</span>
                        </span>
                        <span className="tabular">{formatNumber(u.requests)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Cấu hình máy chủ" description="Đọc từ API (giá trị đặt trong biến môi trường Cloudflare)." />
            <CardBody className="space-y-3 text-sm">
              {config.data ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={config.data.features.aiText ? 'success' : 'warning'}>AI văn bản: {config.data.features.aiText ? config.data.features.textModel : 'tắt'}</Badge>
                    <Badge tone={config.data.features.aiVoice ? 'success' : 'warning'}>Realtime voice: {config.data.features.aiVoice ? config.data.features.liveModel : 'tắt'}</Badge>
                  </div>
                  <p className="text-fg-2">
                    Mỗi người/ngày: {config.data.limits.chatPerDay} chat · {config.data.limits.assistPerDay} trợ giúp · {config.data.limits.evalPerDay} chấm bài ·{' '}
                    {Math.round(config.data.limits.voiceSecondsPerDay / 60)} phút nói · {config.data.limits.aiPerMinute} yêu cầu/phút · phiên nói tối đa{' '}
                    {Math.round(config.data.limits.voiceSessionSeconds / 60)} phút.
                  </p>
                </>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {o && (
                <p className="text-fg-2">
                  Nội dung: {o.content.lessons} bài học · {o.content.exercises} bài tập · {o.content.vocabulary} từ vựng.
                </p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
