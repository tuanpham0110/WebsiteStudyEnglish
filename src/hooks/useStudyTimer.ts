import { useEffect, useRef } from 'react';
import type { Activity } from '@shared/constants';
import { logProgress, logProgressOnUnload } from '@/lib/progress';
import { useAuth } from '@/providers/AuthProvider';

const IDLE_MS = 90_000;
const FLUSH_SECONDS = 60;

/**
 * Counts time actually spent on a learning page: the tab must be visible and the
 * learner must have interacted within the last 90 s (or `forceActive` is true,
 * e.g. while audio is playing). Time is saved every minute and on leave.
 */
export function useStudyTimer(activity: Activity, options: { enabled?: boolean; forceActive?: boolean; refId?: string } = {}) {
  const { user } = useAuth();
  const enabled = options.enabled ?? true;
  const forceActive = useRef(options.forceActive ?? false);
  forceActive.current = options.forceActive ?? false;
  const refId = useRef(options.refId);
  refId.current = options.refId;

  useEffect(() => {
    if (!user || !enabled) return;
    let seconds = 0;
    let lastInteraction = Date.now();
    const userId = user.id;

    const touch = () => (lastInteraction = Date.now());
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const flush = () => {
      if (seconds < 5) return;
      const value = seconds;
      seconds = 0;
      void logProgress(userId, { activity, ref_id: refId.current ?? null, duration_seconds: value }).catch(() => {
        seconds += value; // retry on next flush
      });
    };

    const interval = setInterval(() => {
      const visible = document.visibilityState === 'visible';
      const active = forceActive.current || Date.now() - lastInteraction < IDLE_MS;
      if (visible && active) seconds += 1;
      if (seconds >= FLUSH_SECONDS) flush();
    }, 1000);

    const onHide = () => {
      if (seconds >= 5) {
        logProgressOnUnload(userId, { activity, ref_id: refId.current ?? null, duration_seconds: seconds });
        seconds = 0;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, touch));
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [user, enabled, activity]);
}
