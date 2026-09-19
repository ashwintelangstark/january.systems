import { launchApp } from './launchApp.js';
import { delegateCoding } from './delegateCoding.js';
import { manageWhatsappMessage } from './manageWhatsapp.js';
import { searchWeb, fetchWebPage } from './webSearch.js';
import { openSystemResource, searchSystemFiles, listSystemFolder, readSystemFile } from './systemAccess.js';

export const GEMINI_TOOLS_DECLARATION = [
  {
    functionDeclarations: [
      {
        name: 'search_web',
        description: 'Search the live internet in real-time for up-to-date information, news, current events, weather, definitions, documentation, or online answers.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The search query to look up on the live internet.',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetch_web_page',
        description: 'Fetch and read the live text content of a specific webpage or URL.',
        parameters: {
          type: 'OBJECT',
          properties: {
            url: {
              type: 'STRING',
              description: 'The full URL of the website to fetch (e.g. "https://en.wikipedia.org/wiki/...").',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'open_system_resource',
        description: 'Open any application, folder, file, video, audio, or document on the local operating system (e.g., "Downloads", "Documents", "sample.mp4", "patient_videos", "Safari", "VS Code", "Terminal", "Spotify").',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The file name, folder name, video name, app name, or path to open (e.g., "Downloads", "vacation.mp4", "report.pdf", "Calculator").',
            },
            resourceType: {
              type: 'STRING',
              description: 'Optional resource category: "app", "folder", "video", "file", "audio", or "auto".',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_system_files',
        description: 'Search local system files, videos, documents, or folders across the computer using native index.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Search keyword, file name, or pattern to look for.',
            },
            fileType: {
              type: 'STRING',
              description: 'Optional filter: "video", "folder", "document", "audio", "image", "code", or "any".',
            },
            limit: {
              type: 'NUMBER',
              description: 'Maximum number of results to return (default 10).',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_system_folder',
        description: 'List the files and directories inside a local folder (e.g., "Downloads", "Desktop", "Documents", or specific path).',
        parameters: {
          type: 'OBJECT',
          properties: {
            folderPath: {
              type: 'STRING',
              description: 'The directory path or folder name to list (e.g., "Downloads", "Desktop", "~/Documents").',
            },
          },
        },
      },
      {
        name: 'read_system_file',
        description: 'Read the text content of a local file on the computer.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: {
              type: 'STRING',
              description: 'Path or name of the file to read.',
            },
            maxLines: {
              type: 'NUMBER',
              description: 'Max lines to read (default 100).',
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'launch_app',
        description: 'Launch an application or program locally on the user\'s computer (e.g. Safari, Visual Studio Code, Notes, Slack, Calculator).',
        parameters: {
          type: 'OBJECT',
          properties: {
            appName: {
              type: 'STRING',
              description: 'The name or bundle identifier of the application to open, e.g. "Safari", "Notes", "Visual Studio Code", "Slack".',
            },
          },
          required: ['appName'],
        },
      },
      {
        name: 'delegate_coding',
        description: 'Generate, explain, debug, or optimize code in Python, C, C++, algorithms, data structures, and systems programming.',
        parameters: {
          type: 'OBJECT',
          properties: {
            prompt: {
              type: 'STRING',
              description: 'The detailed programming task, code request, algorithm implementation, or bug fix query (e.g. Python, C, C++).',
            },
            language: {
              type: 'STRING',
              description: 'Optional programming language (e.g. "Python", "C", "C++", "CPP").',
            },
            context: {
              type: 'STRING',
              description: 'Optional surrounding code context or project constraints.',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'manage_whatsapp_message',
        description: 'Draft or initiate sending a WhatsApp message to a phone number or contact.',
        parameters: {
          type: 'OBJECT',
          properties: {
            number: {
              type: 'STRING',
              description: 'The recipient\'s phone number including country code (e.g. "+14155552671" or "919876543210").',
            },
            text: {
              type: 'STRING',
              description: 'The message body/text to send or draft.',
            },
          },
          required: ['number', 'text'],
        },
      },
    ],
  },
];

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  console.log(`[ToolsDispatcher] Executing function "${name}" with args:`, JSON.stringify(args));

  switch (name) {
    case 'search_web':
      return await searchWeb(args.query);

    case 'fetch_web_page':
      return await fetchWebPage(args.url);

    case 'open_system_resource':
      return await openSystemResource(args as any);

    case 'search_system_files':
      return await searchSystemFiles(args as any);

    case 'list_system_folder':
      return await listSystemFolder(args as any);

    case 'read_system_file':
      return await readSystemFile(args as any);

    case 'launch_app':
      return await launchApp(args as any);

    case 'delegate_coding':
      return await delegateCoding(args as any);

    case 'manage_whatsapp_message':
      return await manageWhatsappMessage(args as any);

    default:
      console.warn(`[ToolsDispatcher] Unknown tool called: ${name}`);
      return {
        error: `Tool "${name}" is not implemented on the local host.`,
      };
  }
}
