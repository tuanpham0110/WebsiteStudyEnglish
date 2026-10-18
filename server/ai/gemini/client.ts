import { ProviderError } from '../../errors';

// Gemini Developer API (Google AI Studio keys). Endpoints and payload shapes follow
// https://ai.google.dev/api/generate-content and https://ai.google.dev/api/live
export const GEMINI_HOST = 'generativelanguage.googleapis.com';
const BASE_URL = `https://${GEMINI_HOST}`;

export type GeminiPart = {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
};

export type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[]; role?: string }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

const BLOCKED_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);

export async function geminiPost(
  apiKey: string,
  path: string,
  body: unknown,
  options: { apiVersion?: string; signal?: AbortSignal } = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${options.apiVersion ?? 'v1beta'}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ProviderError('unavailable', `network: ${(error as Error).message}`);
  }
  if (!response.ok) throw await providerErrorFrom(response);
  return response;
}

async function providerErrorFrom(response: Response): Promise<ProviderError> {
  let detail = '';
  try {
    const json = (await response.json()) as { error?: { status?: string; message?: string } };
    detail = `${json.error?.status ?? ''} ${json.error?.message ?? ''}`.trim();
  } catch {
    /* body was not JSON */
  }
  const status = response.status;
  const message = `gemini ${status} ${detail}`.slice(0, 300);
  if (status === 429) return new ProviderError('quota', message, status);
  if (status === 401 || status === 403) return new ProviderError('auth', message, status);
  if (status === 400 || status === 404) return new ProviderError('bad_request', message, status);
  return new ProviderError('unavailable', message, status);
}

/** Visible text of the first candidate (thought parts are skipped). Throws if the prompt was blocked. */
export function extractText(chunk: GeminiResponse): { text: string; finishReason?: string } {
  if (chunk.promptFeedback?.blockReason) {
    throw new ProviderError('blocked', `prompt blocked: ${chunk.promptFeedback.blockReason}`);
  }
  const candidate = chunk.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  return { text, finishReason: candidate?.finishReason };
}

export function isBlockedFinish(reason: string | undefined) {
  return reason !== undefined && BLOCKED_FINISH.has(reason);
}
