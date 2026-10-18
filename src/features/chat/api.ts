import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssistResult, AssistRequest, Correction, SessionReport } from '@shared/schemas';
import type { ConversationMode, Level } from '@shared/constants';
import { api } from '@/lib/api';
import { db, unwrap } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type ConversationRow = {
  id: string;
  title: string;
  kind: 'chat' | 'roleplay';
  mode: ConversationMode;
  level: Level;
  topic: string | null;
  scenario_id: string | null;
  auto_correct: boolean;
  report: SessionReport | null;
  last_message_at: string;
};

export type MessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  correction: Correction | null;
  translation_vi: string | null;
  created_at: string;
};

const CONVERSATION_COLUMNS = 'id, title, kind, mode, level, topic, scenario_id, auto_correct, report, last_message_at';

export function useConversations(kind: 'chat' | 'roleplay', scenarioId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['conversations', user?.id, kind, scenarioId ?? null],
    enabled: Boolean(user),
    queryFn: async () => {
      let q = db().from('conversations').select(CONVERSATION_COLUMNS).eq('kind', kind).order('last_message_at', { ascending: false }).limit(100);
      if (scenarioId) q = q.eq('scenario_id', scenarioId);
      return unwrap(await q) as ConversationRow[];
    },
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    enabled: Boolean(id),
    queryFn: async () => unwrap(await db().from('conversations').select(CONVERSATION_COLUMNS).eq('id', id!).maybeSingle()) as ConversationRow | null,
  });
}

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  return unwrap(
    await db()
      .from('messages')
      .select('id, role, content, correction, translation_vi, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(500),
  ) as MessageRow[];
}

export async function deleteMessages(ids: string[]) {
  if (ids.length === 0) return;
  unwrap(await db().from('messages').delete().in('id', ids));
}

export function useConversationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['conversations'] });
  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      unwrap(await db().from('conversations').update({ title: title.trim().slice(0, 120) || 'New conversation' }).eq('id', id));
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await db().from('conversations').delete().eq('id', id));
    },
    onSuccess: invalidate,
  });
  return { rename, remove };
}

export function assist(body: AssistRequest) {
  return api<AssistResult>('/api/ai/assist', { body });
}

export function requestConversationReport(id: string, explanationLanguage: 'vi' | 'en') {
  return api<SessionReport>(`/api/conversations/${id}/report`, { body: { explanationLanguage } });
}
