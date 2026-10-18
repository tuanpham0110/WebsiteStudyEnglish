import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { LogOut, Menu, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile, useSettings } from '@/hooks/useUserData';
import { hasStoredTheme, useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/ui/feedback';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { ADMIN_ITEM, MOBILE_TABS, NAV_SECTIONS, type NavItem } from './nav';

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-primary-soft text-primary' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const profile = useProfile();
  const { signOut, user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Điều hướng chính" className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-muted uppercase">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavEntry key={item.to} item={item} onNavigate={onNavigate} />
              ))}
              {section.title === 'Cá nhân' && profile.data?.role === 'admin' && <NavEntry item={ADMIN_ITEM} onNavigate={onNavigate} />}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden>
            {(profile.data?.display_name ?? user?.email ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile.data?.display_name ?? 'Học viên'}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => void signOut()} aria-label="Đăng xuất" title="Đăng xuất">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Menu"
      className="m-0 h-dvh max-h-dvh w-[84vw] max-w-xs border-r border-border bg-surface p-0 text-fg backdrop:bg-black/40"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Logo to="/app" />
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng menu">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <NavContent onNavigate={onClose} />
          </div>
        </div>
      )}
    </dialog>
  );
}

export function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const settings = useSettings();
  const { setTheme } = useTheme();

  // On a new device, adopt the theme saved in the account.
  useEffect(() => {
    const saved = settings.data?.theme;
    if (saved && saved !== 'system' && !hasStoredTheme()) setTheme(saved);
  }, [settings.data?.theme, setTheme]);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Move focus to the page on navigation for screen-reader and keyboard users.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Bỏ qua tới nội dung
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center justify-between px-5">
          <Logo to="/app" />
          <ThemeToggle />
        </div>
        <div className="min-h-0 flex-1">
          <NavContent />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-3 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setDrawer(true)} aria-label="Mở menu">
          <Menu className="h-5 w-5" />
        </Button>
        <Logo to="/app" />
        <ThemeToggle />
      </header>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />

      <main id="main" ref={mainRef} tabIndex={-1} className="pb-24 outline-none lg:pb-10 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<FullPageSpinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Điều hướng nhanh"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {MOBILE_TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')
            }
          >
            <item.icon className="h-5 w-5" aria-hidden />
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted">
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          Thêm
        </button>
      </nav>
    </div>
  );
}
