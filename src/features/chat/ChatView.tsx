import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SendHorizontal, Square } from 'lucide-react';
import type { ChatMode, ExplanationLanguage, Level } from '@shared/constants';
import type { RoleplayScenario } from '@shared/roleplay';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { errorMessage, streamChat } from '@/lib/api';
import { deleteMessages, fetchMessages } from './api';
import { MessageBubble, type ChatMessage } from './MessageBubble';

let tempCounter = 0;
const tempId = () => `local-${Date.now()}-${tempCounter++}`;

export type ChatViewProps = {
  initialConversationId: string | null;
  mode: ChatMode;
  level: Level;
  topic?: string;
  scenario?: RoleplayScenario;
  autoCorrect: boolean;
  explanationLanguage: ExplanationLanguage;
  aiEnabled: boolean;
  starters?: string[];
  emptyState?: ReactNode;
  onConversationCreated?: (id: string) => void;
  onMessagesChange?: (count: number) => void;
};

export function ChatView(props: ChatViewProps) {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(props.initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(props.initialConversationId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { onMessagesChange } = props;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchMessages(id);
      setMessages(rows.map((r) => ({ ...r, status: 'done', persisted: true })));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (props.initialConversationId) void load(props.initialConversationId);
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    onMessagesChange?.(messages.filter((m) => m.role === 'user' && m.persisted).length);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, onMessagesChange]);

  const patch = (id: string, change: Partial<ChatMessage>) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...change } : m)));

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setInput('');
    const userLocal = tempId();
    const botLocal = tempId();
    let userId = userLocal;
    let botId = botLocal;
    let createdConversation: string | null = null;
    setMessages((list) => [
      ...list,
      { id: userLocal, role: 'user', content: clean, status: 'done', persisted: false },
      { id: botLocal, role: 'assistant', content: '', status: 'streaming', persisted: false },
    ]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(
        {
          conversationId: conversationId ?? undefined,
          message: clean,
          mode: props.mode,
          level: props.level,
          topic: props.topic || undefined,
          scenarioId: props.scenario?.id,
          autoCorrect: props.autoCorrect,
          explanationLanguage: props.explanationLanguage,
        },
        {
          onMeta: (meta) => {
            if (!conversationId) {
              createdConversation = meta.conversationId;
              setConversationId(meta.conversationId);
            }
            userId = meta.userMessageId;
            patch(userLocal, { id: meta.userMessageId, persisted: true });
          },
          onDelta: (delta) => {
            // Capture the id now: React may run this updater after `onDone` reassigns botId.
            const target = botId;
            setMessages((list) => list.map((m) => (m.id === target ? { ...m, content: m.content + delta } : m)));
          },
          onCorrection: ({ messageId, correction }) => patch(messageId, { correction }),
          onDone: ({ assistantMessageId }) => {
            if (assistantMessageId) {
              patch(botId, { id: assistantMessageId, status: 'done', persisted: true });
              botId = assistantMessageId;
            } else patch(botId, { status: 'done' });
          },
        },
        controller.signal,
      );
      setMessages((list) => list.map((m) => (m.id === botId && m.status === 'streaming' ? { ...m, status: 'done' } : m)));
    } catch (error) {
      const aborted = controller.signal.aborted;
      const message = aborted ? 'Đã dừng.' : errorMessage(error);
      // Without a `meta` event the server never stored the user's message.
      const beforeSave = userId === userLocal;
      setMessages((list) =>
        list.flatMap((m) => {
          if (m.id === botId) {
            if (aborted && m.content) return [{ ...m, status: 'done' as const }];
            return beforeSave ? [] : [{ ...m, status: 'error' as const, error: message, content: m.content }];
          }
          if (m.id === userId && beforeSave) return [{ ...m, status: 'error' as const, error: message }];
          return [m];
        }),
      );
    } finally {
      setSending(false);
      abortRef.current = null;
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: ['app-config'] });
      if (createdConversation) props.onConversationCreated?.(createdConversation);
    }
  };

  /** Retry: remove the failed exchange (also from the database) and send the text again. */
  const retry = async (failed: ChatMessage) => {
    const index = messages.findIndex((m) => m.id === failed.id);
    const userMessage = failed.role === 'user' ? failed : [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
    if (!userMessage) return;
    const toRemove = messages.slice(messages.indexOf(userMessage), index + 1);
    await deleteMessages(toRemove.filter((m) => m.persisted).map((m) => m.id)).catch(() => {});
    setMessages((list) => list.filter((m) => !toRemove.includes(m)));
    await send(userMessage.content);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  };

  const showOpening = props.scenario && messages.length === 0 && !loading;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4" aria-live="polite" aria-busy={sending}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="ml-auto h-12 w-2/3" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => conversationId && void load(conversationId)} />
        ) : (
          <>
            {showOpening && (
              <MessageBubble
                message={{ id: 'opening', role: 'assistant', content: props.scenario!.opening, status: 'done', persisted: false }}
                level={props.level}
                explanationLanguage={props.explanationLanguage}
                aiEnabled={false}
              />
            )}
            {messages.length === 0 && !props.scenario && (props.emptyState ?? null)}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                level={props.level}
                explanationLanguage={props.explanationLanguage}
                aiEnabled={props.aiEnabled}
                onRetry={m.status === 'error' ? () => void retry(m) : undefined}
              />
            ))}
          </>
        )}
      </div>

      {messages.length === 0 && props.starters && props.starters.length > 0 && !loading && (
        <div className="flex flex-wrap gap-2 pb-3">
          {props.starters.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!props.aiEnabled || sending}
              onClick={() => void send(s)}
              className="rounded-full border border-border-strong bg-surface px-3 py-1.5 text-sm text-fg-2 hover:bg-surface-2 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p id="chat-input-hint" className="sr-only">
        Nhấn Enter để gửi, Shift và Enter để xuống dòng.
      </p>
      <form
        className="flex items-end gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Tin nhắn
        </label>
        <Textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          disabled={!props.aiEnabled}
          placeholder={props.aiEnabled ? 'Nhập tin nhắn bằng tiếng Anh…' : 'Tính năng AI chưa được bật'}
          aria-describedby="chat-input-hint"
          className="max-h-40 min-h-11 resize-none"
        />
        {sending ? (
          <Button type="button" variant="outline" size="icon" onClick={() => abortRef.current?.abort()} aria-label="Dừng">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim() || !props.aiEnabled} aria-label="Gửi">
            <SendHorizontal className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
