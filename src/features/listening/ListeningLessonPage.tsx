import { useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, EyeOff, Pause, Play, Repeat, SkipBack, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import { Alert, Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Tabs } from '@/components/ui/tabs';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useLearnerContext } from '@/hooks/useUserData';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { logAttempts } from '@/lib/progress';
import { alignWords, matchScore, type WordMatch } from '@/lib/text-compare';
import { AlignmentView } from '@/components/common/AlignmentView';
import { useAuth } from '@/providers/AuthProvider';
import { ExerciseRunner } from '@/features/lessons/ExerciseRunner';
import { saveLessonResults } from '@/features/lessons/LessonList';
import { useLesson, type ListeningContent } from '@/features/lessons/api';
import { useScriptPlayer } from './useScriptPlayer';

const RATES = ['0.75', '1', '1.25'] as const;

function Dictation({ sentences, onSpeak, onResult }: { sentences: string[]; onSpeak: (t: string) => void; onResult: (r: { sentence: string; typed: string; score: number }) => void }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<WordMatch[] | null>(null);
  if (sentences.length === 0) return null;
  const sentence = sentences[i];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Câu {i + 1}/{sentences.length}: nghe và gõ lại chính xác những gì bạn nghe được.
      </p>
      <Button variant="soft" onClick={() => onSpeak(sentence)}>
        <Play className="h-4 w-4" aria-hidden /> Phát câu
      </Button>
      <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Gõ câu bạn nghe được…" disabled={result !== null} aria-label="Câu bạn nghe được" autoComplete="off" spellCheck={false} />
      {result && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <AlignmentView alignment={result} />
          <p className="text-sm">
            Đáp án: <span className="font-medium">{sentence}</span>
          </p>
        </div>
      )}
      <div className="flex gap-2">
        {result ? (
          i + 1 < sentences.length && (
            <Button
              onClick={() => {
                setI(i + 1);
                setTyped('');
                setResult(null);
              }}
            >
              Câu tiếp theo
            </Button>
          )
        ) : (
          <Button
            disabled={!typed.trim()}
            onClick={() => {
              const alignment = alignWords(sentence, typed);
              setResult(alignment);
              onResult({ sentence, typed, score: matchScore(alignment) });
            }}
          >
            Kiểm tra
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ListeningLessonPage() {
  const { lessonId } = useParams();
  const { user } = useAuth();
  const learner = useLearnerContext();
  const qc = useQueryClient();
  const query = useLesson<ListeningContent>(lessonId);
  const [rate, setRate] = useState<(typeof RATES)[number]>('1');
  const [showTranscript, setShowTranscript] = useState(false);
  const lines = query.data?.lesson.content.script ?? [];
  const player = useScriptPlayer(lines, { rate: Number(rate), preferredVoice: learner.ttsVoice });
  useStudyTimer('listening', { refId: lessonId, forceActive: player.playing });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return <EmptyState title="Không tìm thấy bài nghe" action={<ButtonLink to="/app/listening">Về danh sách</ButtonLink>} />;
  const { lesson, exercises } = query.data;

  return (
    <div className="space-y-6">
      <ButtonLink to="/app/listening" variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Luyện nghe
      </ButtonLink>
      <div>
        <Badge tone="primary">{lesson.level}</Badge>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="text-muted">{lesson.title_vi}</p>
      </div>

      <Card>
        <CardHeader
          title="Bài nghe"
          description="Giọng đọc tổng hợp của trình duyệt (chất lượng phụ thuộc thiết bị)."
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowTranscript((s) => !s)} aria-pressed={showTranscript}>
              {showTranscript ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              {showTranscript ? 'Ẩn transcript' : 'Hiện transcript'}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {!player.supported ? (
            <Alert tone="warning">Trình duyệt này không hỗ trợ đọc văn bản (speech synthesis). Bạn vẫn có thể đọc transcript và làm bài tập.</Alert>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={player.previous} aria-label="Câu trước" disabled={player.current <= 0}>
                <SkipBack className="h-4 w-4" />
              </Button>
              {player.playing ? (
                <Button onClick={player.pause}>
                  <Pause className="h-4 w-4" aria-hidden /> Tạm dừng
                </Button>
              ) : (
                <Button onClick={player.play}>
                  <Play className="h-4 w-4" aria-hidden /> {player.current >= 0 ? 'Phát tiếp' : 'Phát'}
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={player.next} aria-label="Câu sau" disabled={player.current >= lines.length - 1}>
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => player.playLine(Math.max(0, player.current))} disabled={player.current < 0}>
                <Repeat className="h-4 w-4" aria-hidden /> Nghe lại câu
              </Button>
              <div className="ml-auto">
                <Tabs label="Tốc độ" value={rate} onChange={setRate} items={RATES.map((r) => ({ value: r, label: `${r}×` }))} />
              </div>
            </div>
          )}
          <p className="tabular text-sm text-muted">
            {player.current >= 0 ? `Câu ${player.current + 1}/${lines.length}` : `${lines.length} câu`}
          </p>
          {showTranscript && (
            <ol className="space-y-1.5">
              {lines.map((line, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => player.playLine(i)}
                    className={cn('w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2', player.current === i && 'bg-primary-soft')}
                  >
                    <span className="font-semibold text-fg-2">{line.speaker}: </span>
                    {line.text}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Câu hỏi nghe hiểu" />
        <CardBody>
          <ExerciseRunner
            exercises={exercises}
            explanationLanguage={learner.explanationLanguage}
            onComplete={async (results) => {
              if (!user) return;
              try {
                const score = await saveLessonResults(user.id, 'listening', lesson.id, results);
                toast.success(`Đã lưu kết quả: ${score}%`);
                void qc.invalidateQueries({ queryKey: ['completed-lessons'] });
              } catch (error) {
                toast.error(`Không lưu được kết quả: ${errorMessage(error)}`);
              }
            }}
          />
        </CardBody>
      </Card>

      {lesson.content.dictation.length > 0 && (
        <Card>
          <CardHeader title="Nghe chính tả" />
          <CardBody>
            <Dictation
              sentences={lesson.content.dictation}
              onSpeak={player.speakText}
              onResult={(r) => {
                if (!user) return;
                void logAttempts(user.id, [
                  { exercise_id: null, lesson_id: lesson.id, skill: 'listening', answer: { typed: r.typed.slice(0, 500) }, is_correct: r.score >= 90, score: r.score },
                ]).catch(() => {});
              }}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
