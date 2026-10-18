import { Link, Outlet } from 'react-router';
import { useAuth } from '@/providers/AuthProvider';
import { ButtonLink } from '@/components/ui/button';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export function PublicHeader() {
  const { session } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Trang công khai" className="hidden items-center gap-6 text-sm text-fg-2 md:flex">
          <a href="/#skills" className="hover:text-fg">
            Kỹ năng
          </a>
          <a href="/#how" className="hover:text-fg">
            Cách học
          </a>
          <a href="/#voice" className="hover:text-fg">
            Luyện nói
          </a>
          <a href="/#faq" className="hover:text-fg">
            Câu hỏi
          </a>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {session ? (
            <ButtonLink to="/app" size="sm">
              Vào học
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Đăng nhập
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                Bắt đầu miễn phí
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-muted">
            Nền tảng luyện tiếng Anh với AI. Kết quả đánh giá trình độ chỉ mang tính ước lượng, không phải chứng chỉ CEFR chính thức.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="font-semibold">Sản phẩm</p>
            <ul className="mt-2 space-y-1.5 text-muted">
              <li>
                <Link to="/register" className="hover:text-fg">
                  Tạo tài khoản
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-fg">
                  Đăng nhập
                </Link>
              </li>
              <li>
                <a href="/#faq" className="hover:text-fg">
                  Câu hỏi thường gặp
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Pháp lý</p>
            <ul className="mt-2 space-y-1.5 text-muted">
              <li>
                <Link to="/privacy" className="hover:text-fg">
                  Chính sách quyền riêng tư
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-fg">
                  Điều khoản sử dụng
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted">© {new Date().getFullYear()} EnglishAI</div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PublicHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
