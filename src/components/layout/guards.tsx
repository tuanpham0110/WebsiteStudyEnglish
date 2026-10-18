import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useUserData';
import { isSupabaseConfigured } from '@/lib/env';
import { ErrorState, FullPageSpinner } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api';
import { ConfigMissing } from './ConfigMissing';

/** Requires a session; sends un-onboarded users to onboarding. */
export function ProtectedRoute({ children, allowNotOnboarded = false }: { children: ReactNode; allowNotOnboarded?: boolean }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const profile = useProfile();

  if (!isSupabaseConfigured) return <ConfigMissing />;
  if (loading) return <FullPageSpinner />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (profile.isLoading) return <FullPageSpinner />;
  if (profile.isError) {
    return <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} className="min-h-[60dvh]" />;
  }
  if (!allowNotOnboarded && !profile.data?.onboarded_at) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** UI guard only — the database enforces admin access (admin_overview checks the role). */
export function AdminRoute({ children }: { children: ReactNode }) {
  const profile = useProfile();
  if (profile.isLoading) return <FullPageSpinner />;
  if (profile.data?.role !== 'admin') return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/** Signed-in users visiting /login or /register go straight to the app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading, recovery } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (session && !recovery) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
