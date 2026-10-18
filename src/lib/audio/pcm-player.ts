import { int16ToFloat32 } from './pcm';

/**
 * Gapless playback of streamed PCM chunks (e.g. 24 kHz from a realtime model).
 * `interrupt()` stops immediately when the user barges in.
 */
export class PcmPlayer {
  private readonly context: AudioContext;
  private readonly sampleRate: number;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private drainListeners = new Set<() => void>();

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    // Created synchronously inside the user's click so autoplay policies allow it.
    this.context = new AudioContext();
  }

  async resume() {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  get playing() {
    return this.sources.size > 0;
  }

  onDrained(listener: () => void) {
    this.drainListeners.add(listener);
    return () => this.drainListeners.delete(listener);
  }

  enqueue(pcm: Int16Array) {
    if (pcm.length === 0 || this.context.state === 'closed') return;
    const buffer = this.context.createBuffer(1, pcm.length, this.sampleRate);
    buffer.copyToChannel(int16ToFloat32(pcm) as Float32Array<ArrayBuffer>, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const startAt = Math.max(this.context.currentTime + 0.02, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.drainListeners.forEach((l) => l());
    };
  }

  /** Play a recorded clip from scratch (used for "replay answer"). */
  playClip(chunks: Int16Array[]) {
    this.interrupt();
    for (const chunk of chunks) this.enqueue(chunk);
  }

  interrupt() {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* not started */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
    this.drainListeners.forEach((l) => l());
  }

  async close() {
    this.interrupt();
    if (this.context.state !== 'closed') await this.context.close();
  }
}
