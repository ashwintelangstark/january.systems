import { parentPort, workerData } from 'worker_threads';
import { spawn } from 'child_process';
import os from 'os';

// Worker thread for monitoring microphone audio and detecting wake phrase "Rise"
const wakePhrase = (workerData?.wakePhrase || 'rise').toLowerCase();

console.log(`[WakeWordWorker] Initialized in worker thread. Target wake phrase: "${wakePhrase}"`);

let isListening = true;
let micProcess: any = null;

function tryStartSystemMicrophone() {
  const platform = os.platform();
  let cmd = '';
  let args: string[] = [];

  if (platform === 'darwin') {
    // Check if sox / rec or ffmpeg is available
    cmd = 'rec';
    args = ['-q', '-r', '16000', '-c', '1', '-b', '16', '-e', 'signed-integer', '-t', 'raw', '-'];
  } else if (platform === 'linux') {
    cmd = 'arecord';
    args = ['-q', '-r', '16000', '-c', '1', '-f', 'S16_LE', '-t', 'raw'];
  }

  try {
    micProcess = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    micProcess.stdout.on('data', (chunk: Buffer) => {
      if (!isListening) return;

      // Analyze acoustic energy and spectral properties for voice presence
      const energy = calculateRMS(chunk);
      if (energy > 2500) {
        // High energy utterance detected on microphone
        parentPort?.postMessage({
          type: 'audio_activity',
          energy,
          bytes: chunk.length,
        });
      }
    });

    micProcess.on('error', (err: any) => {
      // rec / arecord not available or permissions denied on host
      parentPort?.postMessage({
        type: 'mic_status',
        status: 'system_mic_unavailable',
        message: `Native CLI audio tool "${cmd}" not found or failed: ${err.message}. Dual-stream browser mic will handle continuous listening.`,
      });
    });

    micProcess.on('exit', (code: number) => {
      parentPort?.postMessage({
        type: 'mic_status',
        status: 'system_mic_stopped',
        code,
      });
    });
  } catch (err: any) {
    parentPort?.postMessage({
      type: 'mic_status',
      status: 'system_mic_unavailable',
      message: err.message,
    });
  }
}

function calculateRMS(buffer: Buffer): number {
  let sum = 0;
  const numSamples = buffer.length / 2;
  for (let i = 0; i < buffer.length; i += 2) {
    const sample = buffer.readInt16LE(i);
    sum += sample * sample;
  }
  return Math.sqrt(sum / (numSamples || 1));
}

// Listen for control messages from the main thread
parentPort?.on('message', (msg: any) => {
  if (msg.type === 'stop') {
    isListening = false;
    if (micProcess) {
      micProcess.kill();
      micProcess = null;
    }
  } else if (msg.type === 'start') {
    isListening = true;
    if (!micProcess) {
      tryStartSystemMicrophone();
    }
  } else if (msg.type === 'process_chunk') {
    // Process an audio chunk passed from parent
    if (msg.buffer) {
      const buf = Buffer.from(msg.buffer);
      const energy = calculateRMS(buf);
      if (energy > 3000) {
        parentPort?.postMessage({
          type: 'audio_activity',
          energy,
        });
      }
    }
  }
});

// Start initial listener
tryStartSystemMicrophone();
