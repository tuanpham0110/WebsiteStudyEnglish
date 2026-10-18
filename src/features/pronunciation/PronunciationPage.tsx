import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Loader2, Mic, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { Alert, Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { AlignmentView } from '@/components/common/AlignmentView';
import { SpeakButton } from '@/components/common/SpeakButton';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useAppConfig } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { PcmPlayer } from '@/lib/audio/pcm-player';
import { cn } from '@/lib/cn';
import { logAttempts, logProgress } from '@/lib/progress';
import { browserSTT, serverSTT, type SpeechToTextSession } from '@/lib/speech/stt';
import { detectSpeechSupport } from '@/lib/speech/support';
import { alignWords, matchScore, type WordMatch } from '@/lib/text-compare';
import { useAuth } from '@/providers/AuthProvider';
import { useLessons, type PronunciationContent } from '@/features/lessons/api';

type Attempt = { heard: string; alignment: WordMatch[]; score: number };

export default function PronunciationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const lessons = useLessons<PronunciationContent>('pronunciation');
  const config = useAppConfig();
  const support = useMemo(() => detectSpeechSupport(), []);
  const server = useMemo(() => serverSTT(15), []);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [recording, setRecording] = useState<'idle' | 'starting' | 'listening' | 'processing'>('idle');
  const [interim, setInterim] = useState('');
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const session = useRef<SpeechToTextSession | null>(null);
  useStudyTimer('pronunciation');

  const useBrowser = support.speechRecognition && support.secureContext;
  const useServer = !useBrowser && support.microphone && support.realtimeAudio && Boolean(config.data?.features.aiText);
  const engine = useBrowser ? 'browser' : useServer ? 'server' : null;

  const list = lessons.data ?? [];
  const lesson = list.find((l) => l.id === lessonId) ?? list[0];
  const sentences = lesson?.content.sentences ?? [];
  const sentence = sentences[sentenceIndex]?.text ?? '';
  const key = `${lesson?.id}:${sentenceIndex}`;
  const attempt = attempts[key];

  const record = async () => {
    if (!engine || !lesson) return;
    setInterim('');
    setRecording('starting');
    const provider = engine === 'browser' ? browserSTT : server;
    const s = provider.listen({ onListening: () => setRecording('listening'), onInterim: setInterim });
    session.current = s;
    try {
      const heard = await s.result.finally(() => setRecording('processing'));
      const alignment = alignWords(sentence, heard);
      const score = heard ? matchScore(alignment) : 0;
      setAttempts((a) => ({ ...a, [key]: { heard, alignment, score } }));
      if (user && heard) {
        await logAttempts(user.id, [{ exercise_id: null, lesson_id: lesson.id, skill: 'pronunciation', answer: { heard: heard.slice(0, 500), sentence }, is_correct: score >= 90, score }]);
        const done = sentences.every((_, i) => i === sentenceIndex || attempts[`${lesson.id}:${i}`]);
        if (done) {
          await logProgress(user.id, { activity: 'pronunciation', ref_id: lesson.id, completed: true, items_count: sentences.length });
          void qc.invalidateQueries({ queryKey: ['dashboard'] });
        }
      }
      if (!heard) toast.message('Không nhận dạng được lời nói. Hãy nói to, rõ hơn và thử lại.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      session.current = null;
      setRecording('idle');
      setInterim('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Luyện phát âm" description="Nghe câu mẫu, đọc to và xem hệ thống nhận dạng giọng nói nghe được những gì." />

      <Alert tone="neutral" title="Đây là so sánh bản ghi, không phải chấm điểm phát âm chuyên sâu">
        Hệ thống chuyển giọng nói của bạn thành chữ rồi so với câu mẫu để chỉ ra từ bị thiếu hoặc nhận dạng sai. Kết quả không đánh giá âm vị, trọng âm hay ngữ điệu, và phụ thuộc vào chất lượng micro cũng như bộ nhận dạng.
      </Alert>

      {!engine && !config.isLoading && (
        <Alert tone="warning" title="Không thể ghi âm trên trình duyệt này">
          {!support.secureContext
            ? 'Cần mở trang qua HTTPS.'
            : !support.microphone
              ? 'Trình duyệt không cho phép dùng micro.'
              : 'Trình duyệt không có nhận dạng giọng nói và máy chủ chưa bật nhận dạng phía máy chủ.'}{' '}
          Bạn vẫn có thể nghe câu mẫu.
        </Alert>
      )}

      {lessons.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : lessons.isError ? (
        <ErrorState message={errorMessage(lessons.error)} onRetry={() => void lessons.refetch()} />
      ) : !lesson ? (
        <EmptyState title="Chưa có bài phát âm" description="Dữ liệu bài học chưa được nạp vào cơ sở dữ liệu." />
      ) : (
        <>
          <Tabs
            label="Chọn chủ điểm"
            value={lesson.id}
            onChange={(id) => {
              setLessonId(id);
              setSentenceIndex(0);
            }}
            items={list.map((l) => ({ value: l.id, label: l.title_vi ?? l.title }))}
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <CardHeader title={lesson.title} description={lesson.summary ?? undefined} action={<Badge tone="primary">{lesson.level}</Badge>} />
              <CardBody className="space-y-5">
                <div className="rounded-xl bg-surface-2 p-5 text-center">
                  <p className="text-xl leading-relaxed font-medium">{sentence}</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <SpeakButton text={sentence} size="icon" label="Nghe câu mẫu" />
                    <SpeakButton text={sentence} rate={0.7} size="icon" label="Nghe chậm" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {recording === 'listening' ? (
                    <Button variant="danger" onClick={() => session.current?.stop()}>
                      <Square className="h-4 w-4" aria-hidden /> Dừng ghi
                    </Button>
                  ) : (
                    <Button onClick={() => void record()} disabled={!engine || recording !== 'idle'}>
                      {recording === 'idle' ? <Mic className="h-4 w-4" aria-hidden /> : <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      {recording === 'starting' ? 'Đang bật micro…' : recording === 'processing' ? 'Đang xử lý…' : 'Đọc và kiểm tra'}
                    </Button>
                  )}
                  {recording === 'listening' && (
                    <span className="flex items-center gap-2 text-sm font-medium text-primary" role="status">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden /> Đang nghe… {interim && <span className="text-fg-2 italic">“{interim}”</span>}
                    </span>
                  )}
                  {engine === 'server' && recording === 'idle' && server.lastRecording() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const player = new PcmPlayer(16000);
                        player.playClip([server.lastRecording()!]);
                      }}
                    >
                      <Play className="h-4 w-4" aria-hidden /> Nghe lại giọng tôi
                    </Button>
                  )}
                </div>
                {engine && (
                  <p className="flex items-start gap-1.5 text-xs text-muted">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {engine === 'browser'
                      ? 'Dùng nhận dạng giọng nói của trình duyệt (với Chrome, âm thanh được xử lý bởi dịch vụ của Google).'
                      : 'Ghi âm tối đa 15 giây rồi gửi lên máy chủ để nhận dạng (tính 1 lượt AI). Bản ghi âm không được lưu lại.'}
                  </p>
                )}

                {attempt && (
                  <div className="animate-fade-in space-y-3 rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Độ khớp bản ghi</p>
                      <p className={cn('tabular text-2xl font-semibold', attempt.score >= 90 ? 'text-success' : attempt.score >= 60 ? 'text-warning' : 'text-danger')}>{attempt.score}%</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted">Hệ thống nghe được</p>
                      <p className="text-sm text-fg-2">“{attempt.heard || '—'}”</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted">So với câu mẫu</p>
                      <AlignmentView alignment={attempt.alignment} />
                    </div>
                    <p className="text-xs text-muted">Xanh: khớp · Vàng: nhận dạng thành từ khác · Đỏ gạch: bị thiếu. Hãy luyện lại các từ màu vàng và đỏ.</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setSentenceIndex((i) => Math.max(0, i - 1))} disabled={sentenceIndex === 0}>
                    Câu trước
                  </Button>
                  <span className="tabular self-center text-sm text-muted">
                    {sentenceIndex + 1}/{sentences.length}
                  </span>
                  <Button variant="outline" onClick={() => setSentenceIndex((i) => Math.min(sentences.length - 1, i + 1))} disabled={sentenceIndex >= sentences.length - 1}>
                    Câu sau
                  </Button>
                </div>
              </CardBody>
            </Card>
            <Card className="h-fit">
              <CardHeader title="Mẹo phát âm" />
              <CardBody className="text-sm leading-relaxed text-fg-2">{lesson.content.tipsVi}</CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
