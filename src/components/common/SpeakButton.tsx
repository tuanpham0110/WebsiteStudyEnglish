import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { browserTTS } from '@/lib/speech/tts';
import { Button } from '@/components/ui/button';
import { useLearnerContext } from '@/hooks/useUserData';

/** Reads English text aloud with the browser's speech synthesizer. */
export function SpeakButton({ text, rate, label = 'Nghe phát âm', size = 'icon-sm' }: { text: string; rate?: number; label?: string; size?: 'icon-sm' | 'icon' }) {
  const learner = useLearnerContext();
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => {
    if (speaking) browserTTS.cancel();
  }, [speaking]);
  if (!browserTTS.isSupported()) return null;
  return (
    <Button
      variant="ghost"
      size={size}
      aria-label={speaking ? 'Dừng đọc' : label}
      title={speaking ? 'Dừng đọc' : label}
      onClick={() => {
        if (speaking) {
          browserTTS.cancel();
          setSpeaking(false);
          return;
        }
        setSpeaking(true);
        browserTTS.speak(text, { rate: rate ?? learner.ttsRate, voiceURI: learner.ttsVoice, onEnd: () => setSpeaking(false) });
      }}
    >
      {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </Button>
  );
}
