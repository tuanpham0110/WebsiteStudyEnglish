import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  DAILY_MINUTE_OPTIONS,
  GOAL_INFO,
  GOALS,
  LEVEL_INFO,
  LEVELS,
  SKILL_INFO,
  SKILLS,
  type ExplanationLanguage,
  type Goal,
  type Level,
  type Skill,
} from '@shared/constants';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';
import { ChoiceChip } from '@/components/ui/form';
import { Alert, ErrorState, Progress, Skeleton } from '@/components/ui/feedback';
import { db, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/cn';
import { browserTimezone } from '@/lib/format';
import { buildPlan, estimateLevel } from '@/lib/recommendations';
import type { ExerciseRow } from '@/lib/answers';
import { useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/lib/api';

type Step = 'level' | 'goals' | 'time' | 'language' | 'skills' | 'test' | 'result';
const STEPS: Step[] = ['level', 'goals', 'time', 'language', 'skills', 'test', 'result'];

function StepTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

function PlacementTest({ onDone, onSkip }: { onDone: (r: { level: Level; correct: boolean; id: string; index: number }[]) => void; onSkip: () => void }) {
  const questions = useQuery({
    queryKey: ['placement-questions'],
    queryFn: async () =>
      unwrap(await db().from('exercises').select('id, level, prompt, data, answer, type, lesson_id, explanation_vi, explanation_en, sort_order').eq('type', 'placement').order('sort_order')) as ExerciseRow[],
  });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<{ level: Level; correct: boolean; id: string; index: number }[]>([]);

  if (questions.isLoading) return <Skeleton className="h-56 w-full" />;
  if (questions.isError) return <ErrorState message={errorMessage(questions.error)} onRetry={() => void questions.refetch()} />;
  const list = questions.data ?? [];
  if (list.length === 0) {
    return (
      <Alert tone="warning" title="Chưa có câu hỏi kiểm tra" action={<Button onClick={onSkip}>Bỏ qua</Button>}>
        Cơ sở dữ liệu chưa có dữ liệu mẫu (seed). Bạn vẫn có thể tiếp tục với trình độ tự chọn.
      </Alert>
    );
  }
  const q = list[index];
  const choose = (choice: number) => {
    const next = [...answers, { level: q.level as Level, correct: choice === q.answer.index, id: q.id, index: choice }];
    setAnswers(next);
    if (index + 1 >= list.length) onDone(next);
    else setIndex(index + 1);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span className="tabular">
          Câu {index + 1}/{list.length}
        </span>
        <button type="button" onClick={onSkip} className="text-primary hover:underline">
          Bỏ qua bài kiểm tra
        </button>
      </div>
      <Progress value={index} max={list.length} label="Tiến độ bài kiểm tra" className="mb-6" />
      <p className="mb-4 text-lg font-medium">{q.prompt}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(q.data.options ?? []).map((option, i) => (
          <button
            key={option}
            type="button"
            onClick={() => choose(i)}
            className="rounded-lg border border-border-strong bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary-soft"
          >
            {option}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">Không chắc? Hãy chọn đáp án bạn nghĩ là đúng nhất — đừng đoán bừa để kết quả sát hơn.</p>
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('level');
  const [level, setLevel] = useState<Level>('A2');
  const [goals, setGoals] = useState<Goal[]>(['communication']);
  const [minutes, setMinutes] = useState(15);
  const [language, setLanguage] = useState<ExplanationLanguage>('vi');
  const [skills, setSkills] = useState<Skill[]>(['speaking', 'vocabulary']);
  const [placement, setPlacement] = useState<{ level: Level; score: number; answers: { level: Level; correct: boolean; id: string; index: number }[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const finalLevel = placement?.level ?? level;
  const plan = useMemo(() => buildPlan({ level: finalLevel, goals, dailyMinutes: minutes, focusSkills: skills }), [finalLevel, goals, minutes, skills]);
  const stepIndex = STEPS.indexOf(step);
  const go = (delta: number) => setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, stepIndex + delta))]);
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const finish = async (chosenLevel: Level) => {
    if (!user) return;
    setSaving(true);
    try {
      const client = db();
      unwrap(
        await client
          .from('learning_preferences')
          .update({
            goals,
            daily_minutes: minutes,
            explanation_language: language,
            focus_skills: skills,
            placement_level: placement?.level ?? null,
            placement_score: placement?.score ?? null,
          })
          .eq('user_id', user.id),
      );
      unwrap(await client.from('user_settings').update({ timezone: browserTimezone() }).eq('user_id', user.id));
      unwrap(await client.from('learning_plans').update({ is_active: false }).eq('user_id', user.id));
      unwrap(
        await client.from('learning_plans').insert({
          user_id: user.id,
          level: chosenLevel,
          title: `Kế hoạch ${minutes} phút/ngày — ${chosenLevel}`,
          items: buildPlan({ level: chosenLevel, goals, dailyMinutes: minutes, focusSkills: skills }),
          is_active: true,
        }),
      );
      if (placement) {
        unwrap(
          await client.from('exercise_attempts').insert(
            placement.answers.map((a) => ({ user_id: user.id, exercise_id: a.id, skill: 'placement', answer: { index: a.index }, is_correct: a.correct })),
          ),
        );
        unwrap(
          await client.from('learning_progress').insert({
            user_id: user.id,
            activity: 'placement',
            score: placement.score,
            items_count: placement.answers.length,
            completed: true,
          }),
        );
      }
      unwrap(await client.from('profiles').update({ level: chosenLevel, onboarded_at: new Date().toISOString() }).eq('id', user.id));
      await qc.invalidateQueries();
      toast.success('Đã tạo kế hoạch học của bạn!');
      navigate('/app', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const [chosen, setChosen] = useState<Level | null>(null);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Logo to="/" />
        <ThemeToggle />
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        <Progress value={stepIndex + 1} max={STEPS.length} label="Tiến độ thiết lập" className="mb-8" />
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          {step === 'level' && (
            <>
              <StepTitle title="Trình độ hiện tại của bạn?" description="Chọn mức gần nhất. Bạn có thể làm bài kiểm tra ngắn ở bước sau." />
              <div className="grid gap-2 sm:grid-cols-2">
                {LEVELS.map((l) => (
                  <ChoiceChip key={l} selected={level === l} onClick={() => setLevel(l)} className="py-3">
                    <span className="font-semibold">{l}</span> · {LEVEL_INFO[l].vi}
                    <span className="block text-xs text-muted">{LEVEL_INFO[l].name}</span>
                  </ChoiceChip>
                ))}
              </div>
            </>
          )}

          {step === 'goals' && (
            <>
              <StepTitle title="Bạn học tiếng Anh để làm gì?" description="Chọn một hoặc nhiều mục tiêu." />
              <div className="grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <ChoiceChip key={g} selected={goals.includes(g)} onClick={() => setGoals(toggle(goals, g))}>
                    {GOAL_INFO[g]}
                  </ChoiceChip>
                ))}
              </div>
            </>
          )}

          {step === 'time' && (
            <>
              <StepTitle title="Mỗi ngày bạn dành bao nhiêu phút?" description="Đều đặn quan trọng hơn học nhiều một lúc." />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {DAILY_MINUTE_OPTIONS.map((m) => (
                  <ChoiceChip key={m} selected={minutes === m} onClick={() => setMinutes(m)} className="text-center">
                    <span className="tabular">{m}</span> phút
                  </ChoiceChip>
                ))}
              </div>
            </>
          )}

          {step === 'language' && (
            <>
              <StepTitle title="AI nên giải thích bằng ngôn ngữ nào?" description="Áp dụng cho phần sửa lỗi và giải thích ngữ pháp." />
              <div className="grid gap-2 sm:grid-cols-2">
                <ChoiceChip selected={language === 'vi'} onClick={() => setLanguage('vi')} className="py-3">
                  Tiếng Việt
                  <span className="block text-xs text-muted">Dễ hiểu, phù hợp khi mới học</span>
                </ChoiceChip>
                <ChoiceChip selected={language === 'en'} onClick={() => setLanguage('en')} className="py-3">
                  English
                  <span className="block text-xs text-muted">Simple English explanations</span>
                </ChoiceChip>
              </div>
            </>
          )}

          {step === 'skills' && (
            <>
              <StepTitle title="Bạn muốn cải thiện kỹ năng nào?" description="Kế hoạch sẽ ưu tiên các kỹ năng này." />
              <div className="grid gap-2 sm:grid-cols-2">
                {SKILLS.map((s) => (
                  <ChoiceChip key={s} selected={skills.includes(s)} onClick={() => setSkills(toggle(skills, s))}>
                    {SKILL_INFO[s]}
                  </ChoiceChip>
                ))}
              </div>
            </>
          )}

          {step === 'test' && (
            <>
              <StepTitle title="Bài kiểm tra đầu vào (tùy chọn)" description="20 câu trắc nghiệm, khoảng 5 phút. Kết quả là ước lượng, không phải chứng chỉ CEFR chính thức." />
              <PlacementTest
                onDone={(answers) => {
                  const est = estimateLevel(answers.map((a) => ({ level: a.level, correct: a.correct })));
                  setPlacement({ ...est, answers });
                  setChosen(est.level);
                  setStep('result');
                }}
                onSkip={() => {
                  setPlacement(null);
                  setChosen(level);
                  setStep('result');
                }}
              />
            </>
          )}

          {step === 'result' && (
            <>
              <StepTitle title="Kế hoạch học của bạn" />
              {placement ? (
                <Alert tone="primary" title={`Trình độ ước lượng: ${placement.level} (${LEVEL_INFO[placement.level].vi})`} className="mb-6">
                  Bạn trả lời đúng {placement.score}% câu hỏi. Đây chỉ là ước lượng để chọn bài phù hợp, không phải chứng chỉ CEFR chính thức.
                </Alert>
              ) : (
                <Alert tone="neutral" className="mb-6">
                  Bạn đã bỏ qua bài kiểm tra. Hệ thống dùng trình độ bạn tự chọn: {level}.
                </Alert>
              )}
              <p className="mb-2 text-sm font-medium">Trình độ dùng để học</p>
              <div className="mb-6 flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <ChoiceChip key={l} selected={(chosen ?? finalLevel) === l} onClick={() => setChosen(l)} className="px-3 py-1.5">
                    {l}
                  </ChoiceChip>
                ))}
              </div>
              <p className="mb-2 text-sm font-medium">Mỗi ngày ({minutes} phút)</p>
              <ul className="space-y-2">
                {plan.map((item) => (
                  <li key={item.title} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted">{item.reason}</p>
                      </div>
                    </div>
                    <span className="tabular shrink-0 text-sm text-muted">{item.minutes} phút</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Kế hoạch được tạo bằng quy tắc cố định dựa trên câu trả lời của bạn (recommendation logic), không phải mô hình AI cá nhân hóa.
              </p>
            </>
          )}

          <div className={cn('mt-8 flex items-center gap-3', stepIndex === 0 ? 'justify-end' : 'justify-between')}>
            {stepIndex > 0 && step !== 'test' && (
              <Button variant="ghost" onClick={() => go(step === 'result' ? -2 : -1)}>
                <ArrowLeft className="h-4 w-4" aria-hidden /> Quay lại
              </Button>
            )}
            {step === 'result' ? (
              <Button onClick={() => void finish(chosen ?? finalLevel)} loading={saving}>
                <ClipboardCheck className="h-4 w-4" aria-hidden /> Bắt đầu học
              </Button>
            ) : step !== 'test' ? (
              <Button onClick={() => go(1)} disabled={(step === 'goals' && goals.length === 0) || (step === 'skills' && skills.length === 0)}>
                Tiếp tục <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
