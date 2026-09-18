import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ManageWhatsappArgs {
  number: string;
  text: string;
}

export interface ManageWhatsappResult {
  success: boolean;
  message: string;
  recipient: string;
  url: string;
}

export async function manageWhatsappMessage(args: ManageWhatsappArgs): Promise<ManageWhatsappResult> {
  const { number, text } = args;

  if (!number || !text) {
    return {
      success: false,
      message: 'Both phone number and message text are required.',
      recipient: number || '',
      url: '',
    };
  }

  // Clean the phone number (remove +, spaces, hyphens, brackets)
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(text);
  const platform = os.platform();

  // WhatsApp Deep Link & Web URL
  const appUri = `whatsapp://send?phone=${cleanNumber}&text=${encodedText}`;
  const webUri = `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encodedText}`;

  console.log(`[Tool:manage_whatsapp] Preparing WhatsApp message for ${cleanNumber}: "${text.slice(0, 40)}..."`);

  try {
    let command = '';
    if (platform === 'darwin') {
      // Try opening native WhatsApp application first, or browser fallback
      command = `open "${appUri}" 2>/dev/null || open "${webUri}"`;
    } else if (platform === 'win32') {
      command = `start "" "${appUri}" || start "" "${webUri}"`;
    } else {
      command = `xdg-open "${webUri}"`;
    }

    await execAsync(command);

    return {
      success: true,
      message: `WhatsApp composer opened for recipient +${cleanNumber} with the specified message text.`,
      recipient: cleanNumber,
      url: appUri,
    };
  } catch (error: any) {
    console.error('[Tool:manage_whatsapp] Error launching WhatsApp:', error.message);
    return {
      success: false,
      message: `Failed to open WhatsApp: ${error.message}. Target web link: ${webUri}`,
      recipient: cleanNumber,
      url: webUri,
    };
  }
}
