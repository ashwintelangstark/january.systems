import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WindowManager {
  private static instance: WindowManager;

  private constructor() {}

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  /**
   * Activates and brings a target application to the front of the screen
   */
  public async activateApp(appName: string): Promise<boolean> {
    try {
      const script = `osascript -e 'tell application "${appName}" to activate'`;
      await execAsync(script);
      return true;
    } catch (e: any) {
      console.warn(`[WindowManager] Could not activate app "${appName}":`, e.message);
      return false;
    }
  }

  /**
   * Checks whether an application is currently running
   */
  public async isAppRunning(appName: string): Promise<boolean> {
    try {
      const script = `osascript -e 'tell application "System Events" to (name of processes) contains "${appName}"'`;
      const { stdout } = await execAsync(script);
      return stdout.trim().toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Retrieves main screen dimensions
   */
  public async getScreenBounds(): Promise<{ width: number; height: number }> {
    try {
      const script = `osascript -e 'tell application "Finder" to get bounds of window of desktop'`;
      const { stdout } = await execAsync(script);
      // stdout format: "0, 0, 1728, 1117"
      const parts = stdout.trim().split(',').map((s) => parseInt(s.trim(), 10));
      if (parts.length === 4) {
        return { width: parts[2] - parts[0], height: parts[3] - parts[1] };
      }
    } catch {}
    return { width: 1728, height: 1117 }; // default Mac Retina standard fallback
  }

  /**
   * Centers and sizes a window on screen for predictable interaction
   */
  public async setWindowBounds(appName: string, x: number, y: number, width: number, height: number): Promise<boolean> {
    try {
      const script = `osascript -e 'tell application "System Events" to tell process "${appName}" to set position of window 1 to {${x}, ${y}}' -e 'tell application "System Events" to tell process "${appName}" to set size of window 1 to {${width}, ${height}}'`;
      await execAsync(script);
      return true;
    } catch {
      return false;
    }
  }
}

export const windowManager = WindowManager.getInstance();
