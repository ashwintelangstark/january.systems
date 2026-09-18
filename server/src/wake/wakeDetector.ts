import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WakeDetector extends EventEmitter {
  private worker: Worker | null = null;
  private isPassive = true;

  constructor() {
    super();
  }

  public start(): void {
    console.log(`[WakeDetector] Starting Wake-Word listener for phrase: "${config.wakePhrase.toUpperCase()}"...`);

    // In TypeScript ESM / tsx runtime, check whether .ts or .js file exists
    const workerJsScript = path.resolve(__dirname, 'wakeWordWorker.js');
    const workerTsScript = path.resolve(__dirname, 'wakeWordWorker.ts');
    const targetScript = fs.existsSync(workerTsScript) ? workerTsScript : workerJsScript;

    try {
      this.worker = new Worker(targetScript, {
        workerData: {
          wakePhrase: config.wakePhrase,
        },
        execArgv: targetScript.endsWith('.ts') ? ['--import', 'tsx'] : [],
      });

      this.worker.on('message', (msg: any) => {
        if (msg.type === 'wake') {
          console.log(`🎙️ [WakeDetector] Wake word "${config.wakePhrase}" detected via worker!`);
          this.emit('wake', { source: 'system_mic' });
        } else if (msg.type === 'mic_status') {
          console.log(`[WakeDetector] Worker status: ${msg.status} - ${msg.message || ''}`);
          this.emit('status', msg);
        } else if (msg.type === 'audio_activity') {
          this.emit('activity', msg.energy);
        }
      });

      this.worker.on('error', (err: Error) => {
        console.warn('[WakeDetector] Worker thread error (non-fatal):', err.message);
      });

      this.worker.on('exit', (code: number) => {
        console.log(`[WakeDetector] Worker thread exited with code ${code}`);
      });
    } catch (err: any) {
      console.warn('[WakeDetector] Could not spawn background worker thread:', err.message);
      console.log('[WakeDetector] Dual-stream browser audio listener active as primary wake-word engine.');
    }
  }

  public triggerWake(source: 'voice' | 'manual' = 'voice'): void {
    console.log(`⚡ [WakeDetector] Wake trigger received from ${source}! Transitioning to active mode.`);
    this.emit('wake', { source });
  }

  public triggerSleep(source: 'voice' | 'manual' = 'voice'): void {
    console.log(`🌙 [WakeDetector] Sleep trigger received from ${source}! Transitioning to sleep mode.`);
    this.emit('sleep', { source });
  }

  public stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }
  }
}
