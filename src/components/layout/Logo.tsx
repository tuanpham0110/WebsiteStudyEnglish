import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2 rounded-md font-semibold text-fg', className)} aria-label="EnglishAI — trang chủ">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path d="M9 9h10v2.6h-7v3.2h6.2v2.6H12v3.4h7.2V23H9z" fill="var(--primary-fg)" />
        <circle cx="23.5" cy="21" r="2.2" fill="var(--primary-fg)" opacity="0.6" />
      </svg>
      <span className="text-lg tracking-tight">
        English<span className="text-primary">AI</span>
      </span>
    </Link>
  );
}
