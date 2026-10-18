import { useState } from 'react';
import { MessageSquareText, Mic } from 'lucide-react';
import { ROLEPLAY_SCENARIOS, type RoleplayScenario } from '@shared/roleplay';
import { ButtonLink } from '@/components/ui/button';
import { Card, PageHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/feedback';
import { useLearnerContext } from '@/hooks/useUserData';
import { cn } from '@/lib/cn';

export default function RoleplayPage() {
  const learner = useLearnerContext();
  const [open, setOpen] = useState<RoleplayScenario | null>(null);

  return (
    <div>
      <PageHeader title="Nhập vai" description="Luyện giao tiếp trong tình huống thực tế. AI giữ đúng vai và chủ động dẫn dắt hội thoại." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ROLEPLAY_SCENARIOS.map((s) => {
          const fits = s.levels.includes(learner.level);
          return (
            <button key={s.id} type="button" onClick={() => setOpen(s)} className="group text-left">
              <Card className={cn('h-full p-4 transition-colors group-hover:border-primary')}>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="primary">{s.category}</Badge>
                  {fits && <Badge tone="success">Hợp trình độ {learner.level}</Badge>}
                </div>
                <p className="font-semibold">{s.titleVi}</p>
                <p className="text-sm text-muted">{s.title}</p>
                <p className="mt-2 line-clamp-2 text-sm text-fg-2">{s.settingVi}</p>
                <p className="mt-2 text-xs text-muted">Trình độ: {s.levels.join(', ')}</p>
              </Card>
            </button>
          );
        })}
      </div>

      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.titleVi} description={open?.title} className="max-w-xl">
        {open && (
          <div className="space-y-4 text-sm">
            <p className="text-fg-2">{open.settingVi}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-muted">AI đóng vai</p>
                <p className="font-medium">{open.aiRole}</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-muted">Bạn đóng vai</p>
                <p className="font-medium">{open.userRole}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 font-semibold">Mục tiêu</p>
              <ul className="list-disc space-y-0.5 pl-5 text-fg-2">
                {open.goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-semibold">Từ vựng gợi ý</p>
              <ul className="flex flex-wrap gap-1.5">
                {open.vocabulary.map((v) => (
                  <li key={v.word} className="rounded-md border border-border px-2 py-1">
                    <span className="font-medium">{v.word}</span> <span className="text-muted">— {v.vi}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <ButtonLink to={`/app/roleplay/${open.id}`} className="flex-1">
                <MessageSquareText className="h-4 w-4" aria-hidden /> Luyện bằng chat
              </ButtonLink>
              <ButtonLink to={`/app/speaking?scenario=${open.id}`} variant="outline" className="flex-1">
                <Mic className="h-4 w-4" aria-hidden /> Luyện bằng giọng nói
              </ButtonLink>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
