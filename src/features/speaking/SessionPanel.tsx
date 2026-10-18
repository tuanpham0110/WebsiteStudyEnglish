import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Brain, Hand, Loader2, Mic, MicOff, Play, PhoneOff, SendHorizontal, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Alert, Progress } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { FallbackSpeakingController, type SpeakingState, type SpeakingStatus } from './controllers';

type Display = { label: string; tone: 'idle' | 'active' | 'ai' | 'warn' | 'error'; icon: React.ReactNode; pulse?: boolean };

export function statusDisplay(state: SpeakingState): Display {
  const s: SpeakingStatus = state.status;
  if ((s === 'listening' || s === 'thinking') && state.muted) return { label: 'Micro đang tắt', tone: 'warn', icon: <MicOff className="h-8 w-8" /> };
  switch (s) {
    case 'idle':
      return { label: 'Sẵn sàng', tone: 'idle', icon: <Mic className="h-8 w-8" /> };
    case 'requesting_mic':
      return { label: state.transport === 'fallback' && state.sessionId ? 'Đang bật micro…' : 'Đang xin quyền micro…', tone: 'idle', icon: <Loader2 className="h-8 w-8 animate-spin" /> };
    case 'connecting':
      return { label: 'Đang kết nối…', tone: 'idle', icon: <Loader2 className="h-8 w-8 animate-spin" /> };
    case 'listening':
      return { label: 'Đang nghe bạn nói', tone: 'active', icon: <Mic className="h-8 w-8" />, pulse: true };
    case 'thinking':
      return { label: 'AI đang suy nghĩ…', tone: 'ai', icon: <Brain className="h-8 w-8" /> };
    case 'speaking':
      return { label: 'AI đang nói', tone: 'ai', icon: <Volume2 className="h-8 w-8" />, pulse: true };
    case 'waiting':
      return { label: state.muted ? 'Micro đang tắt' : 'Lượt của bạn', tone: 'warn', icon: <Hand className="h-8 w-8" /> };
    case 'ending':
      return { label: 'Đang kết thúc…', tone: 'idle', icon: <Loader2 className="h-8 w-8 animate-spin" /> };
    case 'ended':
      return { label: 'Đã kết thúc', tone: 'idle', icon: <PhoneOff className="h-8 w-8" /> };
    case 'error':
      return { label: 'Đã xảy ra lỗi', tone: 'error', icon: <AlertCircle className="h-8 w-8" /> };
  }
}

const toneClass: Record<Display['tone'], string> = {
  idle: 'bg-surface-2 text-muted',
  active: 'bg-primary text-primary-fg',
  ai: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  error: 'bg-danger-soft text-danger',
};

export function StatusOrb({ state }: { state: SpeakingState }) {
  const d = statusDisplay(state);
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {d.pulse && <span className={cn('animate-pulse-ring absolute inset-0 rounded-full', d.tone === 'active' ? 'bg-primary' : 'bg-success')} aria-hidden />}
        <div className={cn('relative flex h-24 w-24 items-center justify-center rounded-full transition-colors', toneClass[d.tone])}>{d.icon}</div>
      </div>
      <p className="mt-3 text-base font-semibold" role="status" aria-live="polite">
        {d.label}
      </p>
      <p className="mt-0.5 text-xs text-muted">{state.micLive ? 'Micro đang hoạt động' : 'Micro đang tắt'}</p>
    </div>
  );
}

