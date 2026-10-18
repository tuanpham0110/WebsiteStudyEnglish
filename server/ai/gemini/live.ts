import { ProviderError } from '../../errors';
import type { RealtimeSessionGrant, RealtimeVoiceProvider } from '../types';
import { GEMINI_HOST, geminiPost } from './client';

/**
 * Gemini Live API (bidirectional WebSocket, audio in / audio out).
 *
 * The server mints a single-use ephemeral token (POST /{version}/auth_tokens) with the
 * full session setup embedded as `bidiGenerateContentSetup` and no `fieldMask`; per the
 * API reference the setup then comes entirely from the token, so the browser cannot
 * change the model, system prompt or voice. The browser connects directly to
 * BidiGenerateContentConstrained with `?access_token=` — audio never passes through
 * our server. Docs: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
 */
export class GeminiRealtimeVoiceProvider implements RealtimeVoiceProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly apiKey: string;
  private readonly apiVersion: string;

  constructor(options: { apiKey: string; model: string; apiVersion: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.apiVersion = options.apiVersion;
  }

  buildSetup(systemInstruction: string, voice: string) {
    return {
      model: `models/${this.model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      systemInstruction: { parts: [{ text: systemInstruction }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };
  }

  async createSession(request: { systemInstruction: string; voice: string; maxSeconds: number }): Promise<RealtimeSessionGrant> {
    const now = Date.now();
    // Messages are rejected after expireTime, which hard-caps the session length server-side.
    const expiresAt = new Date(now + (request.maxSeconds + 20) * 1000).toISOString();
    const setup = this.buildSetup(request.systemInstruction, request.voice);

    const response = await geminiPost(
      this.apiKey,
      'auth_tokens',
      {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        bidiGenerateContentSetup: setup,
      },
      { apiVersion: this.apiVersion },
    );
    const json = (await response.json()) as { name?: string };
    if (!json.name || !json.name.startsWith('auth_tokens/')) {
      throw new ProviderError('invalid_output', 'auth token response without name');
    }

    return {
      token: json.name,
      wsUrl: `wss://${GEMINI_HOST}/ws/google.ai.generativelanguage.${this.apiVersion}.GenerativeService.BidiGenerateContentConstrained`,
      setup,
      expiresAt,
      inputSampleRate: 16000,
      outputSampleRate: 24000,
    };
  }
}
