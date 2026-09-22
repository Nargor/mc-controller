export default defineEventHandler(async (event) => {
  if (await isFirstRun())
    throw createError({ statusCode: 403, statusMessage: 'Please complete setup first' })

  const body = await readBody(event)
  if (!body.username || !body.password)
    throw createError({ statusCode: 400, statusMessage: 'Username and password required' })

  const user = await dbQueryOne<any>('SELECT * FROM users WHERE username = ?', [body.username.trim()])
  if (!user || !(await verifyPassword(body.password, user.password_hash)))
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })

  const token = await createSession(user.id)
  setCookie(event, 'mc_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  })
  return { success: true, username: user.username, role: user.role }
})
