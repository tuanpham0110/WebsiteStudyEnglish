import { useState } from 'react';
import { AlertCircle, BookOpen, Languages, Loader2, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AssistResult, Correction } from '@shared/schemas';
import type { ExplanationLanguage, Level } from '@shared/constants';
import { CopyButton } from '@/components/common/CopyButton';
import { SpeakButton } from '@/components/common/SpeakButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { assist } from './api';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  correction?: Correction | null;
  translation_vi?: string | null;
  status: 'done' | 'streaming' | 'error';
  error?: string;
  persisted: boolean;
};

export function CorrectionCard({ correction }: { correction: Correction }) {
  if (!correction.hasErrors) return null;
  return (
    <div className="mt-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm" aria-label="Gợi ý sửa lỗi">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-warning uppercase">
        <Wand2 className="h-3.5 w-3.5" aria-hidden /> Gợi ý sửa
      </p>
      <dl className="mt-2 space-y-1.5">
        <div>
          <dt className="text-xs text-muted">Bạn đã viết</dt>
          <dd className="text-fg-2">{correction.original}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Câu đúng</dt>
          <dd className="flex items-center gap-1 font-medium text-fg">
            {correction.corrected}
            <SpeakButton text={correction.corrected} />
          </dd>
        </div>
        {correction.explanation && (
          <div>
            <dt className="text-xs text-muted">Giải thích</dt>
            <dd className="text-fg-2">{correction.explanation}</dd>
          </div>
        )}
        {correction.example && (
          <div>
            <dt className="text-xs text-muted">Ví dụ thêm</dt>
            <dd className="text-fg-2 italic">{correction.example}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function AssistPanel({ result }: { result: AssistResult }) {
  if (result.task === 'translate') {
    return <p className="text-sm text-fg-2">{result.result.translation}</p>;
  }
  if (result.task === 'rewrite') {
    return (
      <div className="space-y-1.5 text-sm">
        <p className="flex items-center gap-1 font-medium text-fg">
          {result.result.natural} <SpeakButton text={result.result.natural} />
        </p>
        {result.result.alternatives.map((a) => (
          <p key={a} className="text-fg-2">
            • {a}
          </p>
        ))}
        <p className="text-xs text-muted">{result.result.explanation}</p>
      </div>
    );
  }
  if (result.task === 'explain_vocab') {
    if (result.result.items.length === 0) return <p className="text-sm text-muted">Không có từ nào cần giải thích.</p>;
    return (
      <ul className="space-y-2 text-sm">
        {result.result.items.map((item) => (
          <li key={item.word}>
            <p className="flex flex-wrap items-center gap-x-2 font-semibold text-fg">
              {item.word}
              {item.partOfSpeech && <span className="text-xs font-normal text-muted">{item.partOfSpeech}</span>}
              {item.ipa && <span className="text-xs font-normal text-muted">{item.ipa}</span>}
              <SpeakButton text={item.word} />
            </p>
            <p className="text-fg-2">{item.meaningVi}</p>
            {item.definitionEn && <p className="text-xs text-muted">{item.definitionEn}</p>}
            {item.example && <p className="text-xs text-muted italic">{item.example}</p>}
          </li>
        ))}
      </ul>
    );
  }
  return <CorrectionCard correction={result.result} />;
}

export function MessageBubble({
  message,
  level,
  explanationLanguage,
  onRetry,
  aiEnabled,
}: {
  message: ChatMessage;
  level: Level;
  explanationLanguage: ExplanationLanguage;
  onRetry?: () => void;
  aiEnabled: boolean;
}) {
  const [panel, setPanel] = useState<AssistResult | null>(
    message.translation_vi ? { task: 'translate', result: { translation: message.translation_vi } } : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const isUser = message.role === 'user';

  const run = async (task: 'translate' | 'explain_vocab' | 'rewrite') => {
    if (panel?.task === task) return setPanel(null);
    setBusy(task);
    try {
      const result = await assist({
        task,
        text: message.content,
        level,
        explanationLanguage,
        messageId: task === 'translate' && message.persisted ? message.id : undefined,
      });
      setPanel(result);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[92%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap sm:max-w-[80%]',
          isUser ? 'rounded-br-md bg-primary text-primary-fg' : 'rounded-bl-md border border-border bg-surface text-fg',
          message.status === 'error' && 'border border-danger/40',
        )}
      >
        {message.content || (message.status === 'streaming' ? <span className="text-muted">Đang soạn câu trả lời…</span> : null)}
        {message.status === 'streaming' && message.content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-current align-middle opacity-60" aria-hidden />}
      </div>

      {message.status === 'error' && (
        <div className="mt-1.5 flex items-center gap-2 text-sm text-danger" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>{message.error}</span>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Thử lại
            </Button>
          )}
        </div>
      )}

      {isUser && message.correction && <CorrectionCard correction={message.correction} />}

      {message.status === 'done' && message.content && (
        <div className={cn('mt-1 flex flex-wrap items-center gap-0.5', isUser ? 'justify-end' : 'justify-start')}>
          <SpeakButton text={message.content} />
          <CopyButton text={message.content} />
          {aiEnabled && !isUser && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void run('translate')} aria-pressed={panel?.task === 'translate'}>
              {busy === 'translate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />} Dịch
            </Button>
          )}
          {aiEnabled && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void run('explain_vocab')} aria-pressed={panel?.task === 'explain_vocab'}>
              {busy === 'explain_vocab' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />} Từ vựng
            </Button>
          )}
          {aiEnabled && isUser && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void run('rewrite')} aria-pressed={panel?.task === 'rewrite'}>
              {busy === 'rewrite' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Tự nhiên hơn
            </Button>
          )}
        </div>
      )}

      {panel && (
        <div className="mt-1 max-w-[92%] animate-fade-in rounded-xl border border-border bg-surface-2 p-3 sm:max-w-[80%]">
          <AssistPanel result={panel} />
        </div>
      )}
    </div>
  );
}
