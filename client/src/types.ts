export type AgentState =
  | 'passive'    // Listening for "Rise"
  | 'listening'  // January is listening...
  | 'speaking'   // January is speaking...
  | 'working'    // Processing / Tool Execution
  | 'sleeping';  // Sleeping (standby)

export interface EmotionState {
  emotion: 'joy' | 'curious' | 'empathetic' | 'focused' | 'calm' | 'concerned' | 'neutral' | string;
  valence: number;
  arousal: number;
  tone: string;
  pitch: string;
  rate: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  source: 'voice' | 'text' | 'tool';
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  artifacts?: any[];
}

export interface ActiveTool {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: any;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
}

export interface BrainSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
  summary?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  category?: 'Today' | 'Yesterday' | 'Previous 7 Days';
  icon?: string;
}

export interface ClientConfig {
  wakePhrase?: string;
  sleepPhrase?: string;
  version?: string;
  defaultModel?: string;
  activeModel?: string;
}
