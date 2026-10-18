// Provider-neutral interfaces. Routes and services depend only on these, so a
// provider (Gemini today) can be swapped without touching business logic.

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

/** OpenAPI-style schema subset understood by structured-output providers. */
export type OutputSchema = {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN';
  description?: string;
  enum?: string[];
  properties?: Record<string, OutputSchema>;
  required?: string[];
  propertyOrdering?: string[];
  items?: OutputSchema;
  minimum?: number;
  maximum?: number;
  maxItems?: number;
};

export type TextRequest = {
  system: string;
  history: ChatTurn[];
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

export interface TextChatProvider {
  readonly name: string;
  readonly model: string;
  /** Streams the assistant reply as text deltas. */
  streamChat(request: TextRequest): AsyncGenerator<string, void, void>;
  /** Returns the full assistant reply. */
  complete(request: TextRequest): Promise<string>;
  /** Returns parsed JSON constrained by `schema` (still validate it — models can drift). */
  generateJson(request: { system: string; prompt: string; schema: OutputSchema; maxOutputTokens?: number }): Promise<unknown>;
}

export type RealtimeSessionGrant = {
  /** Short-lived, single-use credential. Never a long-lived API key. */
  token: string;
  /** Endpoint the browser connects to directly (token is appended by the client). */
  wsUrl: string;
  /** Setup message to send after connecting; the token locks the same config server-side. */
  setup: Record<string, unknown>;
  expiresAt: string;
  inputSampleRate: number;
  outputSampleRate: number;
};

export interface RealtimeVoiceProvider {
  readonly name: string;
  readonly model: string;
  createSession(request: { systemInstruction: string; voice: string; maxSeconds: number }): Promise<RealtimeSessionGrant>;
}

export interface SpeechToTextProvider {
  readonly name: string;
  readonly model: string;
  transcribe(request: { audioBase64: string; mimeType: 'audio/wav' }): Promise<string>;
}

export type Providers = {
  text: TextChatProvider | null;
  live: RealtimeVoiceProvider | null;
  stt: SpeechToTextProvider | null;
};
