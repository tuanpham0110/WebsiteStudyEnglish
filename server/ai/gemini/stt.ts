import { ProviderError } from '../../errors';
import type { SpeechToTextProvider } from '../types';
import { extractText, geminiPost, type GeminiResponse } from './client';

/** Transcription via a multimodal Gemini text model (audio input → text). */
export class GeminiSpeechToTextProvider implements SpeechToTextProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly apiKey: string;

  constructor(options: { apiKey: string; model: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
  }

  async transcribe(request: { audioBase64: string; mimeType: 'audio/wav' }): Promise<string> {
    const response = await geminiPost(this.apiKey, `models/${this.model}:generateContent`, {
      systemInstruction: {
        parts: [
          {
            text:
              'You are a speech recognizer. Transcribe the English speech verbatim, exactly as spoken, ' +
              'including mistakes and repeated words. Do not correct grammar. Do not add punctuation beyond basic sentence marks. ' +
              'If there is no intelligible speech, return an empty transcript.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: request.mimeType, data: request.audioBase64 } }, { text: 'Transcribe this audio.' }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: { transcript: { type: 'STRING' } }, required: ['transcript'] },
        maxOutputTokens: 512,
      },
    });
    const { text } = extractText((await response.json()) as GeminiResponse);
    try {
      const parsed = JSON.parse(text) as { transcript?: unknown };
      return typeof parsed.transcript === 'string' ? parsed.transcript.trim() : '';
    } catch {
      throw new ProviderError('invalid_output', 'stt non-JSON output');
    }
  }
}
