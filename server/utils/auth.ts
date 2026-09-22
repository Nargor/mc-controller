import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(): string {
  return randomBytes(48).toString('hex')
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await dbExec('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expiresAt])
  return token
}

export async function getSessionUser(token: string): Promise<{ id: string; username: string; role: string } | null> {
  const session = await dbQueryOne<any>(
    `SELECT s.expires_at, u.id, u.username, u.role
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ?`,
    [token]
  )
  if (!session) return null
  if (new Date(session.expires_at) < new Date()) {
    await dbExec('DELETE FROM sessions WHERE token = ?', [token])
    return null
  }
  return { id: session.id, username: session.username, role: session.role }
}

export async function deleteSession(token: string): Promise<void> {
  await dbExec('DELETE FROM sessions WHERE token = ?', [token])
}

export async function isFirstRun(): Promise<boolean> {
  const row = await dbQueryOne<any>('SELECT COUNT(*) as count FROM users')
  return (Number(row?.count) ?? 0) === 0
}
