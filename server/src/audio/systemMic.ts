import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { config } from '../config.js';
import { getUvPath, getPythonExecutablePath } from '../utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SystemMicrophone extends EventEmitter {
  private micProcess: ChildProcess | null = null;
  private isRunning = false;
  private scriptPath: string;

  constructor() {
    super();
    const resourcesPath = (process as any).resourcesPath || '';
    const candidates = [
      path.join(resourcesPath, 'server', 'audio_engine', 'mic_stt_engine.py'),
      path.resolve(__dirname, '../../audio_engine/mic_stt_engine.py'),
      path.resolve(__dirname, '../../../audio_engine/mic_stt_engine.py'),
      path.resolve(__dirname, '../../../server/audio_engine/mic_stt_engine.py'),
      path.resolve(process.cwd(), 'server/audio_engine/mic_stt_engine.py'),
    ];
    let found = candidates[1];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        found = c;
        break;
      }
    }
    this.scriptPath = found;
  }

  public start(): void {
    if (this.isRunning) return;

    const pythonBin = getPythonExecutablePath();
    console.log(`[SystemMicrophone] Spawning native microphone & Faster-Whisper engine via ${pythonBin}...`);

    try {
      this.micProcess = spawn(
        pythonBin,
        [this.scriptPath],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            WAKE_PHRASE: config.wakePhrase,
            SLEEP_PHRASE: config.sleepPhrase,
            CAMERA_WAKE_PHRASE: config.cameraWakePhrase,
            CAMERA_SLEEP_PHRASE: config.cameraSleepPhrase,
          },
        }
      );

      this.isRunning = true;

      // Stream stdout JSON lines
      const rl = readline.createInterface({
        input: this.micProcess.stdout!,
        terminal: false,
      });

      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line.trim());

          switch (msg.type) {
            case 'ready':
              console.log('🎤 [SystemMicrophone] Physical microphone & Faster-Whisper are active and listening!');
              this.emit('ready', msg);
              break;

            case 'wake':
              console.log(`🎙️ [SystemMicrophone] Wake phrase "${msg.phrase}" heard on system microphone!`);
              this.emit('wake', msg);
              break;

            case 'sleep':
              console.log(`🌙 [SystemMicrophone] Sleep phrase "${msg.phrase}" heard on system microphone!`);
              this.emit('sleep', msg);
              break;

            case 'camera_wake':
              console.log(`👁️ [SystemMicrophone] Camera wake phrase "${msg.phrase}" heard on system microphone!`);
              this.emit('camera_wake', msg);
              break;

            case 'camera_sleep':
              console.log(`🌙 [SystemMicrophone] Camera sleep phrase "${msg.phrase}" heard on system microphone!`);
              this.emit('camera_sleep', msg);
              break;

            case 'speech':
              console.log(`🗣️ [SystemMicrophone] User spoken prompt: "${msg.text}"`);
              this.emit('speech', msg.text);
              break;

            case 'level':
              this.emit('level', msg.value);
              break;

            case 'error':
              console.warn('[SystemMicrophone] Error from engine:', msg.message);
              this.emit('error', new Error(msg.message));
              break;
          }
        } catch (e) {
          // Non-JSON line, ignore
        }
      });

      // Stream stderr for debug logs
      this.micProcess.stderr?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          console.log(`[MicSTT Engine] ${text}`);
        }
      });

      this.micProcess.on('exit', (code) => {
        console.warn(`[SystemMicrophone] Engine process exited with code ${code}`);
        this.isRunning = false;
        this.micProcess = null;
      });

      this.micProcess.on('error', (err) => {
        console.error('[SystemMicrophone] Failed to spawn engine:', err.message);
        this.isRunning = false;
        this.micProcess = null;
      });
    } catch (err: any) {
      console.error('[SystemMicrophone] Exception starting microphone:', err.message);
    }
  }

  public setMute(muted: boolean): void {
    if (this.micProcess && this.micProcess.stdin && !this.micProcess.stdin.destroyed) {
      this.micProcess.stdin.write(JSON.stringify({ type: 'mute', muted }) + '\n');
    }
  }

  public notifyAssistantSpoke(text: string): void {
    if (this.micProcess && this.micProcess.stdin && !this.micProcess.stdin.destroyed) {
      this.micProcess.stdin.write(JSON.stringify({ type: 'assistant_spoke', text }) + '\n');
    }
  }

  public stop(): void {
    if (this.micProcess) {
      console.log('[SystemMicrophone] Stopping microphone engine.');
      this.micProcess.kill('SIGTERM');
      this.micProcess = null;
      this.isRunning = false;
    }
  }
}
