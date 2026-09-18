import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface LaunchAppArgs {
  appName: string;
}

export async function launchApp(args: LaunchAppArgs): Promise<{ success: boolean; message: string; details?: any }> {
  const { appName } = args;
  if (!appName || typeof appName !== 'string') {
    return { success: false, message: 'Invalid or missing appName parameter.' };
  }

  const platform = os.platform();
  const sanitizedName = appName.replace(/["$`\\]/g, ''); // Basic sanitization

  let command = '';
  if (platform === 'darwin') {
    // macOS
    command = `open -a "${sanitizedName}"`;
  } else if (platform === 'win32') {
    // Windows
    command = `start "" "${sanitizedName}"`;
  } else {
    // Linux / Freebsd
    command = `xdg-open "${sanitizedName}" 2>/dev/null || gtk-launch "${sanitizedName}" 2>/dev/null || which "${sanitizedName}"`;
  }

  try {
    console.log(`[Tool:launch_app] Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    return {
      success: true,
      message: `Successfully launched ${sanitizedName} on ${platform}.`,
      details: { stdout: stdout.trim(), stderr: stderr.trim() },
    };
  } catch (error: any) {
    // On macOS, try falling back to mdfind or Spotlight app finding if exact name failed
    if (platform === 'darwin') {
      try {
        const findCmd = `mdfind "kMDItemKind == 'Application' && kMDItemFSName == '*${sanitizedName}*.app'" | head -n 1`;
        const { stdout: appPath } = await execAsync(findCmd);
        const trimmedPath = appPath.trim();
        if (trimmedPath) {
          console.log(`[Tool:launch_app] Found app path via mdfind: ${trimmedPath}`);
          await execAsync(`open "${trimmedPath}"`);
          return {
            success: true,
            message: `Found and launched application at ${trimmedPath}`,
          };
        }
      } catch (fallbackErr) {
        // Continue to error return
      }
    }

    console.error(`[Tool:launch_app] Failed to launch ${sanitizedName}:`, error.message);
    return {
      success: false,
      message: `Failed to launch ${sanitizedName}: ${error.message}`,
    };
  }
}
