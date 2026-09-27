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
    console.log(`[WakeDetector] Wake-Word engine active for phrase: "${config.wakePhrase.toUpperCase()}". Browser audio listener active as primary wake-word engine.`);
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
