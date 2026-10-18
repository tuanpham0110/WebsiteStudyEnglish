import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AudioLines, FileText, Info, Mic, RotateCcw, Sparkles, Type } from 'lucide-react';
import { toast } from 'sonner';
import { LEVELS, LIVE_VOICES, SPEAKING_TOPICS, type Level, type LiveVoice } from '@shared/constants';
import { getScenario } from '@shared/roleplay';
import type { SessionReport } from '@shared/schemas';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { Alert, Badge, ErrorState, Skeleton } from '@/components/ui/feedback';
import { SessionReportView } from '@/components/common/SessionReportView';
import { useAppConfig, useLearnerContext } from '@/hooks/useUserData';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import { browserSTT } from '@/lib/speech/stt';
import { browserTTS } from '@/lib/speech/tts';
import { chooseTier, detectSpeechSupport, type SpeakingTier } from '@/lib/speech/support';
import { useVocabMutations } from '@/features/vocabulary/api';
import { FallbackSpeakingController, RealtimeSpeakingController } from './controllers';
import { SessionPanel } from './SessionPanel';
import { useSpeakingController } from './useSpeakingController';

const TIER_INFO: Record<SpeakingTier, { title: string; description: string; icon: React.ReactNode }> = {
  realtime: {
    title: 'Realtime voice',
    description: 'Hội thoại giọng nói hai chiều trực tiếp với AI (Gemini Live). Bạn có thể ngắt lời AI.',
    icon: <AudioLines className="h-5 w-5" />,
  },
  fallback: {
    title: 'Chế độ dự phòng',
    description: 'Trình duyệt nhận dạng giọng nói → AI trả lời bằng văn bản → trình duyệt đọc to. Không phải voice-to-voice realtime.',
    icon: <Mic className="h-5 w-5" />,
  },
  text: {
    title: 'Chế độ văn bản',
    description: 'Gõ câu trả lời; AI trả lời bằng văn bản (và đọc to nếu trình duyệt hỗ trợ).',
    icon: <Type className="h-5 w-5" />,
  },
};

