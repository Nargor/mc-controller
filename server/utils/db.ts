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
      fabric_launcher_version TEXT DEFAULT '',
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
      pvp INTEGER DEFAULT 1,
      world_seed TEXT DEFAULT '',
      world_type TEXT DEFAULT 'normal',
      view_distance INTEGER DEFAULT 10,
      simulation_distance INTEGER DEFAULT 10,
      enable_command_blocks INTEGER DEFAULT 0,
      player_idle_timeout INTEGER DEFAULT 0,
      prevent_proxy_connections INTEGER DEFAULT 0,
      op_names TEXT DEFAULT '',
      op_permission_level INTEGER DEFAULT 4,
      allow_flight INTEGER DEFAULT 0,
      initial_memory_mb INTEGER DEFAULT 1024,
      cpu_limit REAL DEFAULT 0,
      cpu_reservation REAL DEFAULT 0,
      memory_reservation_mb INTEGER DEFAULT 0,
      linux_uid INTEGER DEFAULT 1000,
      linux_gid INTEGER DEFAULT 1000,
      aikar_flags INTEGER DEFAULT 1,
      jmx_enabled INTEGER DEFAULT 0,
      jvm_options TEXT DEFAULT '',
      jvm_xx_options TEXT DEFAULT '',
      system_properties TEXT DEFAULT '',
      additional_arguments TEXT DEFAULT '',
      timezone TEXT DEFAULT 'UTC',
      auto_stop_enabled INTEGER DEFAULT 0,
      auto_pause_enabled INTEGER DEFAULT 0,
      initial_timeout_seconds INTEGER DEFAULT 0,
      established_timeout_seconds INTEGER DEFAULT 0,
      reconnect_interface TEXT DEFAULT 'eth0',
      rolling_logs INTEGER DEFAULT 0,
      show_log_timestamps INTEGER DEFAULT 1,
      curseforge_files TEXT DEFAULT '',
      modrinth_projects TEXT DEFAULT '',
      modrinth_download_dependencies TEXT DEFAULT 'none',
      modrinth_default_version_type TEXT DEFAULT 'release',
      status TEXT DEFAULT 'stopped',
      container_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Existing installations predate these settings. SQLite cannot add several
  // columns in one statement, so run idempotent migrations after table setup.
  const additions: Array<[string, string]> = [
    ['fabric_launcher_version', "TEXT DEFAULT ''"],
    ['pvp', 'INTEGER DEFAULT 1'], ['world_seed', "TEXT DEFAULT ''"], ['world_type', "TEXT DEFAULT 'normal'"],
    ['view_distance', 'INTEGER DEFAULT 10'], ['simulation_distance', 'INTEGER DEFAULT 10'],
    ['enable_command_blocks', 'INTEGER DEFAULT 0'], ['player_idle_timeout', 'INTEGER DEFAULT 0'],
    ['prevent_proxy_connections', 'INTEGER DEFAULT 0'], ['op_names', "TEXT DEFAULT ''"],
    ['op_permission_level', 'INTEGER DEFAULT 4'], ['allow_flight', 'INTEGER DEFAULT 0'],
    ['initial_memory_mb', 'INTEGER DEFAULT 1024'], ['cpu_limit', 'REAL DEFAULT 0'], ['cpu_reservation', 'REAL DEFAULT 0'],
    ['memory_reservation_mb', 'INTEGER DEFAULT 0'], ['linux_uid', 'INTEGER DEFAULT 1000'], ['linux_gid', 'INTEGER DEFAULT 1000'],
    ['aikar_flags', 'INTEGER DEFAULT 1'], ['jmx_enabled', 'INTEGER DEFAULT 0'], ['jvm_options', "TEXT DEFAULT ''"],
    ['jvm_xx_options', "TEXT DEFAULT ''"], ['system_properties', "TEXT DEFAULT ''"], ['additional_arguments', "TEXT DEFAULT ''"],
    ['timezone', "TEXT DEFAULT 'UTC'"], ['auto_stop_enabled', 'INTEGER DEFAULT 0'], ['auto_pause_enabled', 'INTEGER DEFAULT 0'],
    ['initial_timeout_seconds', 'INTEGER DEFAULT 0'], ['established_timeout_seconds', 'INTEGER DEFAULT 0'],
    ['reconnect_interface', "TEXT DEFAULT 'eth0'"], ['rolling_logs', 'INTEGER DEFAULT 0'], ['show_log_timestamps', 'INTEGER DEFAULT 1'],
    ['curseforge_files', "TEXT DEFAULT ''"], ['modrinth_projects', "TEXT DEFAULT ''"],
    ['modrinth_download_dependencies', "TEXT DEFAULT 'none'"], ['modrinth_default_version_type', "TEXT DEFAULT 'release'"],
  ]
  const columns = await db.execute('PRAGMA table_info(servers)')
  const existing = new Set((columns.rows as any[]).map(row => row.name))
  for (const [name, definition] of additions) {
    if (!existing.has(name)) await db.execute(`ALTER TABLE servers ADD COLUMN ${name} ${definition}`)
  }
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
