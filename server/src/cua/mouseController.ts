import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { SafetyInterlock } from './safetyInterlock.js';

const execAsync = promisify(exec);

export class MouseController {
  private static instance: MouseController;
  private cliclickPath = '/opt/homebrew/bin/cliclick';

  private constructor() {
    if (!fs.existsSync(this.cliclickPath)) {
      this.cliclickPath = '/usr/local/bin/cliclick';
    }
  }

  public static getInstance(): MouseController {
    if (!MouseController.instance) {
      MouseController.instance = new MouseController();
    }
    return MouseController.instance;
  }

  /**
   * Retrieves current physical cursor coordinates
   */
  public async getPosition(): Promise<{ x: number; y: number }> {
    try {
      const { stdout } = await execAsync(`${this.cliclickPath} p`);
      const [xStr, yStr] = stdout.trim().split(',');
      return { x: parseInt(xStr, 10) || 0, y: parseInt(yStr, 10) || 0 };
    } catch (e: any) {
      console.warn('[MouseController] Error getting position:', e.message);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Moves mouse smoothly along a human-like Bezier path
   */
  public async moveTo(targetX: number, targetY: number, smooth = true): Promise<void> {
    const valid = SafetyInterlock.validateCoordinates(targetX, targetY);
    if (!smooth) {
      await execAsync(`${this.cliclickPath} m:${valid.x},${valid.y}`);
      return;
    }

    const current = await this.getPosition();
    const distance = Math.hypot(valid.x - current.x, valid.y - current.y);
    if (distance < 5) {
      await execAsync(`${this.cliclickPath} m:${valid.x},${valid.y}`);
      return;
    }

    const steps = Math.min(20, Math.max(5, Math.round(distance / 50)));
    const controlX = current.x + (valid.x - current.x) * 0.5 + (Math.random() - 0.5) * 50;
    const controlY = current.y + (valid.y - current.y) * 0.5 + (Math.random() - 0.5) * 50;

    const points: string[] = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Quadratic Bezier interpolation
      const x = Math.round((1 - t) * (1 - t) * current.x + 2 * (1 - t) * t * controlX + t * t * valid.x);
      const y = Math.round((1 - t) * (1 - t) * current.y + 2 * (1 - t) * t * controlY + t * t * valid.y);
      points.push(`m:${x},${y} w:10`);
    }

    await execAsync(`${this.cliclickPath} ${points.join(' ')}`);
  }

  /**
   * Clicks at coordinates (or current position)
   */
  public async click(x?: number, y?: number, button: 'left' | 'right' | 'middle' = 'left', count: 1 | 2 = 1): Promise<void> {
    if (x !== undefined && y !== undefined) {
      await this.moveTo(x, y, true);
    }

    const cmd = button === 'right' ? 'rc:.' : count === 2 ? 'dc:.' : 'c:.';
    await execAsync(`${this.cliclickPath} ${cmd}`);
  }

  /**
   * Drags from (fromX, fromY) to (toX, toY) - simulates physical hand brush strokes
   */
  public async drag(fromX: number, fromY: number, toX: number, toY: number, steps = 12): Promise<void> {
    const start = SafetyInterlock.validateCoordinates(fromX, fromY);
    const end = SafetyInterlock.validateCoordinates(toX, toY);

    await this.moveTo(start.x, start.y, false);

    // Build stroke path: mouse down at start, step through, mouse up at end
    const commands: string[] = [`dd:${start.x},${start.y}`];

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const curX = Math.round(start.x + (end.x - start.x) * t);
      const curY = Math.round(start.y + (end.y - start.y) * t);
      commands.push(`m:${curX},${curY} w:15`);
    }

    commands.push(`du:${end.x},${end.y}`);
    await execAsync(`${this.cliclickPath} ${commands.join(' ')}`);
  }
}

export const mouseController = MouseController.getInstance();