export function SessionPanel({
  state,
  controller,
  onEnd,
}: {
  state: SpeakingState;
  controller: { setMuted: (m: boolean) => void; replay: (id: number) => void } & Partial<Pick<FallbackSpeakingController, 'listen' | 'stopListening' | 'sendText'>>;
  onEnd: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const isFallback = state.transport === 'fallback';
  const fallback = isFallback ? (controller as FallbackSpeakingController) : null;
  const active = ['requesting_mic', 'connecting', 'listening', 'thinking', 'speaking', 'waiting'].includes(state.status);
  const remaining = state.maxSeconds > 0 ? Math.max(0, state.maxSeconds - state.elapsed) : null;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.transcript, state.interim]);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface p-6">
        <StatusOrb state={state} />
        {state.startedAt !== null && (
          <div className="w-full">
            <div className="tabular flex justify-between text-sm">
              <span className="font-semibold">{formatClock(state.elapsed)}</span>
              {state.maxSeconds > 0 && <span className="text-muted">/ {formatClock(state.maxSeconds)}</span>}
            </div>
            {state.maxSeconds > 0 && <Progress value={state.elapsed} max={state.maxSeconds} label="Thời lượng phiên" className="mt-1.5" />}
            {remaining !== null && remaining <= 30 && active && <p className="mt-1.5 text-xs font-medium text-warning">Còn {Math.ceil(remaining)} giây — phiên sẽ tự kết thúc.</p>}
          </div>
        )}
        {active && (
          <div className="flex w-full flex-col gap-2">
            {fallback && fallback.canListen && (
              <Button
                variant="soft"
                onClick={() => (state.status === 'listening' ? fallback.stopListening() : fallback.listen())}
                disabled={state.status === 'thinking' || state.status === 'connecting'}
              >
                <Mic className="h-4 w-4" aria-hidden /> {state.status === 'listening' ? 'Nói xong' : 'Nói'}
              </Button>
            )}
            <Button variant="outline" onClick={() => controller.setMuted(!state.muted)} aria-pressed={state.muted} disabled={state.status === 'connecting' || state.status === 'requesting_mic'}>
              {state.muted ? <Mic className="h-4 w-4" aria-hidden /> : <MicOff className="h-4 w-4" aria-hidden />}
              {state.muted ? 'Bật micro' : 'Tắt micro'}
            </Button>
            <Button variant="danger" onClick={onEnd}>
              <PhoneOff className="h-4 w-4" aria-hidden /> Kết thúc phiên
            </Button>
          </div>
        )}
      </div>

      <div className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Bản ghi hội thoại</h2>
          <p className="text-xs text-muted">
            {isFallback ? 'Nhận dạng bởi trình duyệt; có thể có sai sót.' : 'Do nhà cung cấp giọng nói tạo tự động; có thể có sai sót.'}
          </p>
        </div>
        <div ref={listRef} className="scrollbar-thin max-h-[28rem] min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {state.transcript.length === 0 && !state.interim && (
            <p className="py-8 text-center text-sm text-muted">{active ? 'Hãy bắt đầu nói bằng tiếng Anh…' : 'Chưa có nội dung.'}</p>
          )}
          {state.transcript.map((e) => (
            <div key={e.id} className={cn('flex items-end gap-1', e.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                  e.role === 'user' ? 'rounded-br-md bg-primary text-primary-fg' : 'rounded-bl-md bg-surface-2 text-fg',
                  !e.final && 'opacity-70',
                )}
              >
                {e.text || <span className="italic">…</span>}
                {e.interrupted && <span className="ml-1 text-xs opacity-70">(bị ngắt lời)</span>}
              </div>
              {e.role === 'assistant' && e.final && e.text && (isFallback || (e.audio?.length && !active)) && (
                <Button variant="ghost" size="icon-sm" aria-label="Phát lại câu trả lời" title="Phát lại" onClick={() => controller.replay(e.id)}>
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {state.interim && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md border border-dashed border-primary px-3.5 py-2 text-sm text-fg-2 italic">{state.interim}</div>
            </div>
          )}
        </div>
        {fallback && active && (
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              void fallback.sendText(text);
              setText('');
            }}
          >
            <label htmlFor="speak-type" className="sr-only">
              Gõ câu trả lời
            </label>
            <Input id="speak-type" value={text} onChange={(e) => setText(e.target.value)} placeholder="Hoặc gõ câu trả lời bằng tiếng Anh…" maxLength={1000} disabled={state.status === 'thinking'} />
            <Button type="submit" size="icon" aria-label="Gửi" disabled={!text.trim() || state.status === 'thinking'}>
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      {state.notice && (
        <Alert tone="warning" className="lg:col-span-2">
          {state.notice}
        </Alert>
      )}
    </div>
  );
}
