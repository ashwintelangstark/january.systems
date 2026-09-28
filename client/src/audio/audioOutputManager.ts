export class AudioOutputManager {
  private audioCtx: AudioContext | null = null;
  private onLevelUpdate: (level: number) => void;
  private currentSource: AudioBufferSourceNode | null = null;
  private isMuted: boolean = false;
  private playingCount: number = 0;

  constructor(onLevelUpdate: (level: number) => void) {
    this.onLevelUpdate = onLevelUpdate;
  }

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.flush();
    }
  }

  public isPlaying(): boolean {
    return this.playingCount > 0;
  }

  public async playChunk(base64Data: string, visualizeOnly: boolean = false) {
    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.audioCtx) return;

      const binary = atob(base64Data);
      const len = binary.length;
      if (len === 0) return;

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      let audioBuffer: AudioBuffer | null = null;

      // 1. Try decoding standard audio containers (MP3, WAV, AAC, OGG)
      try {
        audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
      } catch {
        // 2. Only if decodeAudioData fails and it's valid raw 16-bit PCM at 24kHz (Gemini Live)
        // Check for 'RIFF' or 'ID3' or MPEG sync to avoid parsing compressed data as PCM noise!
        const isCompressed = (len > 3 && (binary.startsWith('ID3') || binary.startsWith('RIFF') || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)));
        if (!isCompressed && len % 2 === 0 && len > 100) {
          const int16 = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
          audioBuffer = this.audioCtx.createBuffer(1, float32.length, 24000);
          audioBuffer.getChannelData(0).set(float32);
        }
      }

      if (!audioBuffer) return;

      // Compute RMS audio level for visualizer
      const channelData = audioBuffer.getChannelData(0);
      let sumSquares = 0;
      const step = Math.max(1, Math.floor(channelData.length / 500));
      let count = 0;
      for (let i = 0; i < channelData.length; i += step) {
        const s = channelData[i];
        sumSquares += s * s;
        count++;
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, count));
      this.onLevelUpdate(Math.min(rms * 4.0, 1.0));

      // In Electron desktop app, afplay already outputs directly to physical Mac speakers.
      // Playing here would cause double-audio echo and radio feedback into the physical mic!
      if (visualizeOnly) {
        setTimeout(() => {
          this.onLevelUpdate(0);
        }, Math.min(audioBuffer.duration * 1000, 4000));
        return;
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      this.playingCount++;
      source.onended = () => {
        this.playingCount = Math.max(0, this.playingCount - 1);
        if (this.playingCount === 0) {
          this.onLevelUpdate(0);
        }
      };

      source.start();
      this.currentSource = source;
    } catch (err: any) {
      console.warn('[AudioOutputManager] Error processing audio chunk:', err.message);
    }
  }

  public speakSynthesizedText(text: string, emotion?: string) {
    if (this.isMuted || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = emotion === 'joy' ? 1.2 : emotion === 'concerned' ? 0.9 : 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.name.includes('Samantha') || v.name.includes('Victoria')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      this.playingCount++;
      this.onLevelUpdate(0.65);
    };

    utterance.onend = () => {
      this.playingCount = Math.max(0, this.playingCount - 1);
      this.onLevelUpdate(0);
    };

    window.speechSynthesis.speak(utterance);
  }

  public flush() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
    this.playingCount = 0;
    this.onLevelUpdate(0);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
