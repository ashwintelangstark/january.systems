import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SystemResourceArgs {
  query: string;
  resourceType?: 'app' | 'folder' | 'video' | 'file' | 'audio' | 'auto';
}

export interface SearchFilesArgs {
  query: string;
  fileType?: 'video' | 'folder' | 'document' | 'audio' | 'image' | 'code' | 'any';
  limit?: number;
}

export interface ListFolderArgs {
  folderPath?: string;
}

export interface ReadFileArgs {
  filePath: string;
  maxLines?: number;
}

/**
 * Resolves well-known folder shortcuts (~, Downloads, Desktop, Documents, Movies, Pictures, Music)
 */
function resolveSystemPath(inputPath: string): string | null {
  const home = os.homedir();
  const trimmed = inputPath.trim();

  if (trimmed.startsWith('~')) {
    return path.join(home, trimmed.slice(1));
  }

  const lower = trimmed.toLowerCase().replace(/^(the\s+|my\s+)/, '');
  const standardFolders: Record<string, string> = {
    'downloads': path.join(home, 'Downloads'),
    'download': path.join(home, 'Downloads'),
    'desktop': path.join(home, 'Desktop'),
    'documents': path.join(home, 'Documents'),
    'document': path.join(home, 'Documents'),
    'movies': path.join(home, 'Movies'),
    'movie': path.join(home, 'Movies'),
    'videos': path.join(home, 'Movies'),
    'video': path.join(home, 'Movies'),
    'pictures': path.join(home, 'Pictures'),
    'photos': path.join(home, 'Pictures'),
    'picture': path.join(home, 'Pictures'),
    'music': path.join(home, 'Music'),
    'songs': path.join(home, 'Music'),
    'home': home,
    'root': '/',
    'applications': '/Applications',
    'apps': '/Applications',
  };

  if (standardFolders[lower]) {
    return standardFolders[lower];
  }

  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }

  // Check relative to cwd or home
  const fromHome = path.join(home, trimmed);
  if (fs.existsSync(fromHome)) {
    return fromHome;
  }

  const fromCwd = path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  return null;
}

// Comprehensive dictionary of common IDEs, developer tools, browsers, productivity apps, and software
const KNOWN_APP_ALIASES: Record<string, string[]> = {
  // IDEs & Code Editors
  'vs code': ['Visual Studio Code', 'Code'],
  'vscode': ['Visual Studio Code', 'Code'],
  'visual studio code': ['Visual Studio Code'],
  'code': ['Visual Studio Code'],
  'cursor': ['Cursor'],
  'cursor ide': ['Cursor'],
  'antigravity': ['Antigravity IDE', 'Antigravity'],
  'antigravity ide': ['Antigravity IDE', 'Antigravity'],
  'xcode': ['Xcode'],
  'pycharm': ['PyCharm', 'PyCharm CE', 'PyCharm Professional', 'PyCharm Community Edition'],
  'intellij': ['IntelliJ IDEA', 'IntelliJ IDEA Ultimate', 'IntelliJ IDEA Community Edition'],
  'intellij idea': ['IntelliJ IDEA', 'IntelliJ IDEA Ultimate'],
  'webstorm': ['WebStorm'],
  'android studio': ['Android Studio'],
  'sublime': ['Sublime Text'],
  'sublime text': ['Sublime Text'],
  'clion': ['CLion'],
  'goland': ['GoLand'],
  'rider': ['Rider'],
  'phpstorm': ['PhpStorm'],
  'rubymine': ['RubyMine'],
  'eclipse': ['Eclipse'],
  'atom': ['Atom'],
  'zed': ['Zed'],
  'neovim': ['nvim', 'Neovim'],
  
  // Terminals & Developer Tools
  'terminal': ['Terminal'],
  'iterm': ['iTerm', 'iTerm2'],
  'iterm2': ['iTerm', 'iTerm2'],
  'warp': ['Warp'],
  'ghostty': ['Ghostty'],
  'alacritty': ['Alacritty'],
  'kitty': ['kitty'],
  'docker': ['Docker', 'Docker Desktop'],
  'docker desktop': ['Docker Desktop', 'Docker'],
  'postman': ['Postman'],
  'insomnia': ['Insomnia'],
  'tableplus': ['TablePlus'],
  'dbeaver': ['DBeaver', 'DBeaver Community'],
  'wireshark': ['Wireshark'],
  'gitkraken': ['GitKraken'],
  'sourcetree': ['Sourcetree'],

  // Browsers
  'chrome': ['Google Chrome'],
  'google chrome': ['Google Chrome'],
  'safari': ['Safari'],
  'brave': ['Brave Browser', 'Brave'],
  'brave browser': ['Brave Browser'],
  'arc': ['Arc'],
  'firefox': ['Firefox'],
  'edge': ['Microsoft Edge'],
  'microsoft edge': ['Microsoft Edge'],
  'opera': ['Opera'],

  // Media, Music & Video Players
  'vlc': ['VLC', 'VLC media player'],
  'iina': ['IINA'],
  'quicktime': ['QuickTime Player'],
  'quicktime player': ['QuickTime Player'],
  'spotify': ['Spotify'],
  'music': ['Music'],
  'apple music': ['Music'],
  'podcasts': ['Podcasts'],
  'tv': ['TV'],

  // Productivity, Documents & Office
  'notes': ['Notes'],
  'reminders': ['Reminders'],
  'calendar': ['Calendar'],
  'calculator': ['Calculator'],
  'preview': ['Preview'],
  'pages': ['Pages'],
  'keynote': ['Keynote'],
  'numbers': ['Numbers'],
  'word': ['Microsoft Word'],
  'microsoft word': ['Microsoft Word'],
  'excel': ['Microsoft Excel'],
  'microsoft excel': ['Microsoft Excel'],
  'powerpoint': ['Microsoft PowerPoint'],
  'microsoft powerpoint': ['Microsoft PowerPoint'],
  'notion': ['Notion'],
  'obsidian': ['Obsidian'],
  'figma': ['Figma'],

  // Communication & Social
  'whatsapp': ['WhatsApp'],
  'slack': ['Slack'],
  'discord': ['Discord'],
  'telegram': ['Telegram'],
  'zoom': ['zoom.us', 'Zoom'],
  'teams': ['Microsoft Teams'],
  'microsoft teams': ['Microsoft Teams'],
  'signal': ['Signal'],
  'messages': ['Messages'],
  'facetime': ['FaceTime'],
  'mail': ['Mail'],

  // System Utilities
  'finder': ['Finder'],
  'system settings': ['System Settings', 'System Preferences'],
  'settings': ['System Settings', 'System Preferences'],
  'preferences': ['System Settings', 'System Preferences'],
  'activity monitor': ['Activity Monitor'],
  'disk utility': ['Disk Utility'],
  'keychain': ['Keychain Access'],
  'app store': ['App Store'],
};

