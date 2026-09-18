export type AgentState =
  | 'passive'    // Listening for "Arise"
  | 'listening'  // January is listening...
  | 'speaking'   // January is speaking...
  | 'working'    // Working... (Tool Execution / Claude Loading)
  | 'sleeping';  // Sleeping (Waiting for "Arise")

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  source: 'voice' | 'text' | 'tool';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ActiveTool {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: any;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
}

export type EmotionType =
  | 'joy'
  | 'curious'
  | 'empathetic'
  | 'focused'
  | 'calm'
  | 'concerned'
  | 'neutral';

export interface EmotionState {
  emotion: EmotionType;
  valence: number;
  arousal: number;
  tone: string;
  pitch: string;
  rate: string;
  color: string;
}

export interface ClientConfig {
  agent: string;
  geminiModel: string;
  claudeModel: string;
  voice: string;
  wakePhrase: string;
  sleepPhrase: string;
}
