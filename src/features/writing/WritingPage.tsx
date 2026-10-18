import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PenLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { LEVELS, type Level, type WritingType } from '@shared/constants';
import type { WritingFeedback } from '@shared/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { Select, Textarea } from '@/components/ui/form';
import { Alert, Badge } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { AiFeatureGate, UsageHint } from '@/components/common/FeatureNotice';
import { CopyButton } from '@/components/common/CopyButton';
import { useAppConfig, useLearnerContext } from '@/hooks/useUserData';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { api, errorMessage } from '@/lib/api';
import { diffWords } from '@/lib/diff';

const PROMPTS: Record<WritingType, string[]> = {
  email: [
    'Write an email to your manager asking for a day off next Friday.',
    'Write an email to a hotel to ask about room prices and breakfast.',
    'Reply to a customer who received a damaged product.',
  ],
  paragraph: ['Describe your favorite place in your city.', 'Write about a skill you learned recently and how you learned it.', 'Describe a typical weekend in your life.'],
  essay: [
    'Some people think students should learn online instead of at school. Do you agree or disagree?',
    'What are the advantages and disadvantages of working from home?',
    'Should cities ban cars from their centres? Give reasons and examples.',
  ],
};

const TYPE_LABEL: Record<WritingType, string> = { email: 'Email', paragraph: 'Đoạn văn', essay: 'Bài luận' };
const CHANGE_LABEL: Record<WritingFeedback['changes'][number]['type'], string> = {
  grammar: 'Ngữ pháp',
  vocabulary: 'Từ vựng',
  style: 'Văn phong',
  coherence: 'Mạch lạc',
  spelling: 'Chính tả',
  punctuation: 'Dấu câu',
};
const DRAFT_KEY = 'englishai.writing-draft';

