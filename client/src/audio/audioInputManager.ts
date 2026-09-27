export class AudioInputManager {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioChunk: (base64Chunk: string) => void;
  private onLevelUpdate: (level: number) => void;
  private isMuted: boolean = false;

  constructor(
    onAudioChunk: (base64Chunk: string) => void,
    onLevelUpdate: (level: number) => void
  ) {
    this.onAudioChunk = onAudioChunk;
    this.onLevelUpdate = onLevelUpdate;
  }

  public async start(): Promise<void> {
    if (this.mediaStream) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 16000 });
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // 4096 buffer size (~250ms chunks at 16kHz)
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (this.isMuted) {
          this.onLevelUpdate(0);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        let sumSquares = 0;

        // Convert float32 to 16-bit PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          sumSquares += s * s;
        }

        // Calculate RMS audio level
        const rms = Math.sqrt(sumSquares / inputData.length);
        this.onLevelUpdate(Math.min(rms * 5.0, 1.0));

        // Convert PCM buffer to base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Chunk = btoa(binary);

        this.onAudioChunk(base64Chunk);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);
    } catch (err: any) {
      console.warn('[AudioInputManager] Microphone access error:', err.message);
      throw err;
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.onLevelUpdate(0);
  }
}
