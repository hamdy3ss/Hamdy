export class AudioRecorder {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;

  constructor(private onData: (base64: string, sampleRate: number) => void) {}

  async start() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    try {
      this.audioCtx = new AudioContextClass({ sampleRate: 16000 });
    } catch (e) {
      this.audioCtx = new AudioContextClass();
    }
    
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    } });
    
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const actualSampleRate = this.audioCtx!.sampleRate;
      
      // Downsample to 16000Hz if needed
      const targetRate = 16000;
      let downsampledData = inputData;
      
      if (actualSampleRate !== targetRate) {
        const ratio = actualSampleRate / targetRate;
        const newLength = Math.round(inputData.length / ratio);
        downsampledData = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < downsampledData.length) {
          const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
          let accum = 0, count = 0;
          for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputData.length; i++) {
            accum += inputData[i];
            count++;
          }
          downsampledData[offsetResult] = accum / count;
          offsetResult++;
          offsetBuffer = nextOffsetBuffer;
        }
      }

      const int16Data = new Int16Array(downsampledData.length);
      for (let i = 0; i < downsampledData.length; i++) {
        let s = Math.max(-1, Math.min(1, downsampledData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const uint8Data = new Uint8Array(int16Data.buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Data.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(uint8Data.subarray(i, i + chunkSize)));
      }
      this.onData(btoa(binary), targetRate);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

export class AudioPlayer {
  private audioCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;

  start() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    try {
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
    } catch (e) {
      this.audioCtx = new AudioContextClass();
    }
    this.nextPlayTime = this.audioCtx.currentTime;
  }

  playBase64(base64: string) {
    if (!this.audioCtx) return;

    const binary = atob(base64);
    const uint8Data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8Data[i] = binary.charCodeAt(i);
    }
    const int16Data = new Int16Array(uint8Data.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 0x8000;
    }

    // Always create buffer at 24000Hz (Gemini's output rate)
    // The browser will automatically resample it to the AudioContext's actual sampleRate during playback
    const buffer = this.audioCtx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);

    if (this.nextPlayTime < this.audioCtx.currentTime) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;
  }

  stop() {
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
