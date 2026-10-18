import {
  BarChart3,
  BookA,
  BookOpenText,
  Drama,
  Headphones,
  LayoutDashboard,
  MessageSquareText,
  Mic,
  PenLine,
  Settings,
  Shield,
  SpellCheck,
  User,
  AudioLines,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Học với AI',
    items: [
      { to: '/app', label: 'Tổng quan', icon: LayoutDashboard, end: true },
      { to: '/app/chat', label: 'AI Chat', icon: MessageSquareText },
      { to: '/app/speaking', label: 'Luyện nói', icon: Mic },
      { to: '/app/roleplay', label: 'Nhập vai', icon: Drama },
    ],
  },
  {
    title: 'Kỹ năng',
    items: [
      { to: '/app/vocabulary', label: 'Từ vựng', icon: BookA },
      { to: '/app/grammar', label: 'Ngữ pháp', icon: SpellCheck },
      { to: '/app/listening', label: 'Nghe', icon: Headphones },
      { to: '/app/reading', label: 'Đọc', icon: BookOpenText },
      { to: '/app/writing', label: 'Viết', icon: PenLine },
      { to: '/app/pronunciation', label: 'Phát âm', icon: AudioLines },
    ],
  },
  {
    title: 'Cá nhân',
    items: [
      { to: '/app/progress', label: 'Tiến độ', icon: BarChart3 },
      { to: '/app/profile', label: 'Hồ sơ', icon: User },
      { to: '/app/settings', label: 'Cài đặt', icon: Settings },
    ],
  },
];

export const ADMIN_ITEM: NavItem = { to: '/app/admin', label: 'Quản trị', icon: Shield };

export const MOBILE_TABS: NavItem[] = [
  { to: '/app', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/app/chat', label: 'Chat', icon: MessageSquareText },
  { to: '/app/speaking', label: 'Nói', icon: Mic },
  { to: '/app/vocabulary', label: 'Từ vựng', icon: BookA },
];
