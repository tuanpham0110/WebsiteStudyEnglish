import type { AppConfig } from '../env';
import { GeminiRealtimeVoiceProvider } from './gemini/live';
import { GeminiSpeechToTextProvider } from './gemini/stt';
import { GeminiTextChatProvider } from './gemini/text';
import type { Providers } from './types';

/** Build providers from config. Anything not configured or not enabled is null. */
export function createProviders(config: AppConfig): Providers {
  const gemini = config.gemini;
  if (!gemini) return { text: null, live: null, stt: null };
  return {
    text: config.aiTextEnabled
      ? new GeminiTextChatProvider({ apiKey: gemini.apiKey, model: gemini.textModel, thinkingLevel: gemini.thinkingLevel })
      : null,
    live: config.aiVoiceEnabled
      ? new GeminiRealtimeVoiceProvider({ apiKey: gemini.apiKey, model: gemini.liveModel, apiVersion: gemini.liveApiVersion })
      : null,
    stt: config.aiTextEnabled ? new GeminiSpeechToTextProvider({ apiKey: gemini.apiKey, model: gemini.textModel }) : null,
  };
}
