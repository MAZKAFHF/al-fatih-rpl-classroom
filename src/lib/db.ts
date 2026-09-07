import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "classroom.db");
const STORAGE_DIR = path.join(process.cwd(), "storage", "materials");

let db: any | null = null;

function createWrapper(native: any) {
  return {
    exec(sql: string) {
      return native.exec(sql);
    },
    pragma(stmt: string) {
      try {
        native.exec(`PRAGMA ${stmt}`);
      } catch {}
    },
    prepare(sql: string) {
      const stmt = native.prepare(sql);
      return {
        get: (...params: any[]) => {
          try {
            return stmt.get(...params) as any;
          } catch (e) {
            // fallback for statements that are not SELECT? node:sqlite get only for select
            return undefined;
          }
        },
        all: (...params: any[]) => {
          try {
            return stmt.all(...params) as any;
          } catch {
            return [];
          }
        },
        run: (...params: any[]) => {
          try {
            const r = stmt.run(...params) as any;
            return r;
          } catch (e) {
            throw e;
          }
        },
      };
    },
    close() {
      try {
        native.close();
      } catch {}
    },
  };
}

export function getDb(): any {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const native = new DatabaseSync(DB_PATH);
  // enable WAL and FK like before
  try {
    native.exec("PRAGMA journal_mode=WAL");
  } catch {}
  try {
    native.exec("PRAGMA foreign_keys=ON");
  } catch {}
  db = createWrapper(native);
  initSchema(db);
  return db;
}

function initSchema(database: any) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','TEACHER','STUDENT')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classroom_sessions (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('active','ended')),
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS classroom_members (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      user_id TEXT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      left_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      sender_id TEXT,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      teacher_id TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      uploaded_by TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS raised_hands (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      cleared_at TEXT
    );
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const row = database.prepare("SELECT COUNT(*) as c FROM system_settings").get() as { c: number };
  if (row.c === 0) {
    const insert = database.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
    insert.run("school_name", "AL-FATIH RPL");
    insert.run("max_students", "40");
    insert.run("max_file_size_mb", "50");
    insert.run("session_timeout_hours", "24");
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateClassroomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  const prefixes = ["RPL", "KLS", "CLS"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}-${suffix}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function closeDb() {
  if (db) {
    try {
      db.close();
    } catch {}
    db = null;
  }
}