/**
 * Universal System Opener: Opens any app, IDE, file, folder, video, audio, or document on macOS / Linux / Windows
 */
export async function openSystemResource(args: SystemResourceArgs): Promise<{ success: boolean; message: string; path?: string; details?: any }> {
  const { query, resourceType = 'auto' } = args;
  if (!query || typeof query !== 'string') {
    return { success: false, message: 'Missing target file, folder, app, IDE, or video name.' };
  }

  const platform = os.platform();
  const rawQuery = query.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  const lowerQuery = rawQuery.toLowerCase().replace(/^(the\s+|my\s+)/, '');

  console.log(`[Tool:openSystemResource] Request to open "${rawQuery}" (type: ${resourceType})`);

  // 1. Direct Known App / IDE Aliases Check
  if (platform === 'darwin') {
    const aliasCandidates = KNOWN_APP_ALIASES[lowerQuery];
    if (aliasCandidates && aliasCandidates.length > 0) {
      for (const appName of aliasCandidates) {
        try {
          console.log(`[Tool:openSystemResource] Attempting to launch known app alias "${appName}"...`);
          await execAsync(`open -a "${appName}"`);
          return {
            success: true,
            message: `Launched ${appName} on your Mac.`,
          };
        } catch {
          // Continue to next alias candidate
        }
      }
    }
  }

  // 2. Direct standard folder / absolute / relative path resolution
  const directPath = resolveSystemPath(rawQuery);
  if (directPath && fs.existsSync(directPath)) {
    try {
      if (platform === 'darwin') {
        await execAsync(`open "${directPath}"`);
      } else if (platform === 'win32') {
        await execAsync(`start "" "${directPath}"`);
      } else {
        await execAsync(`xdg-open "${directPath}"`);
      }
      const isDir = fs.statSync(directPath).isDirectory();
      return {
        success: true,
        path: directPath,
        message: `Opened ${isDir ? 'folder' : 'file'} "${path.basename(directPath)}" on your system.`,
      };
    } catch (e: any) {
      return { success: false, message: `Could not open path ${directPath}: ${e.message}` };
    }
  }

  // 3. macOS Spotlight / Native Index Search for Files, Videos, Documents, Folders, and Apps
  if (platform === 'darwin') {
    try {
      let mdQuery = '';
      const cleanName = rawQuery.replace(/[\\'"]/g, '');

      if (resourceType === 'video' || /\.(mp4|mov|mkv|avi|webm|m4v)$/i.test(rawQuery) || /\b(video|movie|clip|recording)\b/i.test(rawQuery)) {
        const queryTerm = cleanName.replace(/\b(video|movie|clip|recording|play|open)\b/gi, '').trim() || cleanName;
        mdQuery = `mdfind "(kMDItemContentTypeTree == 'public.movie' || kMDItemFSName == '*.mp4' || kMDItemFSName == '*.mov' || kMDItemFSName == '*.mkv') && (kMDItemFSName == '*${queryTerm}*'c || kMDItemDisplayName == '*${queryTerm}*'c)" | head -n 5`;
      } else if (resourceType === 'folder' || /\b(folder|directory)\b/i.test(rawQuery)) {
        const queryTerm = cleanName.replace(/\b(folder|directory|open)\b/gi, '').trim() || cleanName;
        mdQuery = `mdfind "kMDItemContentTypeTree == 'public.folder' && kMDItemFSName == '*${queryTerm}*'c" | head -n 5`;
      } else if (resourceType === 'app' || /\b(app|application|ide|software)\b/i.test(rawQuery)) {
        const queryTerm = cleanName.replace(/\b(app|application|ide|software|open|launch|start)\b/gi, '').trim() || cleanName;
        mdQuery = `mdfind "kMDItemKind == 'Application' && (kMDItemFSName == '*${queryTerm}*.app'c || kMDItemDisplayName == '*${queryTerm}*'c)" | head -n 5`;
      } else {
        // Auto / General Search
        mdQuery = `mdfind "kMDItemFSName == '*${cleanName}*'c || kMDItemDisplayName == '*${cleanName}*'c" | head -n 5`;
      }

      console.log(`[Tool:openSystemResource] Running spotlight query: ${mdQuery}`);
      const { stdout } = await execAsync(mdQuery);
      const lines = stdout.split('\n').map(l => l.trim()).filter(l => Boolean(l) && !l.includes('/Library/Caches') && !l.includes('/.Trash/'));

      if (lines.length > 0) {
        const bestMatch = lines[0];
        console.log(`[Tool:openSystemResource] Opening match: ${bestMatch}`);
        await execAsync(`open "${bestMatch}"`);
        
        const isDir = fs.existsSync(bestMatch) && fs.statSync(bestMatch).isDirectory();
        const resLabel = isDir ? 'folder' : (/\.(mp4|mov|mkv|avi|webm)$/i.test(bestMatch) ? 'video' : (/\.(pdf|docx|xlsx|pptx|txt|md)$/i.test(bestMatch) ? 'document' : 'file'));
        return {
          success: true,
          path: bestMatch,
          message: `Opened ${resLabel} "${path.basename(bestMatch)}" on your Mac.`,
          details: { allMatches: lines },
        };
      }

      // Fallback: try opening as application name directly via `open -a`
      try {
        await execAsync(`open -a "${cleanName}"`);
        return {
          success: true,
          message: `Launched "${cleanName}" on your Mac.`,
        };
      } catch (appErr) {
        // Continue to user directory scan
      }
    } catch (err: any) {
      console.warn(`[Tool:openSystemResource] Spotlight search notice: ${err.message}`);
    }
  }

  // 4. Fallback: Search common user folders (Downloads, Desktop, Documents, Movies, Pictures)
  const userDirs = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Movies'),
    path.join(os.homedir(), 'Pictures'),
  ];

  for (const dir of userDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        const match = files.find(f => f.toLowerCase().includes(rawQuery.toLowerCase()));
        if (match) {
          const fullMatchPath = path.join(dir, match);
          if (platform === 'darwin') {
            await execAsync(`open "${fullMatchPath}"`);
          } else if (platform === 'win32') {
            await execAsync(`start "" "${fullMatchPath}"`);
          } else {
            await execAsync(`xdg-open "${fullMatchPath}"`);
          }
          return {
            success: true,
            path: fullMatchPath,
            message: `Found and opened "${match}" in ${path.basename(dir)}.`,
          };
        }
      } catch {
        // Skip unreadable folder
      }
    }
  }

  return {
    success: false,
    message: `Could not find any file, document, folder, video, or software matching "${rawQuery}" on your system.`,
  };
}

