import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ConfigMissing } from '@/components/layout/ConfigMissing';
import { isSupabaseConfigured } from '@/lib/env';

export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        {!isSupabaseConfigured ? (
          <ConfigMissing />
        ) : (
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
              <div className="mt-6">{children}</div>
            </div>
            {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
            <p className="mt-6 text-center text-xs text-muted">
              <Link to="/privacy" className="hover:text-fg">
                Quyền riêng tư
              </Link>{' '}
              ·{' '}
              <Link to="/terms" className="hover:text-fg">
                Điều khoản
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

/** Map Supabase Auth error messages to Vietnamese. */
export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (m.includes('email not confirmed')) return 'Email chưa được xác minh. Hãy mở thư xác minh trong hộp thư của bạn.';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Email này đã được đăng ký. Hãy đăng nhập.';
  if (m.includes('password should be') || m.includes('weak password')) return 'Mật khẩu chưa đủ mạnh. Dùng ít nhất 8 ký tự gồm chữ và số.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) {
    return 'Bạn thao tác quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.';
  }
  if (m.includes('email address') && m.includes('invalid')) return 'Địa chỉ email không hợp lệ.';
  if (m.includes('not authorized') || m.includes('email address not authorized')) {
    return 'Máy chủ chưa cấu hình dịch vụ gửi email (SMTP) cho địa chỉ này. Liên hệ quản trị viên.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) return 'Không kết nối được máy chủ xác thực. Kiểm tra mạng.';
  return message || 'Đã có lỗi xảy ra.';
}
