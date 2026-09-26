/**
 * Unified Brain Service for January AI
 * Primary high-level interface for January's persistent memory unit.
 *
 * Capabilities:
 * - Active session tracking (seamless session continuity across CLI, Voice, & Web UI)
 * - Session lifecycle: create, resume, rename, pin, archive, delete
 * - Chat history logging: record user & assistant turns with model metadata
 * - Multimodal artifact logging:
 *   - Reference images uploaded
 *   - AI images generated
 *   - Code created (Python, C, C++, etc.)
 *   - 3D models synthesized (.blend, .obj, .glb)
 *   - Reference 3D models uploaded (CAD, STL, OBJ)
 * - Context restoration: reopen any past conversation days later with full prompt history & assets
 */

import { brainDatabase, BrainDatabase } from './brainDatabase.js';
import { conversationManager, ConversationManager } from './conversationManager.js';
import { artifactManager, ArtifactManager } from './artifactManager.js';
import {
  ChatSession,
  ChatMessage,
  BrainArtifact,
  ArtifactType,
  CreateSessionOptions,
  AddMessageOptions,
  ListSessionsOptions,
  ConversationHistoryContext,
} from './types.js';

export class BrainService {
  private db: BrainDatabase;
  private conversation: ConversationManager;
  private artifacts: ArtifactManager;
  private activeSessionId: string | null = null;

  constructor(
    db: BrainDatabase = brainDatabase,
    conversation: ConversationManager = conversationManager,
    artifacts: ArtifactManager = artifactManager
  ) {
    this.db = db;
    this.conversation = conversation;
    this.artifacts = artifacts;
  }

  /**
   * Initializes the Brain database and restores or creates the active session
   */
  public async initialize(): Promise<void> {
    this.db.initialize();
    
    // Automatically find the most recent unarchived session or create a new one
    const recentSessions = this.conversation.listSessions({ limit: 1, archived: false });
    if (recentSessions.length > 0) {
      this.activeSessionId = recentSessions[0].id;
      console.log(`[BrainService] 🧠 Loaded active session: "${recentSessions[0].title}" (${this.activeSessionId})`);
    } else {
      const newSession = this.conversation.createSession({ title: 'Welcome to January' });
      this.activeSessionId = newSession.id;
      console.log(`[BrainService] 🧠 Created initial active session: "${newSession.title}" (${this.activeSessionId})`);
    }
  }

  // ==========================================
  // Session Management
  // ==========================================

  public getActiveSessionId(): string {
    if (!this.activeSessionId) {
      const newSession = this.conversation.createSession();
      this.activeSessionId = newSession.id;
    }
    return this.activeSessionId;
  }

