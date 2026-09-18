import { launchApp } from './launchApp.js';
import { delegateCoding } from './delegateCoding.js';
import { manageWhatsappMessage } from './manageWhatsapp.js';
import { searchWeb, fetchWebPage } from './webSearch.js';

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
        description: 'Delegate complex software engineering, architecture, code generation, refactoring, or algorithmic tasks to Anthropic Claude 3.7 Sonnet.',
        parameters: {
          type: 'OBJECT',
          properties: {
            prompt: {
              type: 'STRING',
              description: 'The detailed programming task, code request, bug fix description, or technical query for Claude 3.7 Sonnet.',
            },
            language: {
              type: 'STRING',
              description: 'Optional programming language or framework (e.g. "TypeScript", "Python", "React", "Rust").',
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
