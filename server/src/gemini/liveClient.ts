import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config.js';
import { GEMINI_TOOLS_DECLARATION, executeTool } from '../tools/index.js';
import { AgentState, ServerMessage, ToolCallPayload, ToolResultPayload } from '../types.js';
import { GeminiService } from './geminiService.js';

export interface GeminiLiveClientEvents {
  audio: (pcmChunkBase64: string, mimeType: string) => void;
  transcript: (role: 'user' | 'assistant', text: string, isFinal?: boolean) => void;
  stateChange: (state: AgentState, reason?: string) => void;
  toolCall: (payload: ToolCallPayload) => void;
  toolResult: (payload: ToolResultPayload) => void;
  interrupt: () => void;
  error: (err: Error) => void;
  ready: () => void;
}

export class GeminiLiveClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isSetupComplete = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private activeState: AgentState = 'passive';
  private geminiService: GeminiService = new GeminiService();

  constructor() {
    super();
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!config.geminiApiKey) {
      console.error('[GeminiLiveClient] Cannot connect: GEMINI_API key is missing.');
      this.emit('error', new Error('Missing GEMINI_API key'));
      return;
    }

    const host = 'generativelanguage.googleapis.com';
    const path = `/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${config.geminiApiKey}`;
    const url = `wss://${host}${path}`;

    console.log(`[GeminiLiveClient] Connecting to Gemini Live API WebSocket... (${config.geminiModel})`);

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[GeminiLiveClient] WebSocket connection established. Sending initial setup payload...');
        this.isConnected = true;
        this.sendSetupMessage();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        const reasonStr = reason.toString() || 'none';
        console.warn(`[GeminiLiveClient] WebSocket closed (code: ${code}, reason: ${reasonStr})`);
        this.isConnected = false;
        this.isSetupComplete = false;
        this.setState('passive', 'Connection closed');

        if (code === 1008) {
          console.warn('\n🔑 [GeminiLiveClient] Authentication Error (1008):');
          console.warn('   The Gemini Live API requires a valid Google AI Studio API key (format: "AIzaSy...").');
          console.warn('   Please update server/.env with your key from https://aistudio.google.com/apikey');
          console.warn('   In the meantime, local tool execution, Claude 3.7 Sonnet, and system controls remain active.\n');
          this.emit('error', new Error('Gemini Live API Auth Failed (1008). Ensure server/.env has a valid AIzaSy... key.'));
          // Do not loop retrying if credentials are invalid
          return;
        }

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err: Error) => {
        console.error('[GeminiLiveClient] WebSocket error:', err.message);
        this.emit('error', err);
      });
    } catch (err: any) {
      console.error('[GeminiLiveClient] Failed to initialize WebSocket:', err.message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log('[GeminiLiveClient] Scheduling reconnect in 4 seconds...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private sendSetupMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupPayload = {
      setup: {
        model: config.geminiModel,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.geminiVoice,
              },
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text:
                'You are January, an intelligent, concise, and focused local AI operating system assistant running directly on the user\'s laptop.\n' +
                'CRITICAL BEHAVIOR GUIDELINES:\n' +
                '1. Respond ONLY to what the user explicitly asks. Never introduce yourself, recite your tool list, or give unsolicited speeches unless the user explicitly asks "Who are you?" or "What can you do?".\n' +
                '2. If the user says "hi", "hello", "hey", or a simple greeting, respond with a brief, natural greeting (e.g., "Hello! How can I help you?").\n' +
                '3. Keep voice spoken output crisp, natural, and concise (1-2 sentences max).\n' +
                '4. You have access to local system tools:\n' +
                '   - `launch_app(appName)`: Launch native applications on the user\'s computer.\n' +
                '   - `delegate_coding(prompt, language, context)`: Delegate complex code generation, web application design, or refactoring tasks to Claude 3.7 Sonnet.\n' +
                '   - `manage_whatsapp_message(number, text)`: Draft or dispatch messages via WhatsApp.\n' +
                '5. CRITICAL VOICE RULE FOR CODE & APPS: When generating code or creating web applications, NEVER recite or read out raw code lines, syntax, functions, or HTML tags over the voice stream. Provide only a 1-sentence verbal summary (e.g., "I\'ve generated the application and loaded the live interactive preview on your screen.") and put the actual code in structured tool outputs or markdown code blocks.',
            },
          ],
        },
        tools: GEMINI_TOOLS_DECLARATION,
      },
    };

    this.ws.send(JSON.stringify(setupPayload));
    console.log('[GeminiLiveClient] Setup payload sent with local tools & voice configuration.');
  }

  private handleMessage(raw: WebSocket.RawData): void {
    try {
      const text = raw.toString('utf-8');
      const msg = JSON.parse(text);

      // Setup complete
      if (msg.setupComplete) {
        console.log('✨ [GeminiLiveClient] Live Session Setup Complete! Ready for bimodal audio/text.');
        this.isSetupComplete = true;
        this.emit('ready');
        return;
      }

      // Server Content (Audio, Text, Interruptions)
      if (msg.serverContent) {
        const { modelTurn, turnComplete, interrupted } = msg.serverContent;

        if (interrupted) {
          console.log('[GeminiLiveClient] User interrupted speech.');
          this.emit('interrupt');
          this.setState('listening', 'User interrupted');
          return;
        }

        if (modelTurn && Array.isArray(modelTurn.parts)) {
          for (const part of modelTurn.parts) {
            // Text transcript
            if (part.text) {
              this.emit('transcript', 'assistant', part.text, turnComplete ?? false);
            }

            // Inline Audio Data (PCM 24kHz)
            if (part.inlineData && part.inlineData.data) {
              this.setState('speaking', 'Streaming audio');
              this.emit('audio', part.inlineData.data, part.inlineData.mimeType || 'audio/pcm;rate=24000');
            }
          }
        }

        if (turnComplete) {
          console.log('[GeminiLiveClient] Model turn complete.');
          // If not in a tool execution, return to passive or listening
          if (this.activeState === 'speaking') {
            this.setState('passive', 'Turn completed');
          }
        }
      }

      // Tool Call (Gemini calling local Node.js function)
      if (msg.toolCall && Array.isArray(msg.toolCall.functionCalls)) {
        this.handleToolCalls(msg.toolCall.functionCalls);
      }
    } catch (err: any) {
      console.error('[GeminiLiveClient] Error parsing incoming message:', err.message);
    }
  }

  private async handleToolCalls(functionCalls: Array<{ id: string; name: string; args: Record<string, any> }>): Promise<void> {
    this.setState('working', 'Executing local tool');

    const functionResponses: Array<{ id: string; name: string; response: Record<string, any> }> = [];

    for (const call of functionCalls) {
      const toolPayload: ToolCallPayload = {
        id: call.id,
        name: call.name,
        args: call.args || {},
      };

      console.log(`⚡ [GeminiLiveClient] Tool Call triggered: ${call.name} (id: ${call.id})`);
      this.emit('toolCall', toolPayload);

      try {
        const result = await executeTool(call.name, call.args || {});

        const resultPayload: ToolResultPayload = {
          id: call.id,
          name: call.name,
          result,
          isError: !result.success && result.error !== undefined,
        };

        this.emit('toolResult', resultPayload);

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: { output: result },
        });
      } catch (err: any) {
        console.error(`[GeminiLiveClient] Error executing tool ${call.name}:`, err.message);
        functionResponses.push({
          id: call.id,
          name: call.name,
          response: { error: err.message },
        });
      }
    }

    // Send tool responses back to Gemini
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const toolResponsePayload = {
        toolResponse: {
          functionResponses,
        },
      };
      console.log(`[GeminiLiveClient] Sending tool responses back to Gemini for ${functionResponses.length} calls.`);
      this.ws.send(JSON.stringify(toolResponsePayload));
    }
  }

  /**
   * Send realtime 16kHz PCM audio chunk to Gemini
   */
  public sendRealtimeAudio(pcmBase64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      return;
    }

    const payload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: pcmBase64,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Send user text input to Gemini or fallback local engine
   */
  public sendClientText(text: string): void {
    this.emit('transcript', 'user', text, true);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      console.log(`[GeminiLiveClient] Live socket not ready. Processing text via local dispatch: "${text.slice(0, 60)}..."`);
      this.handleLocalFallback(text);
      return;
    }

    console.log(`[GeminiLiveClient] Sending user text prompt: "${text.slice(0, 60)}..."`);

    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(payload));
  }

  private async handleLocalFallback(text: string): Promise<void> {
    const lower = text.toLowerCase();
    this.setState('working', 'Local execution');

    // 1. Check for Launch App
    const launchMatch = lower.match(/(?:launch|open)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:app|application))?$/i) ||
                        lower.match(/(?:launch|open)\s+([a-zA-Z0-9]+)/i);

    if ((lower.includes('launch') || lower.includes('open')) && launchMatch && !lower.includes('code') && !lower.includes('claude')) {
      const appName = launchMatch[1].trim();
      const toolId = Math.random().toString(36).substring(2, 9);
      this.emit('toolCall', { id: toolId, name: 'launch_app', args: { appName } });
      const result = await executeTool('launch_app', { appName });
      this.emit('toolResult', { id: toolId, name: 'launch_app', result, isError: !result.success });
      this.emit('transcript', 'assistant', result.message, true);
      this.setState('passive', 'Tool completed');
      return;
    }

    // 2. Check for WhatsApp
    if (lower.includes('whatsapp')) {
      const toolId = Math.random().toString(36).substring(2, 9);
      const numberMatch = text.match(/(?:\+?\d{8,15})/);
      const number = numberMatch ? numberMatch[0] : '14155552671';
      this.emit('toolCall', { id: toolId, name: 'manage_whatsapp_message', args: { number, text } });
      const result = await executeTool('manage_whatsapp_message', { number, text });
      this.emit('toolResult', { id: toolId, name: 'manage_whatsapp_message', result, isError: !result.success });
      this.emit('transcript', 'assistant', result.message, true);
      this.setState('passive', 'Tool completed');
      return;
    }

    // 3. Delegate to Claude 3.7 Sonnet for coding, simulation, or technical creation
    const isCodingOrSimulation =
      lower.includes('claude') ||
      lower.includes('simulation') ||
      lower.includes('simulate') ||
      lower.includes('develop') ||
      lower.includes('code') ||
      lower.includes('script') ||
      lower.includes('function') ||
      lower.includes('component') ||
      lower.includes('class') ||
      lower.includes('implement') ||
      lower.includes('build') ||
      lower.includes('create') ||
      lower.includes('web app') ||
      lower.includes('website') ||
      lower.includes('html') ||
      lower.includes('frontend') ||
      lower.includes('calculator') ||
      lower.includes('timer') ||
      lower.includes('stopwatch') ||
      lower.includes('game') ||
      lower.includes('todo') ||
      lower.includes('dashboard');

    if (isCodingOrSimulation && !lower.includes('launch') && !lower.includes('open notes') && !lower.includes('open safari')) {
      const toolId = Math.random().toString(36).substring(2, 9);
      this.emit('toolCall', { id: toolId, name: 'delegate_coding', args: { prompt: text } });
      const result = await executeTool('delegate_coding', { prompt: text });
      this.emit('toolResult', { id: toolId, name: 'delegate_coding', result, isError: !result.success });
      
      const summary = result.success
        ? (result.isWebApp || result.htmlPreview
            ? "I've generated the simulation and loaded the live interactive preview for you on screen."
            : "I've generated the code for you on screen.")
        : result.response;
      this.emit('transcript', 'assistant', summary, true);
      return;
    }

    // 4. Pure AI Intelligence via Google Gemini API servers
    try {
      const result = await this.geminiService.analyzeAndRespond(text);
      this.emit('transcript', 'assistant', result.text, true);
    } catch (e: any) {
      this.emit('transcript', 'assistant', `Error contacting Gemini API: ${e.message}`, true);
    }
  }

  public setState(state: AgentState, reason?: string): void {
    if (this.activeState !== state) {
      this.activeState = state;
      console.log(`[GeminiLiveClient] State transition: -> ${state.toUpperCase()} (${reason || 'event'})`);
      this.emit('stateChange', state, reason);
    }
  }

  public getState(): AgentState {
    return this.activeState;
  }

  public isReady(): boolean {
    return this.isConnected && this.isSetupComplete;
  }
}
