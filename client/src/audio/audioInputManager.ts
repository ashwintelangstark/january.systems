/**
 * AudioInputManager
 * Captures microphone audio, downsamples to 16kHz mono 16-bit PCM (Little-Endian),
 * base64 encodes it for Gemini Live WebSocket, and computes real-time volume levels for waveforms.
 */
export class AudioInputManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private isMuted = false;
  private onAudioDataCallback: ((base64Chunk: string) => void) | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;

  constructor(
    onAudioData: (base64Chunk: string) => void,
    onLevel?: (level: number) => void
  ) {
    this.onAudioDataCallback = onAudioData;
    this.onLevelCallback = onLevel || null;
  }

  public async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Buffer size: 4096 gives ~85ms buffer at 48kHz
      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRecording || this.isMuted) return;

        const inputBuffer = event.inputBuffer.getChannelData(0);

        // Compute RMS level for UI visualization
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        if (this.onLevelCallback) {
          this.onLevelCallback(Math.min(1, rms * 4)); // Boost sensitivity for visualizer
        }

        // Downsample from host sample rate (e.g. 44.1k or 48k) to 16,000 Hz
        const targetSampleRate = 16000;
        const downsampled = this.downsampleTo16k(inputBuffer, this.audioContext!.sampleRate, targetSampleRate);

        // Convert Float32Array to 16-bit PCM Little-Endian
        const pcm16 = this.floatTo16BitPCM(downsampled);

        // Base64 encode
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        if (this.onAudioDataCallback) {
          this.onAudioDataCallback(base64);
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isRecording = true;
      console.log('[AudioInputManager] Microphone capture started at', this.audioContext.sampleRate, 'Hz');
    } catch (err: any) {
      console.error('[AudioInputManager] Error accessing microphone:', err);
      throw err;
    }
  }

  public stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Resamples float32 input array to target sample rate (16kHz)
   */
  private downsampleTo16k(
    input: Float32Array,
    inputSampleRate: number,
    targetSampleRate: number
  ): Float32Array {
    if (inputSampleRate === targetSampleRate) {
      return input;
    }
    const sampleRateRatio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(input.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetInput = 0;

    while (offsetResult < result.length) {
      const nextOffsetInput = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
        accum += input[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetInput = nextOffsetInput;
    }
    return result;
  }

  /**
   * Converts Float32Array (-1.0 to +1.0) into Int16Array PCM
   */
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  /**
   * Converts ArrayBuffer or ArrayBufferLike to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
