// Answer checking for self-graded exercises (grammar, dictation).

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?;:"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAcceptedAnswer(input: string, accepted: string[]): boolean {
  const value = normalizeAnswer(input);
  return value.length > 0 && accepted.some((a) => normalizeAnswer(a) === value);
}

export type ExerciseRow = {
  id: string;
  lesson_id: string | null;
  type: 'multiple_choice' | 'fill_blank' | 'reorder' | 'error_correction' | 'comprehension' | 'dictation' | 'placement';
  level: string | null;
  prompt: string;
  data: { options?: string[]; tokens?: string[] };
  answer: { index?: number; accepted?: string[]; sentence?: string };
  explanation_vi: string | null;
  explanation_en: string | null;
  sort_order: number;
};

export type ExerciseResponse = { index?: number; text?: string; order?: string[] };

export function gradeExercise(exercise: ExerciseRow, response: ExerciseResponse): boolean {
  switch (exercise.type) {
    case 'multiple_choice':
    case 'comprehension':
    case 'placement':
      return response.index !== undefined && response.index === exercise.answer.index;
    case 'fill_blank':
    case 'error_correction':
    case 'dictation':
      return isAcceptedAnswer(response.text ?? '', exercise.answer.accepted ?? []);
    case 'reorder':
      return normalizeAnswer((response.order ?? []).join(' ')) === normalizeAnswer(exercise.answer.sentence ?? '');
  }
}

export function correctAnswerText(exercise: ExerciseRow): string {
  if (exercise.answer.index !== undefined) return exercise.data.options?.[exercise.answer.index] ?? '';
  if (exercise.answer.sentence) {
    const s = exercise.answer.sentence;
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }
  return exercise.answer.accepted?.[0] ?? '';
}