function readDraft(): { text: string; type: WritingType; prompt: string } | null {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export default function WritingPage() {
  const learner = useLearnerContext();
  const config = useAppConfig();
  const qc = useQueryClient();
  const draft = useMemo(readDraft, []);
  const [type, setType] = useState<WritingType>(draft?.type ?? 'paragraph');
  const [prompt, setPrompt] = useState(draft?.prompt ?? PROMPTS[draft?.type ?? 'paragraph'][0]);
  const [text, setText] = useState(draft?.text ?? '');
  const [level, setLevel] = useState<Level | null>(null);
  const [feedback, setFeedback] = useState<{ original: string; result: WritingFeedback } | null>(null);
  const [loading, setLoading] = useState(false);
  useStudyTimer('writing');

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, type, prompt }));
      } catch {
        /* storage unavailable */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [text, type, prompt]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const effectiveLevel = level ?? learner.level;

  const submit = async () => {
    setLoading(true);
    try {
      const result = await api<WritingFeedback>('/api/writing/evaluate', {
        body: { text, type, prompt: prompt || undefined, level: effectiveLevel, explanationLanguage: learner.explanationLanguage },
      });
      setFeedback({ original: text, result });
      void qc.invalidateQueries({ queryKey: ['app-config'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const diff = feedback ? diffWords(feedback.original, feedback.result.correctedText) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Luyện viết" description="Viết email, đoạn văn hoặc bài luận. AI sửa lỗi, gợi ý từ vựng, nhận xét tính mạch lạc và giải thích từng thay đổi." />
      <AiFeatureGate>{null}</AiFeatureGate>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Tabs
              label="Loại bài viết"
              value={type}
              onChange={(t) => {
                setType(t);
                setPrompt(PROMPTS[t][0]);
              }}
              items={(Object.keys(TYPE_LABEL) as WritingType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
            />
            <div className="w-24">
              <label htmlFor="w-level" className="sr-only">
                Trình độ
              </label>
              <Select id="w-level" value={effectiveLevel} onChange={(e) => setLevel(e.target.value as Level)}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor="w-prompt" className="mb-1.5 block text-sm font-medium text-fg-2">
              Đề bài (tùy chọn)
            </label>
            <Select id="w-prompt" value={PROMPTS[type].includes(prompt) ? prompt : ''} onChange={(e) => setPrompt(e.target.value)}>
              {PROMPTS[type].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="">Tự do — không có đề bài</option>
            </Select>
          </div>
          <div>
            <label htmlFor="w-text" className="mb-1.5 block text-sm font-medium text-fg-2">
              Bài viết của bạn
            </label>
            <Textarea id="w-text" value={text} onChange={(e) => setText(e.target.value)} rows={10} maxLength={6000} placeholder="Viết bằng tiếng Anh…" />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="tabular">
                {words} từ · {text.length}/6000 ký tự
              </span>
              <UsageHint kind="evaluation" />
            </div>
          </div>
          <Button onClick={() => void submit()} loading={loading} disabled={text.trim().length < 20 || !config.data?.features.aiText}>
            <Sparkles className="h-4 w-4" aria-hidden /> Chấm và sửa bài
          </Button>
          {text.trim().length > 0 && text.trim().length < 20 && <p className="text-xs text-muted">Viết ít nhất 20 ký tự để nhận nhận xét.</p>}
        </CardBody>
      </Card>

      {feedback && (
        <div className="animate-fade-in space-y-6">
          <Card>
            <CardHeader title="Nhận xét chung" icon={<PenLine className="h-5 w-5" />} />
            <CardBody className="space-y-4">
              <p className="text-fg-2">{feedback.result.overallFeedback}</p>
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 p-3">
                <span className="text-sm font-medium">Tính mạch lạc</span>
                <span className="tabular text-lg font-semibold">{feedback.result.coherence.rating}/5</span>
                <Badge>Ước lượng của AI, không phải điểm thi chính thức</Badge>
                <p className="w-full text-sm text-fg-2">{feedback.result.coherence.comment}</p>
              </div>
              {feedback.result.strengths.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {feedback.result.strengths.map((s) => (
                    <li key={s} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="So sánh thay đổi" description="Đỏ gạch: bỏ đi · Xanh: thêm vào" />
              <CardBody className="leading-relaxed whitespace-pre-wrap">
                {diff.map((part, i) =>
                  part.type === 'same' ? (
                    <span key={i}>{part.text}</span>
                  ) : part.type === 'removed' ? (
                    <del key={i} className="rounded bg-danger-soft text-danger decoration-danger/70">
                      {part.text}
                    </del>
                  ) : (
                    <ins key={i} className="rounded bg-success-soft text-success no-underline">
                      {part.text}
                    </ins>
                  ),
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Bản đã chỉnh sửa" action={<CopyButton text={feedback.result.correctedText} />} />
              <CardBody className="leading-relaxed whitespace-pre-wrap text-fg">{feedback.result.correctedText}</CardBody>
            </Card>
          </div>

          {feedback.result.changes.length > 0 && (
            <Card>
              <CardHeader title={`Giải thích ${feedback.result.changes.length} thay đổi`} />
              <CardBody>
                <ul className="divide-y divide-border">
                  {feedback.result.changes.map((c, i) => (
                    <li key={i} className="py-3 text-sm first:pt-0 last:pb-0">
                      <Badge tone="primary" className="mb-1">
                        {CHANGE_LABEL[c.type]}
                      </Badge>
                      <p>
                        <span className="text-danger line-through decoration-danger/60">{c.original}</span> → <span className="font-medium text-success">{c.revised}</span>
                      </p>
                      <p className="mt-0.5 text-fg-2">{c.reason}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {feedback.result.vocabularySuggestions.length > 0 && (
            <Card>
              <CardHeader title="Gợi ý nâng cấp từ vựng" />
              <CardBody>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {feedback.result.vocabularySuggestions.map((v, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <p>
                        {v.original} → <strong>{v.suggestion}</strong>
                      </p>
                      <p className="mt-0.5 text-fg-2">{v.reason}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
          <Alert tone="neutral">Nhận xét do AI tạo ra và có thể chưa hoàn toàn chính xác. Hãy xem như gợi ý tham khảo.</Alert>
        </div>
      )}
    </div>
  );
}