  public setActiveSession(sessionId: string): ChatSession {
    const session = this.conversation.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }
    this.activeSessionId = session.id;
    console.log(`[BrainService] 🔄 Switched active session to: "${session.title}" (${session.id})`);
    return session;
  }

  public createSession(options?: CreateSessionOptions): ChatSession {
    const session = this.conversation.createSession(options);
    this.activeSessionId = session.id;
    return session;
  }

  public getSession(sessionId?: string): ChatSession | null {
    const targetId = sessionId || this.getActiveSessionId();
    return this.conversation.getSession(targetId);
  }

  public listSessions(options?: ListSessionsOptions): ChatSession[] {
    return this.conversation.listSessions(options);
  }

  public renameSession(sessionId: string, newTitle: string): boolean {
    return this.conversation.updateSessionTitle(sessionId, newTitle);
  }

  public togglePinSession(sessionId: string, isPinned?: boolean): boolean {
    return this.conversation.toggleSessionPinned(sessionId, isPinned);
  }

  public archiveSession(sessionId: string, isArchived: boolean = true): boolean {
    const success = this.conversation.setSessionArchived(sessionId, isArchived);
    if (success && this.activeSessionId === sessionId) {
      // Find a replacement active session
      const remaining = this.conversation.listSessions({ limit: 1, archived: false });
      this.activeSessionId = remaining.length > 0 ? remaining[0].id : null;
    }
    return success;
  }

  public deleteSession(sessionId: string): boolean {
    const success = this.conversation.deleteSession(sessionId);
    if (success && this.activeSessionId === sessionId) {
      const remaining = this.conversation.listSessions({ limit: 1, archived: false });
      this.activeSessionId = remaining.length > 0 ? remaining[0].id : null;
    }
    return success;
  }

  /**
   * Resumes a past chat session from days ago and returns its full conversation context
   */
  public resumeSession(sessionId: string, maxMessages = 50): ConversationHistoryContext {
    const context = this.conversation.getConversationContext(sessionId, maxMessages);
    if (!context) {
      throw new Error(`Cannot resume session: ID ${sessionId} does not exist`);
    }
    this.activeSessionId = sessionId;
    console.log(`[BrainService] 📖 Resumed session: "${context.session.title}" with ${context.messages.length} messages and ${context.artifacts.length} artifacts`);
    return context;
  }

  public getConversationContext(sessionId?: string, maxMessages = 40): ConversationHistoryContext | null {
    const targetId = sessionId || this.getActiveSessionId();
    return this.conversation.getConversationContext(targetId, maxMessages);
  }

  // ==========================================
  // Message Logging
  // ==========================================

  public recordUserMessage(content: string, options?: { sessionId?: string; metadata?: Record<string, any> }): ChatMessage {
    const sessionId = options?.sessionId || this.getActiveSessionId();
    return this.conversation.addMessage({
      sessionId,
      role: 'user',
      content,
      metadata: options?.metadata,
    });
  }

  public recordAssistantMessage(
    content: string,
    options?: {
      sessionId?: string;
      verbalSummary?: string;
      emotion?: string;
      modelName?: string;
      tokensUsed?: number;
      metadata?: Record<string, any>;
      artifacts?: Array<Omit<BrainArtifact, 'id' | 'sessionId' | 'createdAt'>>;
    }
  ): ChatMessage {
    const sessionId = options?.sessionId || this.getActiveSessionId();
    return this.conversation.addMessage({
      sessionId,
      role: 'assistant',
      content,
      verbalSummary: options?.verbalSummary,
      emotion: options?.emotion,
      modelName: options?.modelName,
      tokensUsed: options?.tokensUsed,
      metadata: options?.metadata,
      artifacts: options?.artifacts,
    });
  }

  public getMessages(sessionId?: string, limit = 100): ChatMessage[] {
    const targetId = sessionId || this.getActiveSessionId();
    return this.conversation.getMessages(targetId, limit);
  }

  // ==========================================
  // Artifact Persistence (Images, Code, 3D Models)
  // ==========================================

  /**
   * Records an uploaded reference image (blueprints, reference photos, webcam captures)
   */
  public recordUploadedImage(
    name: string,
    filePath: string,
    options?: { sessionId?: string; messageId?: string; metadata?: Record<string, any> }
  ): BrainArtifact {
    return this.artifacts.saveArtifact({
      sessionId: options?.sessionId || this.getActiveSessionId(),
      messageId: options?.messageId,
      type: 'image_uploaded',
      name,
      filePath,
      mimeType: this.guessMimeType(filePath, 'image/jpeg'),
      metadata: options?.metadata || {},
    });
  }

  /**
   * Records an AI-generated image
   */
  public recordCreatedImage(
    name: string,
    filePath: string,
    prompt?: string,
    options?: { sessionId?: string; messageId?: string; metadata?: Record<string, any> }
  ): BrainArtifact {
    return this.artifacts.saveArtifact({
      sessionId: options?.sessionId || this.getActiveSessionId(),
      messageId: options?.messageId,
      type: 'image_created',
      name,
      filePath,
      mimeType: this.guessMimeType(filePath, 'image/png'),
      metadata: { ...(options?.metadata || {}), prompt },
    });
  }

  /**
   * Records created code (Python, C, C++, TypeScript, etc.)
   */
  public recordCreatedCode(
    name: string,
    content: string,
    language: string = 'text',
    options?: { sessionId?: string; messageId?: string; filePath?: string; metadata?: Record<string, any> }
  ): BrainArtifact {
    return this.artifacts.saveArtifact({
      sessionId: options?.sessionId || this.getActiveSessionId(),
      messageId: options?.messageId,
      type: 'code_created',
      name,
      filePath: options?.filePath,
      content,
      mimeType: `text/x-${language}`,
      metadata: { ...(options?.metadata || {}), language },
    });
  }

  /**
   * Records a synthesized 3D model (.blend, .obj, .glb, .stl)
   */
  public recordCreated3DModel(
    name: string,
    filePath: string,
    format: 'blend' | 'obj' | 'glb' | 'gltf' | 'stl',
    prompt?: string,
    options?: { sessionId?: string; messageId?: string; metadata?: Record<string, any> }
  ): BrainArtifact {
    return this.artifacts.saveArtifact({
      sessionId: options?.sessionId || this.getActiveSessionId(),
      messageId: options?.messageId,
      type: '3d_model_created',
      name,
      filePath,
      mimeType: this.guess3DMimeType(format),
      metadata: { ...(options?.metadata || {}), format, prompt },
    });
  }

  /**
   * Records an uploaded reference 3D model (CAD, STEP, OBJ, STL)
   */
  public recordUploaded3DModel(
    name: string,
    filePath: string,
    format: string,
    options?: { sessionId?: string; messageId?: string; metadata?: Record<string, any> }
  ): BrainArtifact {
    return this.artifacts.saveArtifact({
      sessionId: options?.sessionId || this.getActiveSessionId(),
      messageId: options?.messageId,
      type: '3d_model_uploaded',
      name,
      filePath,
      mimeType: this.guess3DMimeType(format),
      metadata: { ...(options?.metadata || {}), format },
    });
  }

  public getArtifact(id: string): BrainArtifact | null {
    return this.artifacts.getArtifact(id);
  }

  public listArtifactsForSession(sessionId?: string, type?: ArtifactType): BrainArtifact[] {
    const targetId = sessionId || this.getActiveSessionId();
    return this.artifacts.getArtifactsForSession(targetId, type);
  }

  public listRecentArtifacts(type?: ArtifactType, limit = 50): BrainArtifact[] {
    return this.artifacts.listRecentArtifacts(type, limit);
  }

  public deleteArtifact(id: string): boolean {
    return this.artifacts.deleteArtifact(id);
  }

  // ==========================================
  // Statistics and Health Check
  // ==========================================

  public getStats(): {
    totalSessions: number;
    totalMessages: number;
    totalArtifacts: number;
    artifactsByType: Record<string, number>;
    dbPath: string;
  } {
    const sessionCount = this.db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM sessions`)?.count || 0;
    const messageCount = this.db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM messages`)?.count || 0;
    const artifactCount = this.db.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM artifacts`)?.count || 0;

    const typeRows = this.db.queryAll<{ type: string; count: number }>(
      `SELECT type, COUNT(*) as count FROM artifacts GROUP BY type`
    );

    const artifactsByType: Record<string, number> = {};
    for (const row of typeRows) {
      artifactsByType[row.type] = row.count;
    }

    return {
      totalSessions: sessionCount,
      totalMessages: messageCount,
      totalArtifacts: artifactCount,
      artifactsByType,
      dbPath: this.db.getDbPath(),
    };
  }

  private guessMimeType(filePath: string, fallback: string): string {
    if (filePath.endsWith('.png')) return 'image/png';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
    if (filePath.endsWith('.webp')) return 'image/webp';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    return fallback;
  }

  private guess3DMimeType(format: string): string {
    const fmt = format.toLowerCase();
    switch (fmt) {
      case 'blend':
        return 'application/x-blender';
      case 'glb':
        return 'model/gltf-binary';
      case 'gltf':
        return 'model/gltf+json';
      case 'obj':
        return 'model/obj';
      case 'stl':
        return 'model/stl';
      default:
        return 'application/octet-stream';
    }
  }
}

export const brainService = new BrainService();
