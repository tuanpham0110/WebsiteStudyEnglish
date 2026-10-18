import { Settings2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

/** Shown instead of auth/app screens when the build has no Supabase configuration. */
export function ConfigMissing() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-xl bg-warning-soft p-3 text-warning">
        <Settings2 className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">Ứng dụng chưa được cấu hình</h1>
      <p className="mt-2 text-sm text-muted">
        Bản build này chưa có <code className="rounded bg-surface-2 px-1">VITE_SUPABASE_URL</code> và{' '}
        <code className="rounded bg-surface-2 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code>, nên chưa thể đăng nhập hay lưu dữ liệu. Xem
        hướng dẫn trong <code className="rounded bg-surface-2 px-1">docs/DEPLOYMENT.md</code>.
      </p>
      <ButtonLink to="/" variant="outline" className="mt-6">
        Về trang chủ
      </ButtonLink>
    </div>
  );
}