export default function SpeakingPage() {
  const [params] = useSearchParams();
  const scenario = getScenario(params.get('scenario'));
  const learner = useLearnerContext();
  const config = useAppConfig();
  const qc = useQueryClient();
  const vocab = useVocabMutations();
  const support = useMemo(() => detectSpeechSupport(), []);
  const { controller, state, begin } = useSpeakingController();

  const [level, setLevel] = useState<Level | null>(null);
  const [topic, setTopic] = useState<(typeof SPEAKING_TOPICS)[number]>('Daily life');
  const [voice, setVoice] = useState<LiveVoice | null>(null);
  const [tierChoice, setTierChoice] = useState<SpeakingTier | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const features = config.data?.features;
  const bestTier = features ? chooseTier(support, features) : null;
  const available: SpeakingTier[] = features
    ? ([
        features.aiVoice && support.secureContext && support.microphone && support.realtimeAudio && support.webSocket ? 'realtime' : null,
        features.aiText && support.secureContext && support.microphone && support.speechRecognition && support.speechSynthesis ? 'fallback' : null,
        features.aiText ? 'text' : null,
      ].filter(Boolean) as SpeakingTier[])
    : [];
  const tier = tierChoice && available.includes(tierChoice) ? tierChoice : bestTier && available.includes(bestTier) ? bestTier : available[0];
  const effectiveLevel = level ?? learner.level;
  const effectiveVoice = voice ?? (LIVE_VOICES.includes(learner.speakingVoice as LiveVoice) ? (learner.speakingVoice as LiveVoice) : 'Kore');
  const sessionVisible = controller !== null && state.status !== 'idle';
  const finished = state.status === 'ended' || state.status === 'error';

  const start = () => {
    setReport(null);
    const common = { level: effectiveLevel, topic: scenario ? undefined : topic, scenarioId: scenario?.id };
    if (tier === 'realtime') {
      begin(new RealtimeSpeakingController({ ...common, voice: effectiveVoice }));
    } else {
      begin(
        new FallbackSpeakingController(
          { ...common, ttsRate: learner.ttsRate, ttsVoice: learner.ttsVoice },
          { stt: tier === 'fallback' ? browserSTT : null, tts: browserTTS.isSupported() ? browserTTS : null },
        ),
      );
    }
  };

  const end = async () => {
    await controller?.end('user');
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['app-config'] });
  };

  const analyse = async () => {
    if (!state.sessionId) return;
    setReportLoading(true);
    try {
      setReport(await api<SessionReport>(`/api/speaking/sessions/${state.sessionId}/report`, { body: { explanationLanguage: learner.explanationLanguage } }));
      void qc.invalidateQueries({ queryKey: ['app-config'] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReportLoading(false);
    }
  };

  const userTurns = state.transcript.filter((e) => e.role === 'user' && e.text.trim()).length;
  const voiceLimitMin = config.data ? Math.round(config.data.limits.voiceSecondsPerDay / 60) : null;
  const voiceUsedMin = config.data ? Math.round(config.data.usage.voice_seconds / 60) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={scenario ? `Nhập vai: ${scenario.titleVi}` : 'Luyện nói với AI'}
        description={scenario ? scenario.settingVi : 'Nói chuyện bằng tiếng Anh, AI lắng nghe và trả lời bằng giọng nói. Sau buổi học bạn nhận báo cáo chi tiết.'}
        actions={scenario ? <ButtonLink to="/app/roleplay" variant="outline">Đổi tình huống</ButtonLink> : undefined}
      />

      {config.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : config.isError ? (
        <Card>
          <ErrorState title="Không kết nối được API" message={errorMessage(config.error)} onRetry={() => void config.refetch()} />
        </Card>
      ) : !sessionVisible ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardHeader title="Thiết lập phiên luyện nói" />
            <CardBody className="space-y-5">
              {available.length === 0 ? (
                <Alert tone="warning" title="Chưa thể luyện nói">
                  Máy chủ chưa bật tính năng AI (integration pending), nên không có phiên nói nào được tạo. Không có âm thanh giả lập.
                </Alert>
              ) : (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-fg-2">Chế độ</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['realtime', 'fallback', 'text'] as SpeakingTier[]).map((t) => {
                      const enabled = available.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!enabled}
                          aria-pressed={tier === t}
                          onClick={() => setTierChoice(t)}
                          className={cn(
                            'rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                            tier === t ? 'border-primary bg-primary-soft' : 'border-border-strong hover:bg-surface-2',
                          )}
                        >
                          <span className={cn('flex items-center gap-2 text-sm font-semibold', tier === t && 'text-primary')}>
                            {TIER_INFO[t].icon} {TIER_INFO[t].title}
                          </span>
                          <span className="mt-1 block text-xs text-muted">{enabled ? TIER_INFO[t].description : unavailableReason(t, support, features!)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {tier === 'fallback' && (
                <Alert tone="warning" title="Đây không phải hội thoại voice-to-voice realtime">
                  Giọng nói của bạn được trình duyệt chuyển thành chữ (với Chrome, âm thanh được xử lý bởi dịch vụ của Google), AI trả lời bằng văn bản và trình duyệt đọc to câu trả lời.
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="sp-level" className="mb-1.5 block text-sm font-medium text-fg-2">
                    Trình độ
                  </label>
                  <Select id="sp-level" value={effectiveLevel} onChange={(e) => setLevel(e.target.value as Level)}>
                    {LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </Select>
                </div>
                {!scenario && (
                  <div>
                    <label htmlFor="sp-topic" className="mb-1.5 block text-sm font-medium text-fg-2">
                      Chủ đề
                    </label>
                    <Select id="sp-topic" value={topic} onChange={(e) => setTopic(e.target.value as typeof topic)}>
                      {SPEAKING_TOPICS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </div>
                )}
                {tier === 'realtime' && (
                  <div>
                    <label htmlFor="sp-voice" className="mb-1.5 block text-sm font-medium text-fg-2">
                      Giọng AI
                    </label>
                    <Select id="sp-voice" value={effectiveVoice} onChange={(e) => setVoice(e.target.value as LiveVoice)}>
                      {LIVE_VOICES.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {scenario && (
                <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm">
                  <p>
                    <span className="font-medium">AI đóng vai:</span> {scenario.aiRole} · <span className="font-medium">Bạn:</span> {scenario.userRole}
                  </p>
                  <p className="mt-2 font-medium">Mục tiêu</p>
                  <ul className="mt-1 list-disc pl-5 text-fg-2">
                    {scenario.goals.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button size="lg" onClick={start} disabled={!tier} className="w-full sm:w-auto">
                <Mic className="h-5 w-5" aria-hidden /> Bắt đầu phiên
              </Button>
              {tier !== 'text' && <p className="text-xs text-muted">Trình duyệt sẽ hỏi quyền dùng micro. Micro sẽ tắt ngay khi bạn kết thúc phiên.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Hạn mức hôm nay" icon={<Info className="h-5 w-5" />} />
            <CardBody className="space-y-3 text-sm text-fg-2">
              {features?.aiVoice && voiceLimitMin !== null && (
                <p>
                  Realtime: đã dùng <strong className="tabular">{voiceUsedMin}</strong>/{voiceLimitMin} phút. Mỗi phiên tối đa{' '}
                  {Math.round((config.data?.limits.voiceSessionSeconds ?? 0) / 60)} phút.
                </p>
              )}
              {features?.aiText && (
                <p>
                  Dự phòng/văn bản: mỗi lượt trả lời tính 1 lượt chat ({config.data?.usage.chat}/{config.data?.limits.chatPerDay} hôm nay).
                </p>
              )}
              <p className="text-xs text-muted">Hạn mức đặt lại lúc 00:00 UTC (7:00 sáng giờ Việt Nam). Hệ thống không tự chuyển sang dịch vụ trả phí khi hết hạn mức.</p>
              <p className="text-xs text-muted">Không lưu file âm thanh — chỉ lưu bản ghi văn bản.</p>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={state.transport === 'realtime' ? 'primary' : 'warning'}>
              {state.transport === 'realtime' ? 'Realtime voice' : tier === 'text' ? 'Chế độ văn bản' : 'Chế độ dự phòng — không phải realtime'}
            </Badge>
            <Badge>{effectiveLevel}</Badge>
            {!scenario && <Badge>{topic}</Badge>}
          </div>

          {state.status === 'error' && (
            <Alert tone="danger" title="Không thể tiếp tục phiên" action={<Button variant="outline" size="sm" onClick={start}>Thử lại</Button>}>
              {state.error}
              {state.errorCode?.startsWith('mic_') && ' Bạn có thể chọn chế độ văn bản để luyện mà không cần micro.'}
            </Alert>
          )}

          <SessionPanel state={state} controller={controller!} onEnd={() => void end()} />

          {finished && (
            <Card>
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Phiên đã kết thúc{state.durationSeconds !== null ? ` · ${formatDuration(state.durationSeconds)}` : ''}</p>
                  <p className="text-sm text-muted">{userTurns > 0 ? `${userTurns} lượt nói của bạn đã được ghi nhận.` : 'Chưa ghi nhận lượt nói nào của bạn.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={start}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> Phiên mới
                  </Button>
                  {userTurns > 0 && state.sessionId && !report && (
                    <Button onClick={() => void analyse()} loading={reportLoading}>
                      <Sparkles className="h-4 w-4" aria-hidden /> Phân tích buổi nói
                    </Button>
                  )}
                  <ButtonLink to="/app/progress" variant="ghost">
                    <FileText className="h-4 w-4" aria-hidden /> Lịch sử
                  </ButtonLink>
                </div>
              </CardBody>
            </Card>
          )}

          {report && (
            <SessionReportView
              report={report}
              onSaveWord={(w) =>
                vocab.saveFromText.mutate(
                  { word: w.word, meaningVi: w.meaningVi, example: w.example },
                  { onSuccess: () => toast.success(`Đã lưu “${w.word}” vào sổ từ.`), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            />
          )}
        </div>
      )}

      {!sessionVisible && (
        <p className="text-sm text-muted">
          Muốn luyện theo tình huống cụ thể? <Link to="/app/roleplay" className="text-primary hover:underline">Chọn một tình huống nhập vai</Link>.
        </p>
      )}
    </div>
  );
}

function unavailableReason(
  tier: SpeakingTier,
  support: ReturnType<typeof detectSpeechSupport>,
  features: { aiVoice: boolean; aiText: boolean },
): string {
  if (tier === 'realtime' && !features.aiVoice) return 'Chưa được bật trên máy chủ.';
  if (tier !== 'text' && !support.secureContext) return 'Cần kết nối HTTPS.';
  if (tier !== 'text' && !support.microphone) return 'Trình duyệt không cho phép dùng micro.';
  if (tier === 'realtime') return 'Trình duyệt không hỗ trợ âm thanh thời gian thực.';
  if (tier === 'fallback' && !features.aiText) return 'Tính năng AI chưa được bật.';
  if (tier === 'fallback') return 'Trình duyệt không hỗ trợ nhận dạng giọng nói (ví dụ Firefox).';
  return 'Tính năng AI chưa được bật.';
}
