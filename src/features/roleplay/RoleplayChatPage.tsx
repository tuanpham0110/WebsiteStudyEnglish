import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, History, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { getScenario } from '@shared/roleplay';
import type { SessionReport } from '@shared/schemas';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { AiFeatureGate } from '@/components/common/FeatureNotice';
import { SessionReportView } from '@/components/common/SessionReportView';
import { useAppConfig, useLearnerContext } from '@/hooks/useUserData';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { errorMessage } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { ChatView } from '@/features/chat/ChatView';
import { requestConversationReport, useConversation, useConversations } from '@/features/chat/api';
import { useVocabMutations } from '@/features/vocabulary/api';

export default function RoleplayChatPage() {
  const { scenarioId, conversationId } = useParams();
  const scenario = getScenario(scenarioId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const learner = useLearnerContext();
  const config = useAppConfig();
  const vocab = useVocabMutations();
  const history = useConversations('roleplay', scenarioId);
  const current = useConversation(conversationId ?? null);
  const [viewKey, setViewKey] = useState(conversationId ?? 'new');
  const [activeId, setActiveId] = useState<string | null>(conversationId ?? null);
  const [userTurns, setUserTurns] = useState(0);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useStudyTimer('roleplay', { refId: scenarioId });

  if (!scenario) {
    return <EmptyState title="Không tìm thấy tình huống" action={<ButtonLink to="/app/roleplay">Chọn tình huống</ButtonLink>} />;
  }
  const savedReport = report ?? current.data?.report ?? null;

  const open = (id: string | null) => {
    setHistoryOpen(false);
    setReport(null);
    setActiveId(id);
    setViewKey(id ?? `new-${Date.now()}`);
    navigate(id ? `/app/roleplay/${scenario.id}/${id}` : `/app/roleplay/${scenario.id}`);
  };

  const finish = async () => {
    if (!activeId) return;
    setLoadingReport(true);
    try {
      setReport(await requestConversationReport(activeId, learner.explanationLanguage));
      void qc.invalidateQueries({ queryKey: ['conversation', activeId] });
      void qc.invalidateQueries({ queryKey: ['app-config'] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ButtonLink to="/app/roleplay" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Nhập vai
        </ButtonLink>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4" aria-hidden /> Lần trước
          </Button>
          <Button variant="outline" size="sm" onClick={() => open(null)}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> Làm lại từ đầu
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Card className="flex h-[calc(100dvh-14rem)] min-h-[460px] flex-col p-3 sm:p-4">
          <div className="border-b border-border pb-3">
            <h1 className="font-semibold">{scenario.titleVi}</h1>
            <p className="text-sm text-muted">
              AI: {scenario.aiRole} · Bạn: {scenario.userRole}
            </p>
          </div>
          <div className="mt-2">
            <AiFeatureGate>{null}</AiFeatureGate>
          </div>
          <div className="min-h-0 flex-1">
            <ChatView
              key={viewKey}
              initialConversationId={viewKey.startsWith('new') ? null : viewKey}
              mode="conversation_partner"
              level={current.data?.level ?? learner.level}
              scenario={scenario}
              autoCorrect={learner.autoCorrect}
              explanationLanguage={learner.explanationLanguage}
              aiEnabled={config.data?.features.aiText ?? false}
              onMessagesChange={setUserTurns}
              onConversationCreated={(id) => {
                setActiveId(id);
                navigate(`/app/roleplay/${scenario.id}/${id}`, { replace: true });
              }}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 text-sm">
            <p className="mb-1 font-semibold">Mục tiêu</p>
            <ul className="list-disc space-y-0.5 pl-5 text-fg-2">
              {scenario.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <p className="mt-3 mb-1 font-semibold">Từ vựng gợi ý</p>
            <ul className="space-y-0.5 text-fg-2">
              {scenario.vocabulary.map((v) => (
                <li key={v.word}>
                  <span className="font-medium text-fg">{v.word}</span> — {v.vi}
                </li>
              ))}
            </ul>
          </Card>
          <Button className="w-full" onClick={() => void finish()} loading={loadingReport} disabled={!activeId || userTurns < 2 || Boolean(savedReport)}>
            <ClipboardCheck className="h-4 w-4" aria-hidden /> Kết thúc & nhận báo cáo
          </Button>
          {!savedReport && <p className="text-xs text-muted">Cần ít nhất 2 lượt trả lời của bạn.</p>}
        </div>
      </div>

      {savedReport && (
        <SessionReportView
          report={savedReport}
          onSaveWord={(w) =>
            vocab.saveFromText.mutate(
              { word: w.word, meaningVi: w.meaningVi, example: w.example },
              { onSuccess: () => toast.success(`Đã lưu “${w.word}”.`), onError: (e) => toast.error(errorMessage(e)) },
            )
          }
        />
      )}

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Các lần luyện trước">
        {history.data?.length ? (
          <ul className="space-y-1">
            {history.data.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/app/roleplay/${scenario.id}/${c.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    open(c.id);
                  }}
                  className="flex justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <span>{c.report ? 'Có báo cáo' : 'Chưa có báo cáo'}</span>
                  <span className="text-muted">{formatRelative(c.last_message_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Chưa có lần luyện nào.</p>
        )}
      </Dialog>
    </div>
  );
}
