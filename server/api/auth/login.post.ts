export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'login', 5, 15 * 60 * 1000)
  if (await isFirstRun())
    throw createError({ statusCode: 403, statusMessage: 'Please complete setup first' })

  const body = await readBody(event)
  if (!body.username || !body.password)
    throw createError({ statusCode: 400, statusMessage: 'Username and password required' })

  const username = String(body.username).trim()
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username) || typeof body.password !== 'string' || body.password.length > 72)
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })

  const user = await dbQueryOne<any>('SELECT * FROM users WHERE username = ?', [username])
  if (!user || !(await verifyPassword(body.password, user.password_hash)))
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })

  const token = await createSession(user.id)
  setCookie(event, 'mc_session', token, sessionCookieOptions(event))
  return { success: true, username: user.username, role: user.role }
})
