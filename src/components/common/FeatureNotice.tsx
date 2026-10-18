import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/feedback';
import { useAppConfig } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';

/**
 * Explains honestly when an AI feature is unavailable (server not configured,
 * API not deployed) instead of showing fake results.
 */
export function AiFeatureGate({ feature = 'aiText', children }: { feature?: 'aiText' | 'aiVoice'; children: ReactNode }) {
  const config = useAppConfig();
  if (config.isError) {
    return (
      <Alert tone="warning" title="Không kết nối được API của EnglishAI">
        {errorMessage(config.error)} Các tính năng AI tạm thời không dùng được; các bài học khác vẫn hoạt động.
      </Alert>
    );
  }
  if (config.data && !config.data.features[feature]) {
    return (
      <Alert tone="warning" title={feature === 'aiVoice' ? 'Luyện nói realtime chưa được bật' : 'Tính năng AI chưa được bật'}>
        Quản trị viên chưa cấu hình nhà cung cấp AI trên máy chủ (integration pending). Không có câu trả lời giả lập nào được hiển thị.
      </Alert>
    );
  }
  return <>{children}</>;
}

export function UsageHint({ kind }: { kind: 'chat' | 'assist' | 'evaluation' }) {
  const config = useAppConfig();
  if (!config.data) return null;
  const limit = { chat: config.data.limits.chatPerDay, assist: config.data.limits.assistPerDay, evaluation: config.data.limits.evalPerDay }[kind];
  const used = config.data.usage[kind] ?? 0;
  return (
    <span className="tabular text-xs text-muted" title="Hạn mức đặt lại lúc 00:00 UTC (7:00 sáng giờ Việt Nam)">
      Đã dùng {used}/{limit} lượt hôm nay
    </span>
  );
}
