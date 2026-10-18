import { useQuery } from '@tanstack/react-query';
import { db, unwrap } from '@/lib/supabase';
import { browserTimezone } from '@/lib/format';
import type { DashboardStats, PlanItem } from '@/lib/recommendations';
import { useAuth } from '@/providers/AuthProvider';
import { useLearnerContext } from '@/hooks/useUserData';

export function useDashboardStats() {
  const { user } = useAuth();
  const learner = useLearnerContext();
  const tz = learner.timezone || browserTimezone();
  return useQuery({
    queryKey: ['dashboard', user?.id, tz],
    enabled: Boolean(user) && !learner.loading,
    staleTime: 30_000,
    queryFn: async () => unwrap(await db().rpc('get_dashboard_stats', { p_tz: tz })) as DashboardStats,
  });
}

export function useActivePlan() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['plan', user?.id],
    enabled: Boolean(user),
    queryFn: async () =>
      (unwrap(
        await db().from('learning_plans').select('id, title, level, items, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(1),
      ) ?? [])[0] as { id: string; title: string; level: string; items: PlanItem[]; created_at: string } | undefined,
  });
}
