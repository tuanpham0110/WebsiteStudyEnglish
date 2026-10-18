import type { ChatStreamRequest, Correction } from '@shared/schemas';
import { env } from './env';
import { readSse } from './sse';
import { supabase } from './supabase';

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') return 'Đã hủy yêu cầu.';
  if (error instanceof TypeError) return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
  if (error instanceof Error && error.message) return error.message;
  return 'Đã có lỗi xảy ra.';
}

async function authHeader(): Promise<Record<string, string>> {
  const session = (await supabase?.auth.getSession())?.data.session;
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function toError(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    if (body.error?.message) {
      return new ApiRequestError(body.error.code ?? 'INTERNAL', body.error.message, response.status, body.error.details);
    }
  } catch {
    /* not JSON */
  }
  if (response.status === 404) return new ApiRequestError('NOT_FOUND', 'Không tìm thấy API. Máy chủ chưa được triển khai?', 404);
  return new ApiRequestError('INTERNAL', `Máy chủ trả về lỗi ${response.status}.`, response.status);
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(`${env.apiBase}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(await authHeader()) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type ChatStreamHandlers = {
  onMeta?: (meta: { conversationId: string; userMessageId: string }) => void;
  onDelta?: (text: string) => void;
  onCorrection?: (payload: { messageId: string; correction: Correction }) => void;
  onDone?: (payload: { assistantMessageId: string | null }) => void;
};

/** POST /api/chat/stream and dispatch SSE events. Rejects with ApiRequestError on failure. */
export async function streamChat(body: ChatStreamRequest, handlers: ChatStreamHandlers, signal?: AbortSignal) {
  const response = await fetch(`${env.apiBase}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(await authHeader()) },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) throw await toError(response);
  let streamError: ApiRequestError | null = null;
  for await (const { event, data } of readSse(response.body)) {
    const payload = JSON.parse(data);
    if (event === 'meta') handlers.onMeta?.(payload);
    else if (event === 'delta') handlers.onDelta?.(payload.text);
    else if (event === 'correction') handlers.onCorrection?.(payload);
    else if (event === 'done') handlers.onDone?.(payload);
    else if (event === 'error') streamError = new ApiRequestError(payload.code ?? 'PROVIDER_ERROR', payload.message, 502);
  }
  if (streamError) throw streamError;
}
