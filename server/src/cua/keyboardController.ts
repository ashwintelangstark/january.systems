import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { SafetyInterlock } from './safetyInterlock.js';

const execAsync = promisify(exec);

export class KeyboardController {
  private static instance: KeyboardController;
  private cliclickPath = '/opt/homebrew/bin/cliclick';

  private constructor() {
    if (!fs.existsSync(this.cliclickPath)) {
      this.cliclickPath = '/usr/local/bin/cliclick';
    }
  }

  public static getInstance(): KeyboardController {
    if (!KeyboardController.instance) {
      KeyboardController.instance = new KeyboardController();
    }
    return KeyboardController.instance;
  }

  /**
   * Types text naturally with humanized inter-key delays
   */
  public async typeText(text: string, charDelayMs = 25): Promise<void> {
    if (SafetyInterlock.checkHalt()) return;
    const sanitized = text.replace(/"/g, '\\"');
    await execAsync(`${this.cliclickPath} w:${charDelayMs} t:"${sanitized}"`);
  }

  /**
   * Presses a specific key (e.g. 'return', 'tab', 'esc', 'space', 'delete', 'up', 'down')
   */
  public async pressKey(key: string): Promise<void> {
    if (SafetyInterlock.checkHalt()) return;
    const normalized = key.toLowerCase();
    const keyMap: Record<string, string> = {
      enter: 'return',
      return: 'return',
      esc: 'esc',
      escape: 'esc',
      tab: 'tab',
      space: 'space',
      delete: 'delete',
      backspace: 'delete',
      up: 'arrow-up',
      down: 'arrow-down',
      left: 'arrow-left',
      right: 'arrow-right',
    };
    const mapped = keyMap[normalized] || normalized;
    await execAsync(`${this.cliclickPath} kp:${mapped}`);
  }

  /**
   * Executes keyboard shortcut combinations (e.g. 'cmd+s', 'cmd+n', 'cmd+shift+p')
   */
  public async shortcut(chord: string): Promise<void> {
    if (SafetyInterlock.checkHalt()) return;
    const parts = chord.toLowerCase().split('+').map((s) => s.trim());
    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];

    const modMap: Record<string, string> = {
      cmd: 'cmd',
      command: 'cmd',
      shift: 'shift',
      alt: 'alt',
      opt: 'alt',
      option: 'alt',
      ctrl: 'ctrl',
      control: 'ctrl',
    };

    const downCmds = modifiers.map((m) => `kd:${modMap[m] || m}`).join(' ');
    const upCmds = modifiers.reverse().map((m) => `ku:${modMap[m] || m}`).join(' ');

    const keyCmd = `kp:${key}`;
    await execAsync(`${this.cliclickPath} ${downCmds} ${keyCmd} ${upCmds}`);
  }
}

export const keyboardController = KeyboardController.getInstance();
