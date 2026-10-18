export type MicChunk = { pcm: Int16Array; rms: number };

export type MicCapture = {
  readonly stream: MediaStream;
  readonly sampleRate: number;
  setMuted(muted: boolean): void;
  isLive(): boolean;
  stop(): Promise<void>;
};

export class MicError extends Error {
  readonly reason: 'unsupported' | 'denied' | 'not_found' | 'busy' | 'unknown';
  constructor(reason: MicError['reason'], message: string) {
    super(message);
    this.reason = reason;
  }
}

export function micErrorFrom(error: unknown): MicError {
  if (error instanceof MicError) return error;
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new MicError('denied', 'Bạn chưa cho phép dùng micro. Hãy bật quyền micro cho trang này trong cài đặt trình duyệt rồi thử lại.');
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new MicError('not_found', 'Không tìm thấy micro. Hãy kết nối micro rồi thử lại.');
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return new MicError('busy', 'Micro đang được ứng dụng khác sử dụng hoặc không đọc được.');
  }
  return new MicError('unknown', 'Không thể mở micro.');
}

/**
 * Open the microphone and stream 16-bit PCM chunks at `targetSampleRate` via an
 * AudioWorklet. Call `stop()` to release the device (the browser's recording
 * indicator turns off).
 */
export async function startMicCapture(options: {
  onChunk: (chunk: MicChunk) => void;
  targetSampleRate?: number;
  chunkMs?: number;
}): Promise<MicCapture> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
    throw new MicError('unsupported', 'Trình duyệt này không hỗ trợ thu âm thời gian thực.');
  }
  const targetSampleRate = options.targetSampleRate ?? 16000;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    throw micErrorFrom(error);
  }

  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule('/worklets/pcm-recorder.js');
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    await context.close();
    throw new MicError('unsupported', 'Không tải được bộ xử lý âm thanh.');
  }
  if (context.state === 'suspended') await context.resume();

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, 'pcm-recorder', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    processorOptions: { targetSampleRate, chunkSize: Math.round((targetSampleRate * (options.chunkMs ?? 100)) / 1000) },
  });
  // Keep the graph pulled without playing the mic back to the speakers.
  const silent = context.createGain();
  silent.gain.value = 0;
  source.connect(node);
  node.connect(silent);
  silent.connect(context.destination);

  let muted = false;
  let stopped = false;
  node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
    if (muted || stopped) return;
    options.onChunk({ pcm: new Int16Array(event.data.pcm), rms: event.data.rms });
  };

  return {
    stream,
    sampleRate: targetSampleRate,
    setMuted(value) {
      muted = value;
      stream.getAudioTracks().forEach((t) => (t.enabled = !value));
    },
    isLive() {
      return !stopped && stream.getAudioTracks().some((t) => t.readyState === 'live');
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
      } catch {
        /* already disconnected */
      }
      stream.getTracks().forEach((t) => t.stop());
      if (context.state !== 'closed') await context.close();
    },
  };
}
