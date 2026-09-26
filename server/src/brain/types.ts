/**
 * Brain Memory Unit Type Definitions for January AI
 * Manages SQLite persistence for chat sessions, historical messages, uploaded/created images,
 * generated code, synthesized 3D models, reference CAD models, and multimodal assets.
 */

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type ArtifactType =
  | 'chat'
  | 'image_uploaded'
  | 'image_created'
  | 'code_created'
  | '3d_model_created'
  | '3d_model_uploaded'
  | 'document'
  | 'file';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  activeModel?: string;
  summary?: string;
  isPinned: boolean;
  isArchived: boolean;
  metadata?: Record<string, any>;
  messageCount?: number;
  artifactCount?: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  verbalSummary?: string;
  emotion?: string;
  modelName?: string;
  tokensUsed?: number;
  createdAt: number;
  metadata?: Record<string, any>;
  artifacts?: BrainArtifact[];
}

export interface BrainArtifact {
  id: string;
  sessionId?: string;
  messageId?: string;
  type: ArtifactType;
  name: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  content?: string;
  metadata?: Record<string, any>;
  createdAt: number;
}

export interface CreateSessionOptions {
  id?: string;
  title?: string;
  activeModel?: string;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface AddMessageOptions {
  id?: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  verbalSummary?: string;
  emotion?: string;
  modelName?: string;
  tokensUsed?: number;
  metadata?: Record<string, any>;
  artifacts?: Array<Omit<BrainArtifact, 'id' | 'sessionId' | 'createdAt'>>;
}

export interface SaveArtifactOptions {
  id?: string;
  sessionId?: string;
  messageId?: string;
  type: ArtifactType;
  name: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface ListSessionsOptions {
  limit?: number;
  offset?: number;
  search?: string;
  archived?: boolean;
}

export interface ConversationHistoryContext {
  session: ChatSession;
  messages: ChatMessage[];
  artifacts: BrainArtifact[];
  formattedPromptHistory: Array<{ role: 'user' | 'assistant' | 'system'; text: string }>;
}
