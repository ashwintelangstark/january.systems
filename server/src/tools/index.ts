import { launchApp } from './launchApp.js';
import { delegateCoding } from './delegateCoding.js';
import { manageWhatsappMessage } from './manageWhatsapp.js';
import { searchWeb, fetchWebPage } from './webSearch.js';
import { openSystemResource, searchSystemFiles, listSystemFolder, readSystemFile } from './systemAccess.js';
import { seeAndAnalyze } from './visionTool.js';
import { manageAiModel } from './manageModel.js';
import { create3DModelTool } from './blenderTool.js';
import { executeCuaAction } from './cuaTool.js';
import { convertPlanTo3D } from './architectureTool.js';

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
        name: 'see_and_analyze',
        description: 'Activate the physical system camera to visually look, recognize people/faces, identify objects, inspect documents, check posture, or describe surroundings.',
        parameters: {
          type: 'OBJECT',
          properties: {
            prompt: {
              type: 'STRING',
              description: 'What to visually look for, analyze, recognize, or describe through the camera (e.g. "What am I holding?", "Who is in front of the camera?", "Read this book page", "Describe the room").',
            },
          },
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
      {
        name: 'manage_ai_models',
        description: 'Inspect, list, switch, or reset active AI models across 458+ available OpenRouter/OmniRoute models.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              description: 'The action to perform: "list", "switch", "status", or "reset".',
            },
            model: {
              type: 'STRING',
              description: 'Model name or ID when action is "switch" (e.g. "deepseek/deepseek-r1", "claude 3.7", "gpt-4o").',
            },
            category: {
              type: 'STRING',
              description: 'Category filter for "list": "coding", "vision", "reasoning", "fast", "general", "creative", or "free".',
            },
            search: {
              type: 'STRING',
              description: 'Keyword search for "list" (e.g. "llama", "deepseek", "qwen").',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'create_3d_model',
        description: 'Build a high-fidelity 3D model in Blender using OpenRouter Astra GPT-6 engine. Can construct anything across all domains: houses & architectural buildings, electrical appliances, vehicles & cars, mechanical tools, and props. Automatically grounds with real-world web blueprints/dimensions and can launch default browser for reference images.',
        parameters: {
          type: 'OBJECT',
          properties: {
            prompt: {
              type: 'STRING',
              description: 'What 3D model to build (e.g. "modern minimalist villa with glass walls and patio", "retro electric toaster with bread slots and chrome lever", "electric sports car with alloy rims", "vintage brass microscope").',
            },
            fileName: {
              type: 'STRING',
              description: 'Optional custom file name for the 3D model (e.g. "modern_villa", "electric_toaster").',
            },
            openInBlender: {
              type: 'BOOLEAN',
              description: 'Whether to visibly launch Blender with the newly created model on screen (default true).',
            },
            openBrowserForImages: {
              type: 'BOOLEAN',
              description: 'Whether to open the default web browser on macOS to look for real-world reference images/blueprints during construction (default false, auto-enabled if prompt asks for image lookup).',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'execute_cua_action',
        description: 'Computer-Using Agent (CUA) tool: simulate physical mouse movement, clicking, dragging strokes, typing, and keyboard shortcuts on macOS.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              description: 'The CUA action: "move", "click", "drag", "type", "shortcut", or "position".',
            },
            x: { type: 'NUMBER', description: 'Target X screen coordinate for move/click.' },
            y: { type: 'NUMBER', description: 'Target Y screen coordinate for move/click.' },
            fromX: { type: 'NUMBER', description: 'Start X for drag stroke.' },
            fromY: { type: 'NUMBER', description: 'Start Y for drag stroke.' },
            toX: { type: 'NUMBER', description: 'End X for drag stroke.' },
            toY: { type: 'NUMBER', description: 'End Y for drag stroke.' },
            button: { type: 'STRING', description: '"left", "right", or "middle".' },
            count: { type: 'NUMBER', description: '1 for single click, 2 for double click.' },
            text: { type: 'STRING', description: 'Text to type.' },
            shortcut: { type: 'STRING', description: 'Key combination (e.g. "cmd+s", "cmd+n", "enter").' },
          },
          required: ['action'],
        },
      },
      {
        name: 'convert_floorplan_to_3d',
        description: 'Analyze a 2D building floor plan, blueprint, architectural drawing, or AutoCAD plan from the camera or a local file, extract rooms and walls, and construct an interactive 3D model in Blender.',
        parameters: {
          type: 'OBJECT',
          properties: {
            imagePath: {
              type: 'STRING',
              description: 'Optional path to a local floor plan image, CAD export, or blueprint drawing file.',
            },
            fromCamera: {
              type: 'BOOLEAN',
              description: 'True if capturing a physical drawing or printout held up in front of the camera.',
            },
            userPrompt: {
              type: 'STRING',
              description: 'Instructions, building style, or specific architectural context (e.g. "modern 2-bedroom villa", "minimalist apartment").',
            },
            style: {
              type: 'STRING',
              description: 'Architectural aesthetic style: "modern", "minimalist", "industrial", or "classic".',
            },
            openInBlender: {
              type: 'BOOLEAN',
              description: 'Whether to visibly launch Blender with the 3D building model on screen (default true).',
            },
          },
        },
      },
    ],
  },
];

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  console.log(`[ToolsDispatcher] Executing function "${name}" with args:`, JSON.stringify(args));

  switch (name) {
    case 'see_and_analyze':
      return await seeAndAnalyze(args as any);

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

    case 'manage_ai_models':
      return await manageAiModel(args as any);

    case 'create_3d_model':
      return await create3DModelTool(args as any);

    case 'execute_cua_action':
      return await executeCuaAction(args as any);

    case 'convert_floorplan_to_3d':
      return await convertPlanTo3D(args as any);

    default:
      console.warn(`[ToolsDispatcher] Unknown tool called: ${name}`);
      return {
        error: `Tool "${name}" is not implemented on the local host.`,
      };
  }
}
