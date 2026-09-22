import { createClient, type Client } from '@libsql/client'
import { resolve } from 'path'
import { mkdirSync, existsSync } from 'fs'

let _db: Client | null = null

export function getDb(): Client {
  if (!_db) {
    const config = useRuntimeConfig()
    const dbPath = config.databasePath || process.env.DATABASE_PATH || './data/mc-controller.db'
    const absPath = resolve(dbPath)
    const dbDir = resolve(absPath, '..')
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })
    _db = createClient({ url: `file:${absPath}` })
  }
  return _db
}

export async function initDb(): Promise<void> {
  const db = getDb()
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      mc_version TEXT NOT NULL,
      loader_version TEXT,
      modpack_id TEXT,
      modpack_name TEXT,
      port INTEGER UNIQUE NOT NULL,
      max_players INTEGER DEFAULT 20,
      memory_mb INTEGER DEFAULT 1024,
      motd TEXT DEFAULT 'A Minecraft Server',
      difficulty TEXT DEFAULT 'normal',
      gamemode TEXT DEFAULT 'survival',
      whitelist INTEGER DEFAULT 0,
      online_mode INTEGER DEFAULT 1,
      status TEXT DEFAULT 'stopped',
      container_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

export async function dbQuery<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  const result = await getDb().execute({ sql, args })
  return result.rows as unknown as T[]
}

export async function dbQueryOne<T = any>(sql: string, args: any[] = []): Promise<T | null> {
  const rows = await dbQuery<T>(sql, args)
  return rows[0] ?? null
}

export async function dbExec(sql: string, args: any[] = []): Promise<void> {
  await getDb().execute({ sql, args })
}
