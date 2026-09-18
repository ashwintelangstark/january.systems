export type AgentState =
  | 'passive'    // Listening for "Arise"
  | 'listening'  // January is listening...
  | 'speaking'   // January is speaking...
  | 'working'    // Working... (Tool Execution / Claude Loading)
  | 'sleeping';  // Sleeping (Waiting for "Arise")

export interface ToolCallPayload {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResultPayload {
  id: string;
  name: string;
  result: any;
  isError?: boolean;
}

export interface TranscriptPayload {
  role: 'user' | 'assistant' | 'system';
  text: string;
  isFinal?: boolean;
  timestamp?: number;
}

export interface EmotionPayload {
  emotion: 'joy' | 'curious' | 'empathetic' | 'focused' | 'calm' | 'concerned' | 'neutral';
  valence: number;
  arousal: number;
  tone: string;
  pitch: string;
  rate: string;
  color: string;
}

// Client -> Server messages
export type ClientMessage =
  | { type: 'cli_attach' }
  | { type: 'cli_detach' }
  | { type: 'wake_trigger'; source?: 'voice' | 'manual' }
  | { type: 'sleep_trigger'; source?: 'voice' | 'manual' }
  | { type: 'audio_input'; data: string; mimeType?: string } // Base64 PCM 16kHz
  | { type: 'text_input'; text: string }
  | { type: 'set_state'; state: AgentState }
  | { type: 'interrupt' }
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'state_change'; state: AgentState; reason?: string }
  | { type: 'audio_output'; data: string; mimeType: string } // Base64 PCM 24kHz
  | { type: 'transcript'; payload: TranscriptPayload }
  | { type: 'emotion_update'; payload: EmotionPayload }
  | { type: 'tool_call'; payload: ToolCallPayload }
  | { type: 'tool_result'; payload: ToolResultPayload }
  | { type: 'interrupt' }
  | { type: 'audio_level'; level: number }
  | { type: 'system_log'; message: string; level?: 'info' | 'warn' | 'error' }
  | { type: 'pong' };
