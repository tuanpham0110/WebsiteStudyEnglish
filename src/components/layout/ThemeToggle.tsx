import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';

const ORDER: ThemePreference[] = ['light', 'dark', 'system'];
const LABEL: Record<ThemePreference, string> = { light: 'Giao diện sáng', dark: 'Giao diện tối', system: 'Theo hệ thống' };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`${LABEL[theme]} — chuyển sang: ${LABEL[next]}`}
      title={LABEL[theme]}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}
