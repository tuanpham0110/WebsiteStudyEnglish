import type { ReactNode } from 'react';
import { BookmarkPlus, CheckCircle2, Lightbulb, MessageSquareQuote, Target, Wand2 } from 'lucide-react';
import type { SessionReport } from '@shared/schemas';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { SpeakButton } from './SpeakButton';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SessionReportView({ report, onSaveWord }: { report: SessionReport; onSaveWord?: (w: { word: string; meaningVi: string; example: string }) => void }) {
  return (
    <Card className="animate-fade-in">
      <CardHeader title="Báo cáo sau buổi học" description={`Dựa trên ${report.basedOnTurns} lượt nói/viết của bạn.`} />
      <CardBody className="space-y-6">
        <p className="text-sm leading-relaxed text-fg-2">{report.summary}</p>

        {report.strengths.length > 0 && (
          <Section icon={<CheckCircle2 className="h-4 w-4" />} title="Điểm tốt">
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-2">
              {report.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>
        )}

        {report.goodSentences.length > 0 && (
          <Section icon={<MessageSquareQuote className="h-4 w-4" />} title="Câu bạn diễn đạt tốt">
            <ul className="space-y-1.5">
              {report.goodSentences.map((s) => (
                <li key={s} className="rounded-lg bg-success-soft px-3 py-2 text-sm text-fg">
                  “{s}”
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.grammarIssues.length > 0 && (
          <Section icon={<Wand2 className="h-4 w-4" />} title="Lỗi ngữ pháp cần chú ý">
            <ul className="space-y-3">
              {report.grammarIssues.map((g, i) => (
                <li key={i} className="rounded-lg border border-border p-3 text-sm">
                  <p className="text-danger line-through decoration-danger/60">{g.original}</p>
                  <p className="mt-1 flex items-center gap-1 font-medium text-success">
                    {g.corrected}
                    <SpeakButton text={g.corrected} />
                  </p>
                  <p className="mt-1 text-fg-2">{g.explanation}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.naturalAlternatives.length > 0 && (
          <Section icon={<Lightbulb className="h-4 w-4" />} title="Cách nói tự nhiên hơn">
            <ul className="space-y-2 text-sm">
              {report.naturalAlternatives.map((a, i) => (
                <li key={i} className="rounded-lg bg-surface-2 p-3">
                  <p className="text-muted">{a.original}</p>
                  <p className="mt-1 font-medium text-fg">→ {a.better}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.newVocabulary.length > 0 && (
          <Section icon={<BookmarkPlus className="h-4 w-4" />} title="Từ vựng mới">
            <ul className="grid gap-2 sm:grid-cols-2">
              {report.newVocabulary.map((v) => (
                <li key={v.word} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{v.word}</p>
                      <p className="text-fg-2">{v.meaningVi}</p>
                    </div>
                    <div className="flex shrink-0">
                      <SpeakButton text={v.word} />
                      {onSaveWord && (
                        <button
                          type="button"
                          onClick={() => onSaveWord(v)}
                          className="rounded-md px-2 text-xs font-medium text-primary hover:bg-primary-soft"
                        >
                          Lưu
                        </button>
                      )}
                    </div>
                  </div>
                  {v.example && <p className="mt-1 text-xs text-muted italic">{v.example}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.nextGoals.length > 0 && (
          <Section icon={<Target className="h-4 w-4" />} title="Mục tiêu luyện tập tiếp theo">
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-2">
              {report.nextGoals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Section>
        )}

        <Alert tone="neutral">{report.pronunciationNote}</Alert>
      </CardBody>
    </Card>
  );
}