/**
 * Searches system files, videos, documents, or folders
 */
export async function searchSystemFiles(args: SearchFilesArgs): Promise<{ success: boolean; results: Array<{ path: string; name: string; isDir: boolean; size?: string }>; message: string }> {
  const { query, fileType = 'any', limit = 10 } = args;
  if (!query) {
    return { success: false, results: [], message: 'Missing search query.' };
  }

  const platform = os.platform();
  const cleanName = query.replace(/[\\'"]/g, '').trim();

  if (platform === 'darwin') {
    try {
      let filter = `kMDItemFSName == '*${cleanName}*'c`;
      if (fileType === 'video') {
        filter = `kMDItemContentTypeTree == 'public.movie' && kMDItemFSName == '*${cleanName}*'c`;
      } else if (fileType === 'folder') {
        filter = `kMDItemContentTypeTree == 'public.folder' && kMDItemFSName == '*${cleanName}*'c`;
      } else if (fileType === 'document') {
        filter = `(kMDItemContentTypeTree == 'public.document' || kMDItemFSName == '*.pdf' || kMDItemFSName == '*.docx' || kMDItemFSName == '*.txt') && kMDItemFSName == '*${cleanName}*'c`;
      } else if (fileType === 'audio') {
        filter = `kMDItemContentTypeTree == 'public.audio' && kMDItemFSName == '*${cleanName}*'c`;
      } else if (fileType === 'image') {
        filter = `kMDItemContentTypeTree == 'public.image' && kMDItemFSName == '*${cleanName}*'c`;
      }

      const cmd = `mdfind "${filter}" | head -n ${limit}`;
      const { stdout } = await execAsync(cmd);
      const lines = stdout.split('\n').map(l => l.trim()).filter(l => Boolean(l) && !l.includes('/Library/Caches') && !l.includes('/.Trash/'));

      const results = lines.map((p) => {
        let isDir = false;
        let sizeStr = '';
        try {
          const st = fs.statSync(p);
          isDir = st.isDirectory();
          sizeStr = isDir ? 'directory' : `${(st.size / (1024 * 1024)).toFixed(2)} MB`;
        } catch {}
        return {
          path: p,
          name: path.basename(p),
          isDir,
          size: sizeStr,
        };
      });

      return {
        success: true,
        results,
        message: results.length > 0
          ? `Found ${results.length} item(s) matching "${cleanName}":\n` + results.map(r => `• [${r.isDir ? 'FOLDER' : 'FILE'}] ${r.name} (${r.path})`).join('\n')
          : `No files or folders found matching "${cleanName}".`,
      };
    } catch (e: any) {
      return { success: false, results: [], message: `Search failed: ${e.message}` };
    }
  }

  return {
    success: false,
    results: [],
    message: 'System file search is optimized for macOS Spotlight index.',
  };
}

/**
 * Lists contents of a local folder
 */
export async function listSystemFolder(args: ListFolderArgs): Promise<{ success: boolean; items: string[]; message: string; folderPath?: string }> {
  const targetDir = resolveSystemPath(args.folderPath || '~/Desktop') || path.resolve(process.cwd());

  try {
    if (!fs.existsSync(targetDir)) {
      return { success: false, items: [], message: `Directory does not exist: ${targetDir}` };
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items = entries.map(e => `${e.isDirectory() ? '📁 ' : '📄 '} ${e.name}`);

    return {
      success: true,
      folderPath: targetDir,
      items,
      message: `Contents of "${path.basename(targetDir)}" (${items.length} items):\n` + items.slice(0, 30).join('\n') + (items.length > 30 ? `\n...and ${items.length - 30} more` : ''),
    };
  } catch (err: any) {
    return { success: false, items: [], message: `Failed to list directory: ${err.message}` };
  }
}

/**
 * Reads a local text or code file
 */
export async function readSystemFile(args: ReadFileArgs): Promise<{ success: boolean; content?: string; message: string }> {
  const resolved = resolveSystemPath(args.filePath);
  if (!resolved || !fs.existsSync(resolved)) {
    return { success: false, message: `File not found: ${args.filePath}` };
  }

  try {
    const raw = fs.readFileSync(resolved, 'utf-8');
    const lines = raw.split('\n');
    const max = args.maxLines || 100;
    const truncated = lines.slice(0, max).join('\n');
    return {
      success: true,
      content: truncated,
      message: `Read ${Math.min(lines.length, max)} lines from ${path.basename(resolved)}`,
    };
  } catch (err: any) {
    return { success: false, message: `Cannot read file: ${err.message}` };
  }
}
