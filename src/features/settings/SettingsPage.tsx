import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { LIVE_VOICES } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { Select, Switch } from '@/components/ui/form';
import { Alert, ErrorState, Progress, Skeleton } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { useAppConfig, useSettings, useUpdateSettings, type UserSettings } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { browserTimezone } from '@/lib/format';
import { browserTTS, loadVoices } from '@/lib/speech/tts';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['Asia/Ho_Chi_Minh', 'UTC'];
  }
}

function UsageRow({ label, used, limit, unit = 'lượt' }: { label: string; used: number; limit: number; unit?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular text-muted">
          {used}/{limit} {unit}
        </span>
      </div>
      <Progress value={used} max={Math.max(1, limit)} label={label} />
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const config = useAppConfig();
  const { theme, setTheme } = useTheme();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const zones = useMemo(timezones, []);

  useEffect(() => {
    void loadVoices().then(setVoices);
  }, []);

  const save = (patch: Partial<UserSettings>) =>
    update.mutate(patch, { onSuccess: () => toast.success('Đã lưu cài đặt.'), onError: (e) => toast.error(errorMessage(e)) });

  if (settings.isError) return <ErrorState message={errorMessage(settings.error)} onRetry={() => void settings.refetch()} />;
  if (!settings.data) return <Skeleton className="h-96 w-full" />;
  const s = settings.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Cài đặt" />

      <Card>
        <CardHeader title="Giao diện" />
        <CardBody>
          <Tabs<ThemePreference>
            label="Chế độ màu"
            value={theme}
            onChange={(t) => {
              setTheme(t);
              save({ theme: t });
            }}
            items={[
              { value: 'light', label: 'Sáng' },
              { value: 'dark', label: 'Tối' },
              { value: 'system', label: 'Theo hệ thống' },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="AI Chat" />
        <CardBody className="space-y-4">
          <Switch
            checked={s.auto_correct}
            onChange={(v) => save({ auto_correct: v })}
            label="Tự động sửa lỗi"
            description="Mỗi tin nhắn được kiểm tra ngữ pháp (tính vào cùng một lượt chat, dùng thêm 1 yêu cầu tới nhà cung cấp AI)."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Giọng đọc" description="Đọc văn bản dùng giọng có sẵn trên thiết bị của bạn." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tts-voice" className="mb-1.5 block text-sm font-medium text-fg-2">
                Giọng đọc của trình duyệt
              </label>
              <Select id="tts-voice" value={s.tts_voice ?? ''} onChange={(e) => save({ tts_voice: e.target.value || null })}>
                <option value="">Mặc định</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </Select>
              {voices.length === 0 && <p className="mt-1 text-xs text-muted">Không tìm thấy giọng tiếng Anh trên thiết bị này.</p>}
            </div>
            <div>
              <label htmlFor="tts-rate" className="mb-1.5 block text-sm font-medium text-fg-2">
                Tốc độ đọc: <span className="tabular">{s.tts_rate.toFixed(2)}×</span>
              </label>
              <input
                id="tts-rate"
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                defaultValue={s.tts_rate}
                onPointerUp={(e) => save({ tts_rate: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={(e) => save({ tts_rate: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-[var(--primary)]"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => browserTTS.speak('Hello! This is how I sound when I read English to you.', { rate: s.tts_rate, voiceURI: s.tts_voice })}>
            <Volume2 className="h-4 w-4" aria-hidden /> Nghe thử
          </Button>
          <div>
            <label htmlFor="live-voice" className="mb-1.5 block text-sm font-medium text-fg-2">
              Giọng AI khi luyện nói realtime
            </label>
            <Select id="live-voice" value={s.speaking_voice} onChange={(e) => save({ speaking_voice: e.target.value })} className="sm:w-60">
              {LIVE_VOICES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Múi giờ" description="Dùng để tính chuỗi ngày học và mục tiêu hôm nay." />
        <CardBody className="flex flex-wrap items-center gap-3">
          <Select aria-label="Múi giờ" value={s.timezone} onChange={(e) => save({ timezone: e.target.value })} className="sm:w-72">
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
          {s.timezone !== browserTimezone() && (
            <Button variant="ghost" size="sm" onClick={() => save({ timezone: browserTimezone() })}>
              Dùng múi giờ thiết bị ({browserTimezone()})
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Hạn mức sử dụng hôm nay" description="Đặt lại lúc 00:00 UTC (7:00 sáng giờ Việt Nam)." />
        <CardBody className="space-y-4">
          {config.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : config.isError ? (
            <Alert tone="warning">{errorMessage(config.error)}</Alert>
          ) : (
            <>
              {!config.data!.features.aiText && <Alert tone="warning">Tính năng AI chưa được bật trên máy chủ.</Alert>}
              <UsageRow label="AI Chat & luyện nói dự phòng" used={config.data!.usage.chat} limit={config.data!.limits.chatPerDay} />
              <UsageRow label="Dịch, giải thích từ, viết lại, nhận dạng giọng nói" used={config.data!.usage.assist + config.data!.usage.stt} limit={config.data!.limits.assistPerDay} />
              <UsageRow label="Chấm bài viết & báo cáo" used={config.data!.usage.evaluation} limit={config.data!.limits.evalPerDay} />
              {config.data!.features.aiVoice && (
                <UsageRow
                  label="Luyện nói realtime"
                  used={Math.round(config.data!.usage.voice_seconds / 60)}
                  limit={Math.round(config.data!.limits.voiceSecondsPerDay / 60)}
                  unit="phút"
                />
              )}
              <p className="text-xs text-muted">
                Tối đa {config.data!.limits.aiPerMinute} yêu cầu AI mỗi phút. Khi hết hạn mức, hệ thống dừng tính năng và không tự chuyển sang dịch vụ trả phí.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Quyền riêng tư" />
        <CardBody className="text-sm text-fg-2">
          Ứng dụng không lưu file âm thanh. Bản ghi văn bản của phiên luyện nói có thể xóa trong trang{' '}
          <Link to="/app/progress" className="text-primary hover:underline">
            Tiến độ
          </Link>
          . Xem chi tiết trong{' '}
          <Link to="/privacy" className="text-primary hover:underline">
            Chính sách quyền riêng tư
          </Link>
          .
        </CardBody>
      </Card>
    </div>
  );
}
