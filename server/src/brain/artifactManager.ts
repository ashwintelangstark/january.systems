/**
 * Artifact & Asset Manager for January Brain
 * Stores, queries, and associates multimodal assets:
 * - Images uploaded for reference (webcam photos, user blueprints)
 * - Images created / generated
 * - Code files & scripts created (Python, C, C++)
 * - 3D models created (.blend, .obj, .glb)
 * - 3D models uploaded for reference (CAD, OBJ, STL)
 */

import crypto from 'crypto';
import fs from 'fs';
import { brainDatabase, BrainDatabase } from './brainDatabase.js';
import { BrainArtifact, SaveArtifactOptions, ArtifactType } from './types.js';

export class ArtifactManager {
  private db: BrainDatabase;

  constructor(db: BrainDatabase = brainDatabase) {
    this.db = db;
  }

  /**
   * Saves an artifact or asset linked to a chat session and message
   */
  public saveArtifact(options: SaveArtifactOptions): BrainArtifact {
    const id = options.id || crypto.randomUUID();
    const now = Date.now();

    // Auto-detect file size if not provided but file exists
    let fileSize = options.fileSize || 0;
    if (!fileSize && options.filePath && fs.existsSync(options.filePath)) {
      try {
        fileSize = fs.statSync(options.filePath).size;
      } catch {}
    }

    const artifact: BrainArtifact = {
      id,
      sessionId: options.sessionId,
      messageId: options.messageId,
      type: options.type,
      name: options.name,
      filePath: options.filePath,
      fileSize,
      mimeType: options.mimeType,
      content: options.content,
      metadata: options.metadata || {},
      createdAt: now,
    };

    const sql = `
      INSERT INTO artifacts (
        id, session_id, message_id, type, name,
        file_path, file_size, mime_type, content, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.run(sql, [
      artifact.id,
      artifact.sessionId || null,
      artifact.messageId || null,
      artifact.type,
      artifact.name,
      artifact.filePath || null,
      artifact.fileSize,
      artifact.mimeType || null,
      artifact.content || null,
      JSON.stringify(artifact.metadata),
      artifact.createdAt,
    ]);

    // Touch session updated_at timestamp if linked to a session
    if (artifact.sessionId) {
      this.db.run(`UPDATE sessions SET updated_at = ? WHERE id = ?`, [now, artifact.sessionId]);
    }

    console.log(`[ArtifactManager] 💾 Stored ${artifact.type} artifact: "${artifact.name}" (ID: ${artifact.id})`);
    return artifact;
  }

  /**
   * Retrieves an artifact by its ID
   */
  public getArtifact(id: string): BrainArtifact | null {
    const row = this.db.queryOne<any>(`SELECT * FROM artifacts WHERE id = ?`, [id]);
    if (!row) return null;
    return this.mapRowToArtifact(row);
  }

  /**
   * Retrieves all artifacts linked to a specific session, optionally filtered by type
   */
  public getArtifactsForSession(sessionId: string, type?: ArtifactType): BrainArtifact[] {
    let sql = `SELECT * FROM artifacts WHERE session_id = ?`;
    const params: any[] = [sessionId];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC`;
    const rows = this.db.queryAll<any>(sql, params);
    return rows.map((r) => this.mapRowToArtifact(r));
  }

  /**
   * Retrieves all artifacts linked to a specific message
   */
  public getArtifactsForMessage(messageId: string): BrainArtifact[] {
    const rows = this.db.queryAll<any>(
      `SELECT * FROM artifacts WHERE message_id = ? ORDER BY created_at ASC`,
      [messageId]
    );
    return rows.map((r) => this.mapRowToArtifact(r));
  }

  /**
   * Lists recent artifacts across all sessions filtered by type
   */
  public listRecentArtifacts(type?: ArtifactType, limit = 50): BrainArtifact[] {
    let sql = `SELECT * FROM artifacts`;
    const params: any[] = [];

    if (type) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.queryAll<any>(sql, params);
    return rows.map((r) => this.mapRowToArtifact(r));
  }

  /**
   * Deletes an artifact by ID
   */
  public deleteArtifact(id: string): boolean {
    const res = this.db.run(`DELETE FROM artifacts WHERE id = ?`, [id]);
    return res.changes > 0;
  }

  /**
   * Searches artifacts by name or metadata keyword
   */
  public searchArtifacts(query: string, type?: ArtifactType): BrainArtifact[] {
    let sql = `SELECT * FROM artifacts WHERE name LIKE ?`;
    const params: any[] = [`%${query}%`];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT 50`;
    const rows = this.db.queryAll<any>(sql, params);
    return rows.map((r) => this.mapRowToArtifact(r));
  }

  private mapRowToArtifact(row: any): BrainArtifact {
    let metadata = {};
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata);
      } catch {}
    }

    return {
      id: row.id,
      sessionId: row.session_id || undefined,
      messageId: row.message_id || undefined,
      type: row.type as ArtifactType,
      name: row.name,
      filePath: row.file_path || undefined,
      fileSize: row.file_size || 0,
      mimeType: row.mime_type || undefined,
      content: row.content || undefined,
      metadata,
      createdAt: row.created_at,
    };
  }
}

export const artifactManager = new ArtifactManager();
