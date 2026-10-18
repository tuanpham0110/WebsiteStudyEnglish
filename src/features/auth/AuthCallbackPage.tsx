import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, FullPageSpinner } from '@/components/ui/feedback';
import { useAuth } from '@/providers/AuthProvider';
import { AuthShell } from './AuthShell';

/** Landing point for email confirmation links (PKCE code is exchanged by supabase-js). */
export default function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error] = useState(() => {
    const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, '&'));
    return params.get('error_description');
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (session) navigate('/onboarding', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (error || (timedOut && !session && !loading)) {
    return (
      <AuthShell title="Không thể xác minh">
        <Alert tone="danger">{error ?? 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.'}</Alert>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Về trang đăng nhập
        </Link>
      </AuthShell>
    );
  }
  return <FullPageSpinner />;
}
