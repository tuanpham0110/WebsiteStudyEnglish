import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Undo2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Progress } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { correctAnswerText, gradeExercise, type ExerciseResponse, type ExerciseRow } from '@/lib/answers';

export type ExerciseResult = { exercise: ExerciseRow; response: ExerciseResponse; correct: boolean };

const TYPE_LABEL: Record<ExerciseRow['type'], string> = {
  multiple_choice: 'Trắc nghiệm',
  comprehension: 'Câu hỏi hiểu',
  placement: 'Trắc nghiệm',
  fill_blank: 'Điền từ',
  reorder: 'Sắp xếp câu',
  error_correction: 'Sửa lỗi',
  dictation: 'Chính tả',
};

function ReorderInput({ tokens, value, onChange, disabled }: { tokens: string[]; value: number[]; onChange: (v: number[]) => void; disabled: boolean }) {
  return (
    <div>
      <div className="min-h-12 rounded-lg border border-dashed border-border-strong bg-surface-2 p-2" aria-label="Câu của bạn">
        {value.length === 0 ? (
          <span className="px-1 text-sm text-muted">Chọn các từ bên dưới theo đúng thứ tự…</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {value.map((i, pos) => (
              <button
                key={`${i}-${pos}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, p) => p !== pos))}
                className="rounded-md bg-primary px-2.5 py-1 text-sm text-primary-fg"
                aria-label={`Bỏ “${tokens[i]}”`}
              >
                {tokens[i]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tokens.map((t, i) =>
          value.includes(i) ? null : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange([...value, i])}
              className="rounded-md border border-border-strong bg-surface px-2.5 py-1 text-sm hover:bg-surface-2"
            >
              {t}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/** Runs a list of exercises one at a time with instant feedback and explanations. */
export function ExerciseRunner({
  exercises,
  onComplete,
  explanationLanguage = 'vi',
}: {
  exercises: ExerciseRow[];
  onComplete: (results: ExerciseResult[]) => void | Promise<void>;
  explanationLanguage?: 'vi' | 'en';
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState<ExerciseResult | null>(null);
  const [finished, setFinished] = useState(false);

  const exercise = exercises[index];
  const shuffledTokens = useMemo(() => exercise?.data.tokens ?? [], [exercise]);

  if (exercises.length === 0) return <p className="text-sm text-muted">Bài học này chưa có bài tập.</p>;

  if (finished) {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="text-center">
        <p className="text-4xl font-semibold">
          {correct}/{results.length}
        </p>
        <p className="mt-1 text-sm text-muted">câu trả lời đúng</p>
        <ul className="mx-auto mt-6 max-w-lg space-y-2 text-left">
          {results.map((r) => (
            <li key={r.exercise.id} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              {r.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Đúng" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Sai" />}
              <div>
                <p>{r.exercise.type === 'reorder' ? correctAnswerText(r.exercise) : r.exercise.prompt}</p>
                {!r.correct && <p className="mt-0.5 text-success">Đáp án: {correctAnswerText(r.exercise)}</p>}
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setIndex(0);
            setResults([]);
            setFinished(false);
            setChecked(null);
            setChoice(null);
            setText('');
            setOrder([]);
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Làm lại
        </Button>
      </div>
    );
  }

  const response: ExerciseResponse =
    exercise.type === 'reorder' ? { order: order.map((i) => shuffledTokens[i]) } : exercise.data.options ? { index: choice ?? undefined } : { text };
  const canCheck = exercise.type === 'reorder' ? order.length === shuffledTokens.length : exercise.data.options ? choice !== null : text.trim().length > 0;

  const check = () => {
    const result = { exercise, response, correct: gradeExercise(exercise, response) };
    setChecked(result);
    setResults((r) => [...r, result]);
  };

  const next = async () => {
    setChecked(null);
    setChoice(null);
    setText('');
    setOrder([]);
    if (index + 1 >= exercises.length) {
      setFinished(true);
      await onComplete(results);
    } else setIndex(index + 1);
  };

  const explanation = explanationLanguage === 'en' ? exercise.explanation_en ?? exercise.explanation_vi : exercise.explanation_vi ?? exercise.explanation_en;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-medium text-primary">{TYPE_LABEL[exercise.type]}</span>
        <span className="tabular text-muted">
          {index + 1}/{exercises.length}
        </span>
      </div>
      <Progress value={index} max={exercises.length} label="Tiến độ bài tập" className="mb-5" />

      {exercise.type !== 'reorder' && <p className="mb-4 text-lg font-medium">{exercise.prompt}</p>}
      {exercise.type === 'error_correction' && <p className="-mt-2 mb-3 text-sm text-muted">Câu trên có lỗi. Hãy viết lại câu đúng.</p>}

      {exercise.data.options ? (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Các lựa chọn">
          {exercise.data.options.map((option, i) => {
            const isAnswer = checked && i === exercise.answer.index;
            const isWrongPick = checked && i === choice && !checked.correct;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={choice === i}
                disabled={Boolean(checked)}
                onClick={() => setChoice(i)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  isAnswer ? 'border-success bg-success-soft' : isWrongPick ? 'border-danger bg-danger-soft' : choice === i ? 'border-primary bg-primary-soft' : 'border-border-strong hover:bg-surface-2',
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : exercise.type === 'reorder' ? (
        <>
          <p className="mb-3 text-sm text-muted">{exercise.prompt}</p>
          <ReorderInput tokens={shuffledTokens} value={order} onChange={setOrder} disabled={Boolean(checked)} />
          {order.length > 0 && !checked && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOrder([])}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden /> Xóa
            </Button>
          )}
        </>
      ) : (
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={Boolean(checked)}
          aria-label="Câu trả lời"
          placeholder={exercise.type === 'fill_blank' ? 'Từ cần điền…' : 'Viết lại câu đúng…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCheck && !checked) check();
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      )}

      {checked && (
        <div className={cn('mt-4 animate-fade-in rounded-lg p-4 text-sm', checked.correct ? 'bg-success-soft' : 'bg-danger-soft')} role="status">
          <p className={cn('flex items-center gap-1.5 font-semibold', checked.correct ? 'text-success' : 'text-danger')}>
            {checked.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
            {checked.correct ? 'Chính xác!' : 'Chưa đúng'}
          </p>
          {!checked.correct && <p className="mt-1 text-fg">Đáp án: {correctAnswerText(exercise)}</p>}
          {explanation && <p className="mt-1 text-fg-2">{explanation}</p>}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        {checked ? (
          <Button onClick={() => void next()}>{index + 1 >= exercises.length ? 'Xem kết quả' : 'Câu tiếp theo'}</Button>
        ) : (
          <Button onClick={check} disabled={!canCheck}>
            Kiểm tra
          </Button>
        )}
      </div>
    </div>
  );
}
