import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FallbackSpeakingController, RealtimeSpeakingController, type SpeakingState } from './controllers';

type AnyController = RealtimeSpeakingController | FallbackSpeakingController;

const IDLE: SpeakingState = {
  transport: 'realtime',
  status: 'idle',
  sessionId: null,
  transcript: [],
  interim: '',
  startedAt: null,
  elapsed: 0,
  maxSeconds: 0,
  muted: false,
  micLive: false,
  error: null,
  errorCode: null,
  notice: null,
  endedReason: null,
  durationSeconds: null,
};

const noopSubscribe = () => () => {};

/** Holds the current session controller and exposes its state to React. */
export function useSpeakingController() {
  const [controller, setController] = useState<AnyController | null>(null);
  const ref = useRef<AnyController | null>(null);
  ref.current = controller;

  const state = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller ? controller.getState : () => IDLE,
    () => IDLE,
  );

  const begin = useCallback((next: AnyController) => {
    ref.current?.destroy();
    setController(next);
    void next.start();
  }, []);

  // Always release the microphone when leaving the page.
  useEffect(() => () => ref.current?.destroy(), []);

  return { controller, state, begin };
}
