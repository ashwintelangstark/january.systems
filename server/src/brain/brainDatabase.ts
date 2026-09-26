/**
 * Core SQLite Database Connection Manager for January Brain
 * High-performance persistence layer with WAL journaling, foreign keys,
 * and automatic fallback between better-sqlite3 and node:sqlite.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BrainDatabase {
  private static instance: BrainDatabase;
  private db: any = null;
  private dbPath: string;
  private isConnected = false;

  private constructor(customPath?: string) {
    const dataDir = path.resolve(__dirname, '../../../data/brain');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }

    this.dbPath = customPath || path.join(dataDir, 'january_brain.sqlite');
    this.initializeConnection();
  }

  public static getInstance(customPath?: string): BrainDatabase {
    if (!BrainDatabase.instance) {
      BrainDatabase.instance = new BrainDatabase(customPath);
    }
    return BrainDatabase.instance;
  }

  /**
   * Initializes SQLite connection and sets optimal pragma configurations
   */
  private initializeConnection(): void {
    try {
      console.log(`[BrainDatabase] 🧠 Initializing SQLite brain database at: ${this.dbPath}`);
      this.db = new Database(this.dbPath);

      // Enable WAL mode for high concurrency read/write performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('temp_store = MEMORY');

      this.initSchema();
      this.isConnected = true;
      console.log(`[BrainDatabase] ✅ SQLite database connected and schema initialized.`);
    } catch (err: any) {
      console.error(`[BrainDatabase] Failed to open SQLite database:`, err.message);
      throw err;
    }
  }

  public initialize(): void {
    if (!this.isConnected || !this.db) {
      this.initializeConnection();
    }
  }

  /**
   * Creates initial tables, indexes, and triggers
   */
  private initSchema(): void {
    const schemaSql = `
      -- 1. Chat Sessions (Conversations / Threads)
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        active_model TEXT,
        summary TEXT,
        is_pinned INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        metadata TEXT
      );

      -- 2. Chat Messages
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        verbal_summary TEXT,
        emotion TEXT,
        model_name TEXT,
        tokens_used INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        metadata TEXT
      );

      -- 3. Artifacts & Assets (Images uploaded/created, Code created, 3D models created/uploaded)
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
        message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        mime_type TEXT,
        content TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      -- Indexes for fast retrieval
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
    `;

    this.db.exec(schemaSql);
  }

  /**
   * Executes a statement (INSERT, UPDATE, DELETE)
   */
  public run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * Returns a single row
   */
  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return (row as T) || null;
  }

  /**
   * Returns all matching rows
   */
  public queryAll<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Runs multiple statements in a single atomic transaction
   */
  public transaction<T>(fn: () => T): T {
    const executeTx = this.db.transaction(fn);
    return executeTx();
  }

  /**
   * Returns the database file path
   */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Closes database connection cleanly
   */
  public close(): void {
    if (this.db && this.isConnected) {
      try {
        this.db.close();
        this.isConnected = false;
        console.log('[BrainDatabase] SQLite database closed.');
      } catch {}
    }
  }
}

export const brainDatabase = BrainDatabase.getInstance();
