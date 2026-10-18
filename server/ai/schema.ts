import type { OutputSchema } from './types';

// Small builders for structured-output schemas (Gemini responseSchema / OpenAPI subset).
export const S = {
  str: (description?: string): OutputSchema => ({ type: 'STRING', ...(description ? { description } : {}) }),
  int: (minimum?: number, maximum?: number): OutputSchema => ({ type: 'INTEGER', minimum, maximum }),
  bool: (): OutputSchema => ({ type: 'BOOLEAN' }),
  enum: (values: string[]): OutputSchema => ({ type: 'STRING', enum: values }),
  arr: (items: OutputSchema, maxItems?: number): OutputSchema => ({ type: 'ARRAY', items, ...(maxItems ? { maxItems } : {}) }),
  obj: (properties: Record<string, OutputSchema>, optional: string[] = []): OutputSchema => {
    const keys = Object.keys(properties);
    return {
      type: 'OBJECT',
      properties,
      required: keys.filter((k) => !optional.includes(k)),
      propertyOrdering: keys,
    };
  },
};

export const correctionOutput = S.obj({
  hasErrors: S.bool(),
  original: S.str(),
  corrected: S.str(),
  explanation: S.str(),
  example: S.str(),
});

export const translateOutput = S.obj({ translation: S.str() });

export const explainVocabOutput = S.obj({
  items: S.arr(
    S.obj({
      word: S.str(),
      partOfSpeech: S.str(),
      ipa: S.str(),
      meaningVi: S.str(),
      definitionEn: S.str(),
      example: S.str(),
    }),
    5,
  ),
});

export const rewriteOutput = S.obj({
  natural: S.str(),
  alternatives: S.arr(S.str(), 2),
  explanation: S.str(),
});

export const writingOutput = S.obj({
  correctedText: S.str(),
  overallFeedback: S.str(),
  coherence: S.obj({ rating: S.int(1, 5), comment: S.str() }),
  changes: S.arr(
    S.obj({
      original: S.str(),
      revised: S.str(),
      type: S.enum(['grammar', 'vocabulary', 'style', 'coherence', 'spelling', 'punctuation']),
      reason: S.str(),
    }),
    40,
  ),
  vocabularySuggestions: S.arr(S.obj({ original: S.str(), suggestion: S.str(), reason: S.str() }), 15),
  strengths: S.arr(S.str(), 6),
});

export const sessionReportOutput = S.obj({
  summary: S.str(),
  strengths: S.arr(S.str(), 8),
  goodSentences: S.arr(S.str(), 8),
  grammarIssues: S.arr(S.obj({ original: S.str(), corrected: S.str(), explanation: S.str() }), 12),
  newVocabulary: S.arr(S.obj({ word: S.str(), meaningVi: S.str(), example: S.str() }), 12),
  naturalAlternatives: S.arr(S.obj({ original: S.str(), better: S.str() }), 8),
  nextGoals: S.arr(S.str(), 6),
});
