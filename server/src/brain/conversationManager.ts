/**
 * Conversation & Session Manager for January Brain
 * Provides persistent memory threads:
 * - Creates, resumes, searches, and archives chat conversations
 * - Loads full past discussion history so you can reopen any conversation days later
 * - Links all messages with their associated files, generated code, and 3D models
 */

import crypto from 'crypto';
import { brainDatabase, BrainDatabase } from './brainDatabase.js';
import { artifactManager, ArtifactManager } from './artifactManager.js';
import {
  ChatSession,
  ChatMessage,
  CreateSessionOptions,
  AddMessageOptions,
  ListSessionsOptions,
  ConversationHistoryContext,
} from './types.js';

export class ConversationManager {
  private db: BrainDatabase;
  private artifacts: ArtifactManager;

  constructor(db: BrainDatabase = brainDatabase, artifacts: ArtifactManager = artifactManager) {
    this.db = db;
    this.artifacts = artifacts;
  }

  /**
   * Creates a new chat session
   */
  public createSession(options?: CreateSessionOptions): ChatSession {
    const id = options?.id || crypto.randomUUID();
    const now = Date.now();
    const title = options?.title || 'New Conversation';

    const session: ChatSession = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      activeModel: options?.activeModel || 'auto',
      summary: options?.summary || '',
      isPinned: false,
      isArchived: false,
      metadata: options?.metadata || {},
    };

