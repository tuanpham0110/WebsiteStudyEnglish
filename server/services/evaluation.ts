import type { z } from 'zod';
import type { AssistTask, ExplanationLanguage, Level, WritingType } from '../../shared/constants';
import {
  correctionSchema,
  explainVocabResultSchema,
  rewriteResultSchema,
  sessionReportSchema,
  translateResultSchema,
  writingFeedbackSchema,
  type AssistResult,
  type Correction,
  type SessionReport,
  type TranscriptLine,
  type WritingFeedback,
} from '../../shared/schemas';
import { ProviderError } from '../errors';
import {
  assistPrompt,
  correctionPrompt,
  PRONUNCIATION_NOTE_VI,
  sessionReportPrompt,
  writingPrompt,
} from '../ai/prompts';
import {
  correctionOutput,
  explainVocabOutput,
  rewriteOutput,
  sessionReportOutput,
  translateOutput,
  writingOutput,
} from '../ai/schema';
import type { OutputSchema, TextChatProvider } from '../ai/types';

/** All language evaluation goes through here (chat corrections, writing, session reports). */
export class EnglishEvaluationService {
  constructor(private readonly text: TextChatProvider) {}

  private async json<T extends z.ZodType>(system: string, prompt: string, schema: OutputSchema, validator: T, maxOutputTokens?: number) {
    const raw = await this.text.generateJson({ system, prompt, schema, maxOutputTokens });
    const parsed = validator.safeParse(raw);
    if (!parsed.success) throw new ProviderError('invalid_output', 'schema mismatch');
    return parsed.data as z.infer<T>;
  }

  async correctMessage(message: string, level: Level, language: ExplanationLanguage): Promise<Correction> {
    const result = await this.json(
      correctionPrompt(level, language),
      `Learner message:\n"""${message}"""`,
      correctionOutput,
      correctionSchema,
      700,
    );
    // Treat "corrections" identical to the original as no error.
    if (result.hasErrors && normalize(result.corrected) === normalize(message)) {
      return { ...result, hasErrors: false };
    }
    return { ...result, original: message };
  }

  async assist(task: AssistTask, text: string, level: Level, language: ExplanationLanguage): Promise<AssistResult> {
    const system = assistPrompt(task, level, language);
    const prompt = `Text:\n"""${text}"""`;
    switch (task) {
      case 'translate':
        return { task, result: await this.json(system, prompt, translateOutput, translateResultSchema, 1200) };
      case 'explain_vocab':
        return { task, result: await this.json(system, prompt, explainVocabOutput, explainVocabResultSchema, 1500) };
      case 'rewrite':
        return { task, result: await this.json(system, prompt, rewriteOutput, rewriteResultSchema, 1200) };
      case 'grammar_check':
        return { task, result: await this.correctMessage(text, level, language) };
    }
  }

  async evaluateWriting(input: {
    text: string;
    type: WritingType;
    prompt?: string;
    level: Level;
    language: ExplanationLanguage;
  }): Promise<WritingFeedback> {
    const task = input.prompt ? `Writing task given to the learner: ${input.prompt}\n\n` : '';
    return this.json(
      writingPrompt(input.level, input.type, input.language),
      `${task}Learner's ${input.type}:\n"""${input.text}"""`,
      writingOutput,
      writingFeedbackSchema,
      4096,
    );
  }

  async sessionReport(input: {
    lines: TranscriptLine[];
    level: Level;
    language: ExplanationLanguage;
    source: 'speech' | 'chat';
  }): Promise<SessionReport> {
    const transcript = input.lines
      .slice(-120)
      .map((line) => `${line.role === 'user' ? 'LEARNER' : 'PARTNER'}: ${line.text}`)
      .join('\n');
    const report = await this.json(
      sessionReportPrompt(input.level, input.language, input.source),
      `Transcript:\n${transcript}`,
      sessionReportOutput,
      sessionReportSchema,
      3000,
    );
    return {
      ...report,
      pronunciationNote: PRONUNCIATION_NOTE_VI,
      generatedAt: new Date().toISOString(),
      basedOnTurns: input.lines.filter((l) => l.role === 'user').length,
    };
  }
}

function normalize(text: string) {
  return text.trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').toLowerCase();
}
