import { useQuery } from '@tanstack/react-query';
import { BookmarkPlus, Loader2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AssistResult } from '@shared/schemas';
import { Button } from '@/components/ui/button';
import { SpeakButton } from '@/components/common/SpeakButton';
import { db, unwrap } from '@/lib/supabase';
import { errorMessage } from '@/lib/api';
import { assist } from '@/features/chat/api';
import { useVocabMutations, type VocabWord } from '@/features/vocabulary/api';
import { useAppConfig, useLearnerContext } from '@/hooks/useUserData';

/** Candidate base forms for a clicked word (simple suffix rules, no NLP library). */
export function lemmaCandidates(raw: string): string[] {
  const w = raw.toLowerCase().replace(/[’']s$/, '').replace(/[^a-z'-]/g, '');
  const out = new Set([w]);
  if (w.endsWith('ies')) out.add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) out.add(w.slice(0, -2));
  if (w.endsWith('s')) out.add(w.slice(0, -1));
  if (w.endsWith('ied')) out.add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    out.add(w.slice(0, -2));
    out.add(w.slice(0, -1));
  }
  if (w.endsWith('ing')) {
    out.add(w.slice(0, -3));
    out.add(w.slice(0, -3) + 'e');
  }
  return [...out].filter((x) => x.length > 1);
}

export function WordLookup({ word, context, onClose }: { word: string; context: string; onClose: () => void }) {
  const learner = useLearnerContext();
  const config = useAppConfig();
  const vocab = useVocabMutations();
  const [ai, setAi] = useState<Extract<AssistResult, { task: 'explain_vocab' }>['result']['items'][number] | null>(null);
  const [asking, setAsking] = useState(false);

  const local = useQuery({
    queryKey: ['lookup', word.toLowerCase()],
    queryFn: async () => {
      const candidates = lemmaCandidates(word);
      const rows = unwrap(
        await db().from('vocabulary').select('id, owner_id, word, part_of_speech, ipa, meaning_vi, definition_en, example_en, example_vi, level, topic').in('word', candidates).limit(5),
      ) as VocabWord[];
      return rows[0] ?? null;
    },
  });

  const askAi = async () => {
    setAsking(true);
    try {
      const res = await assist({ task: 'explain_vocab', text: `${word}\n\nContext: ${context}`.slice(0, 2000), level: learner.level, explanationLanguage: learner.explanationLanguage });
      if (res.task === 'explain_vocab') setAi(res.result.items.find((i) => i.word.toLowerCase().includes(word.toLowerCase())) ?? res.result.items[0] ?? null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAsking(false);
    }
  };

  const entry = local.data;
  const save = () => {
    const payload = entry
      ? { word: entry.word, meaningVi: entry.meaning_vi, example: entry.example_en ?? undefined }
      : ai
        ? { word: ai.word, meaningVi: ai.meaningVi, example: ai.example, ipa: ai.ipa, partOfSpeech: ai.partOfSpeech, definitionEn: ai.definitionEn }
        : null;
    if (!payload) return;
    vocab.saveFromText.mutate(payload, {
      onSuccess: () => toast.success(`Đã lưu “${payload.word}” vào sổ từ.`),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  return (
    <div className="animate-fade-in rounded-xl border border-border bg-surface p-4 shadow-card" role="dialog" aria-label={`Tra từ ${word}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-lg font-semibold">
          {entry?.word ?? ai?.word ?? word} <SpeakButton text={entry?.word ?? word} />
        </p>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {local.isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tra…
        </p>
      ) : entry ? (
        <div className="mt-1 space-y-1 text-sm">
          <p className="text-muted">
            {entry.part_of_speech} {entry.ipa}
          </p>
          <p className="font-medium text-fg">{entry.meaning_vi}</p>
          {entry.definition_en && <p className="text-fg-2">{entry.definition_en}</p>}
          {entry.example_en && <p className="text-muted italic">{entry.example_en}</p>}
        </div>
      ) : ai ? (
        <div className="mt-1 space-y-1 text-sm">
          <p className="text-muted">
            {ai.partOfSpeech} {ai.ipa}
          </p>
          <p className="font-medium text-fg">{ai.meaningVi}</p>
          {ai.definitionEn && <p className="text-fg-2">{ai.definitionEn}</p>}
          {ai.example && <p className="text-muted italic">{ai.example}</p>}
          <p className="text-xs text-muted">Giải thích do AI tạo, có thể chưa chính xác tuyệt đối.</p>
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted">
          <p>Từ này chưa có trong kho từ vựng.</p>
          {config.data?.features.aiText && (
            <Button size="sm" variant="soft" className="mt-2" onClick={() => void askAi()} loading={asking}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Hỏi AI theo ngữ cảnh
            </Button>
          )}
        </div>
      )}
      {(entry || ai) && (
        <Button size="sm" variant="outline" className="mt-3" onClick={save} loading={vocab.saveFromText.isPending}>
          <BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Lưu vào sổ từ
        </Button>
      )}
    </div>
  );
}
