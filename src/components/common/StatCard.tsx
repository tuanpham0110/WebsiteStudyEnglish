import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';

export function StatCard({ label, value, hint, icon, loading }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; loading?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      {loading ? <Skeleton className="mt-2 h-7 w-20" /> : <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>}
      {hint && !loading && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
