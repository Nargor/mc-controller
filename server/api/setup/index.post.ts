import { v4 as uuidv4 } from 'uuid'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'setup', 3, 15 * 60 * 1000)
  if (!(await isFirstRun()))
    throw createError({ statusCode: 403, statusMessage: 'Setup already completed' })

  const body = await readBody(event)
  if (!body.username?.trim() || !body.password)
    throw createError({ statusCode: 400, statusMessage: 'Username and password required' })
  const username = String(body.username).trim()
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username))
    throw createError({ statusCode: 400, statusMessage: 'Username must be 3–32 letters, numbers, ., _ or -' })
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 72)
    throw createError({ statusCode: 400, statusMessage: 'Password must be between 8 and 72 characters' })
  if (body.password !== body.confirm)
    throw createError({ statusCode: 400, statusMessage: 'Passwords do not match' })

  const id   = uuidv4()
  const hash = await hashPassword(body.password)
  // The condition prevents two concurrent first-run requests from creating two
  // administrators.
  await dbExec(`INSERT INTO users (id, username, password_hash, role)
    SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
    [id, username, hash, 'admin'])
  if (!(await dbQueryOne('SELECT id FROM users WHERE id = ?', [id])))
    throw createError({ statusCode: 403, statusMessage: 'Setup already completed' })

  const token = await createSession(id)
  setCookie(event, 'mc_session', token, sessionCookieOptions(event))
  return { success: true, username }
})
