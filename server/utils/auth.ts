import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

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
  // Store only a one-way digest. A copied SQLite file must not become a set
  // of usable browser session credentials.
  await dbExec('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [tokenHash(token), userId, expiresAt])
  return token
}

export async function getSessionUser(token: string): Promise<{ id: string; username: string; role: string } | null> {
  const session = await dbQueryOne<any>(
    `SELECT s.expires_at, u.id, u.username, u.role
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ?`,
    [tokenHash(token)]
  )
  if (!session) return null
  if (new Date(session.expires_at) < new Date()) {
    await dbExec('DELETE FROM sessions WHERE token = ?', [tokenHash(token)])
    return null
  }
  return { id: session.id, username: session.username, role: session.role }
}

export async function deleteSession(token: string): Promise<void> {
  await dbExec('DELETE FROM sessions WHERE token = ?', [tokenHash(token)])
}

/** Read an httpOnly session from a WebSocket upgrade request. */
export async function getWebSocketSessionUser(request: any): Promise<{ id: string; username: string; role: string } | null> {
  const headers = request?.headers
  const cookieHeader = typeof headers?.get === 'function' ? headers.get('cookie') : headers?.cookie
  const token = String(cookieHeader || '').split(';').map((item: string) => item.trim())
    .find((item: string) => item.startsWith('mc_session='))?.slice('mc_session='.length)
  if (!token) return null
  try { return await getSessionUser(decodeURIComponent(token)) } catch { return null }
}

/** Set Secure only when the current request is actually served via HTTPS. */
export function sessionCookieOptions(event: any) {
  const forwarded = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim()
  const encrypted = Boolean(event.node?.req?.socket?.encrypted)
  return {
    httpOnly: true,
    secure: forwarded === 'https' || encrypted,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  }
}

export async function isFirstRun(): Promise<boolean> {
  const row = await dbQueryOne<any>('SELECT COUNT(*) as count FROM users')
  return (Number(row?.count) ?? 0) === 0
}
