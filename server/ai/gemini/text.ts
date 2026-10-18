import { ProviderError } from '../../errors';
import { parseSseJson } from '../../lib/sse';
import type { ChatTurn, OutputSchema, TextChatProvider, TextRequest } from '../types';
import { extractText, geminiPost, isBlockedFinish, type GeminiResponse } from './client';

type Content = { role: 'user' | 'model'; parts: { text: string }[] };

/** Map chat turns to Gemini contents: roles user/model, alternating, starting with a user turn. */
export function toContents(history: ChatTurn[]): Content[] {
  const contents: Content[] = [];
  for (const turn of history) {
    const role = turn.role === 'assistant' ? 'model' : 'user';
    const text = turn.text.trim();
    if (!text) continue;
    const last = contents.at(-1);
    if (last && last.role === role) {
      last.parts[0].text += `\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }
  if (contents[0]?.role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: '(The learner has joined. Begin.)' }] });
  }
  return contents;
}

export class GeminiTextChatProvider implements TextChatProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly apiKey: string;
  private readonly thinkingLevel: string | null;

  constructor(options: { apiKey: string; model: string; thinkingLevel?: string | null }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.thinkingLevel = options.thinkingLevel ?? null;
  }

  private body(request: TextRequest) {
    return {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: toContents(request.history),
      generationConfig: {
        maxOutputTokens: request.maxOutputTokens ?? 1024,
        ...(this.thinkingLevel ? { thinkingConfig: { thinkingLevel: this.thinkingLevel } } : {}),
      },
    };
  }

  async *streamChat(request: TextRequest): AsyncGenerator<string, void, void> {
    const response = await geminiPost(
      this.apiKey,
      `models/${this.model}:streamGenerateContent?alt=sse`,
      this.body(request),
      { signal: request.signal },
    );
    if (!response.body) throw new ProviderError('unavailable', 'empty stream');
    let produced = false;
    for await (const event of parseSseJson(response.body)) {
      const { text, finishReason } = extractText(event as GeminiResponse);
      if (text) {
        produced = true;
        yield text;
      }
      if (!produced && isBlockedFinish(finishReason)) {
        throw new ProviderError('blocked', `finish ${finishReason}`);
      }
    }
    if (!produced) throw new ProviderError('invalid_output', 'empty response');
  }

  async complete(request: TextRequest): Promise<string> {
    const response = await geminiPost(this.apiKey, `models/${this.model}:generateContent`, this.body(request), {
      signal: request.signal,
    });
    const { text, finishReason } = extractText((await response.json()) as GeminiResponse);
    if (!text) {
      throw new ProviderError(isBlockedFinish(finishReason) ? 'blocked' : 'invalid_output', `finish ${finishReason}`);
    }
    return text;
  }

  async generateJson(request: { system: string; prompt: string; schema: OutputSchema; maxOutputTokens?: number }) {
    const response = await geminiPost(this.apiKey, `models/${this.model}:generateContent`, {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: request.schema,
        maxOutputTokens: request.maxOutputTokens ?? 2048,
        ...(this.thinkingLevel ? { thinkingConfig: { thinkingLevel: this.thinkingLevel } } : {}),
      },
    });
    const { text, finishReason } = extractText((await response.json()) as GeminiResponse);
    if (!text) {
      throw new ProviderError(isBlockedFinish(finishReason) ? 'blocked' : 'invalid_output', `finish ${finishReason}`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ProviderError('invalid_output', `non-JSON output (finish ${finishReason})`);
    }
  }
}
