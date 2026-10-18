import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { History, MessageSquareText } from 'lucide-react';
import { CHAT_MODE_INFO, CHAT_MODES, LEVELS, type ChatMode, type Level } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select, Switch } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/feedback';
import { AiFeatureGate, UsageHint } from '@/components/common/FeatureNotice';
import { useAppConfig, useLearnerContext } from '@/hooks/useUserData';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useConversation, useConversations } from './api';
import { ChatView } from './ChatView';
import { ConversationList } from './ConversationList';

const STARTERS: Record<ChatMode, string[]> = {
  conversation_partner: ['Hi! Can we talk about my weekend?', 'What should I cook for dinner tonight?', 'I want to talk about my favorite movie.'],
  english_tutor: ['What is the difference between "since" and "for"?', 'How do I use "used to"?', 'Can you give me 3 idioms about time?'],
  grammar_coach: ['Let’s practise the present perfect.', 'Help me with conditionals.', 'I often confuse "make" and "do".'],
  vocabulary_coach: ['Teach me words about the weather.', 'Give me useful phrases for meetings.', 'What are some synonyms for "happy"?'],
  interview_practice: ['I am applying for a marketing job.', 'Ask me common interview questions.', 'I want to practise "Tell me about yourself".'],
  travel_english: ['I am at a hotel reception.', 'Help me order food in a restaurant.', 'How do I ask for directions politely?'],
  business_english: ['Help me write a polite follow-up email.', 'Let’s practise a project update meeting.', 'How do I disagree politely?'],
};

export default function ChatPage() {
  const params = useParams();
  const navigate = useNavigate();
  const learner = useLearnerContext();
  const config = useAppConfig();
  const conversations = useConversations('chat');
  const routeId = params.conversationId ?? null;
  const current = useConversation(routeId);

  const [viewKey, setViewKey] = useState(routeId ?? 'new');
  // Id assigned by the server to the conversation started in the current view (keeps the view mounted).
  const createdRef = useRef<string | null>(null);
  const [mode, setMode] = useState<ChatMode>('conversation_partner');
  const [level, setLevel] = useState<Level | null>(null);
  const [topic, setTopic] = useState('');
  const [autoCorrect, setAutoCorrect] = useState<boolean | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  useStudyTimer('chat');

  const effectiveLevel = level ?? current.data?.level ?? learner.level;
  const effectiveAutoCorrect = autoCorrect ?? current.data?.auto_correct ?? learner.autoCorrect;
  const effectiveMode = (current.data?.mode && current.data.mode !== 'roleplay' ? current.data.mode : mode) as ChatMode;
  const aiEnabled = config.data?.features.aiText ?? false;

  // Keep the view in sync when the user navigates to another conversation (e.g. back button).
  useEffect(() => {
    if (routeId && routeId !== viewKey && routeId !== createdRef.current) setViewKey(routeId);
  }, [routeId, viewKey]);

  const select = (id: string) => {
    createdRef.current = null;
    setHistoryOpen(false);
    setLevel(null);
    setAutoCorrect(null);
    setViewKey(id);
    navigate(`/app/chat/${id}`);
  };
  const startNew = () => {
    createdRef.current = null;
    setHistoryOpen(false);
    setLevel(null);
    setAutoCorrect(null);
    setViewKey(`new-${Date.now()}`);
    navigate('/app/chat');
  };

  const list = (
    <ConversationList
      query={conversations}
      activeId={routeId}
      onSelect={select}
      onNew={startNew}
      onDeleted={(id) => {
        if (id === routeId) startNew();
      }}
    />
  );

  const isExisting = Boolean(routeId);

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[480px] gap-6 lg:h-[calc(100dvh-4rem)]">
      <aside className="hidden w-72 shrink-0 lg:block">{list}</aside>

      <Card className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setHistoryOpen(true)} aria-label="Lịch sử hội thoại">
            <History className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="chat-mode" className="sr-only">
              Chế độ
            </label>
            <Select id="chat-mode" value={effectiveMode} disabled={isExisting} onChange={(e) => setMode(e.target.value as ChatMode)} title={isExisting ? 'Chế độ được giữ cố định trong một hội thoại' : undefined}>
              {CHAT_MODES.map((m) => (
                <option key={m} value={m}>
                  {CHAT_MODE_INFO[m].label} — {CHAT_MODE_INFO[m].vi}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-24">
            <label htmlFor="chat-level" className="sr-only">
              Trình độ
            </label>
            <Select id="chat-level" value={effectiveLevel} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          {!isExisting && (
            <div className="min-w-[8rem] flex-1 sm:max-w-[14rem]">
              <label htmlFor="chat-topic" className="sr-only">
                Chủ đề
              </label>
              <Input id="chat-topic" placeholder="Chủ đề (tùy chọn)" value={topic} maxLength={80} onChange={(e) => setTopic(e.target.value)} />
            </div>
          )}
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
            <Switch checked={effectiveAutoCorrect} onChange={setAutoCorrect} label="Tự sửa lỗi" />
            <UsageHint kind="chat" />
          </div>
        </div>

        <div className="mt-2">
          <AiFeatureGate>{null}</AiFeatureGate>
        </div>

        <div className="min-h-0 flex-1">
          <ChatView
            key={viewKey}
            initialConversationId={viewKey.startsWith('new') ? null : viewKey}
            mode={effectiveMode}
            level={effectiveLevel}
            topic={topic}
            autoCorrect={effectiveAutoCorrect}
            explanationLanguage={learner.explanationLanguage}
            aiEnabled={aiEnabled}
            starters={STARTERS[effectiveMode]}
            emptyState={
              <EmptyState
                icon={<MessageSquareText className="h-6 w-6" />}
                title={CHAT_MODE_INFO[effectiveMode].label}
                description={`${CHAT_MODE_INFO[effectiveMode].description} AI sẽ trả lời theo trình độ ${effectiveLevel}.`}
              />
            }
            onConversationCreated={(id) => {
              createdRef.current = id;
              navigate(`/app/chat/${id}`, { replace: true });
            }}
          />
        </div>
      </Card>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Lịch sử hội thoại">
        <div className="h-[60dvh]">{list}</div>
      </Dialog>
    </div>
  );
}