    const sql = `
      INSERT INTO sessions (
        id, title, created_at, updated_at, active_model, summary, is_pinned, is_archived, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.run(sql, [
      session.id,
      session.title,
      session.createdAt,
      session.updatedAt,
      session.activeModel || null,
      session.summary || null,
      0,
      0,
      JSON.stringify(session.metadata),
    ]);

    console.log(`[ConversationManager] 💬 Created new chat session: "${session.title}" (ID: ${session.id})`);
    return session;
  }

  /**
   * Retrieves a chat session by its ID
   */
  public getSession(id: string): ChatSession | null {
    const row = this.db.queryOne<any>(
      `SELECT s.*, 
              (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count,
              (SELECT COUNT(*) FROM artifacts a WHERE a.session_id = s.id) as artifact_count
       FROM sessions s WHERE s.id = ?`,
      [id]
    );
    if (!row) return null;
    return this.mapRowToSession(row);
  }

  /**
   * Lists all sessions with counts, filtering, and pagination
   */
  public listSessions(options?: ListSessionsOptions): ChatSession[] {
    let sql = `
      SELECT s.*, 
             (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count,
             (SELECT COUNT(*) FROM artifacts a WHERE a.session_id = s.id) as artifact_count
      FROM sessions s
    `;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (options?.archived !== undefined) {
      whereClauses.push(`s.is_archived = ?`);
      params.push(options.archived ? 1 : 0);
    } else {
      whereClauses.push(`s.is_archived = 0`);
    }

    if (options?.search) {
      whereClauses.push(`(s.title LIKE ? OR s.summary LIKE ?)`);
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY s.is_pinned DESC, s.updated_at DESC`;

    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
      if (options?.offset) {
        sql += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    const rows = this.db.queryAll<any>(sql, params);
    return rows.map((r) => this.mapRowToSession(r));
  }

  /**
   * Updates the title of an existing session
   */
  public updateSessionTitle(id: string, title: string): boolean {
    const res = this.db.run(
      `UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?`,
      [title, Date.now(), id]
    );
    return res.changes > 0;
  }

  /**
   * Toggles the pinned status of a session
   */
  public toggleSessionPinned(id: string, isPinned?: boolean): boolean {
    const session = this.getSession(id);
    if (!session) return false;
    const newVal = isPinned !== undefined ? (isPinned ? 1 : 0) : (session.isPinned ? 0 : 1);
    const res = this.db.run(`UPDATE sessions SET is_pinned = ?, updated_at = ? WHERE id = ?`, [newVal, Date.now(), id]);
    return res.changes > 0;
  }

  /**
   * Archives or unarchives a session
   */
  public setSessionArchived(id: string, isArchived: boolean): boolean {
    const res = this.db.run(
      `UPDATE sessions SET is_archived = ?, updated_at = ? WHERE id = ?`,
      [isArchived ? 1 : 0, Date.now(), id]
    );
    return res.changes > 0;
  }

  /**
   * Deletes a session and all its messages permanently (artifacts are unlinked or removed)
   */
  public deleteSession(id: string): boolean {
    const res = this.db.run(`DELETE FROM sessions WHERE id = ?`, [id]);
    console.log(`[ConversationManager] 🗑️ Deleted chat session: ${id}`);
    return res.changes > 0;
  }

  /**
   * Adds a message to an existing session and updates the session timestamp and title
   */
  public addMessage(options: AddMessageOptions): ChatMessage {
    const id = options.id || crypto.randomUUID();
    const now = Date.now();

    // Verify session exists or create it automatically
    let session = this.getSession(options.sessionId);
    if (!session) {
      session = this.createSession({
        id: options.sessionId,
        title: options.content.slice(0, 40) || 'New Conversation',
      });
    }

    const message: ChatMessage = {
      id,
      sessionId: options.sessionId,
      role: options.role,
      content: options.content,
      verbalSummary: options.verbalSummary,
      emotion: options.emotion,
      modelName: options.modelName,
      tokensUsed: options.tokensUsed || 0,
      createdAt: now,
      metadata: options.metadata || {},
    };

    const sql = `
      INSERT INTO messages (
        id, session_id, role, content, verbal_summary, emotion, model_name, tokens_used, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.run(sql, [
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.verbalSummary || null,
      message.emotion || null,
      message.modelName || null,
      message.tokensUsed || 0,
      message.createdAt,
      JSON.stringify(message.metadata),
    ]);

    // If this is the first user message and session has a default title, generate an appropriate title
    if (options.role === 'user' && (!session.title || session.title === 'New Conversation')) {
      const generatedTitle = options.content.replace(/\n/g, ' ').trim().slice(0, 45);
      if (generatedTitle) {
        this.updateSessionTitle(session.id, generatedTitle);
      }
    } else {
      this.db.run(`UPDATE sessions SET updated_at = ? WHERE id = ?`, [now, session.id]);
    }

    // Save any inline artifacts attached to this message
    if (options.artifacts && options.artifacts.length > 0) {
      for (const art of options.artifacts) {
        this.artifacts.saveArtifact({
          ...art,
          sessionId: message.sessionId,
          messageId: message.id,
        });
      }
    }

    return message;
  }

  /**
   * Retrieves all messages for a session in chronological order
   */
  public getMessages(sessionId: string, limit = 200): ChatMessage[] {
    const rows = this.db.queryAll<any>(
      `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`,
      [sessionId, limit]
    );

    return rows.map((r) => {
      const msg = this.mapRowToMessage(r);
      msg.artifacts = this.artifacts.getArtifactsForMessage(msg.id);
      return msg;
    });
  }

  /**
   * Loads full conversation context for continuing a discussion days later:
   * Returns session details, past messages, linked artifacts, and LLM-ready prompt history.
   */
  public getConversationContext(sessionId: string, maxMessages = 30): ConversationHistoryContext | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const messages = this.getMessages(sessionId, maxMessages);
    const artifacts = this.artifacts.getArtifactsForSession(sessionId);

    // Format prompt history for feeding directly into Gemini / OpenAI / OpenRouter
    const formattedPromptHistory = messages.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : m.role === 'assistant' ? ('assistant' as const) : ('system' as const),
      text: m.content,
    }));

    return {
      session,
      messages,
      artifacts,
      formattedPromptHistory,
    };
  }

  private mapRowToSession(row: any): ChatSession {
    let metadata = {};
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata);
      } catch {}
    }

    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activeModel: row.active_model || undefined,
      summary: row.summary || undefined,
      isPinned: Boolean(row.is_pinned),
      isArchived: Boolean(row.is_archived),
      metadata,
      messageCount: row.message_count !== undefined ? Number(row.message_count) : undefined,
      artifactCount: row.artifact_count !== undefined ? Number(row.artifact_count) : undefined,
    };
  }

  private mapRowToMessage(row: any): ChatMessage {
    let metadata = {};
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata);
      } catch {}
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      verbalSummary: row.verbal_summary || undefined,
      emotion: row.emotion || undefined,
      modelName: row.model_name || undefined,
      tokensUsed: row.tokens_used || 0,
      createdAt: row.created_at,
      metadata,
    };
  }
}

export const conversationManager = new ConversationManager();
