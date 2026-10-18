// AudioWorklet: converts microphone audio (any device sample rate) to 16-bit PCM
// mono at the target rate and posts fixed-size chunks to the main thread.
// Downsampling uses box averaging, which is adequate for speech recognition.
class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetSampleRate || 16000;
    this.ratio = sampleRate / this.targetRate;
    this.chunkSize = opts.chunkSize || 1600; // 100 ms at 16 kHz
    this.buffer = new Int16Array(this.chunkSize);
    this.length = 0;
    this.acc = 0;
    this.accCount = 0;
    this.pos = 0;
    this.sumSquares = 0;
  }

  push(sample) {
    const clamped = Math.max(-1, Math.min(1, sample));
    this.buffer[this.length++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    this.sumSquares += clamped * clamped;
    if (this.length === this.chunkSize) {
      const rms = Math.sqrt(this.sumSquares / this.chunkSize);
      this.port.postMessage({ pcm: this.buffer.buffer, rms }, [this.buffer.buffer]);
      this.buffer = new Int16Array(this.chunkSize);
      this.length = 0;
      this.sumSquares = 0;
    }
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (!channel) return true;
    if (this.ratio <= 1) {
      for (let i = 0; i < channel.length; i++) this.push(channel[i]);
      return true;
    }
    for (let i = 0; i < channel.length; i++) {
      this.acc += channel[i];
      this.accCount++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.push(this.acc / this.accCount);
        this.acc = 0;
        this.accCount = 0;
        this.pos -= this.ratio;
      }
    }
    return true;
  }
}

registerProcessor('pcm-recorder', PcmRecorderProcessor);
