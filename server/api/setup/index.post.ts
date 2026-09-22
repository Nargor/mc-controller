import { v4 as uuidv4 } from 'uuid'

export default defineEventHandler(async (event) => {
  if (!(await isFirstRun()))
    throw createError({ statusCode: 403, statusMessage: 'Setup already completed' })

  const body = await readBody(event)
  if (!body.username?.trim() || !body.password)
    throw createError({ statusCode: 400, statusMessage: 'Username and password required' })
  if (body.username.trim().length < 3)
    throw createError({ statusCode: 400, statusMessage: 'Username must be at least 3 characters' })
  if (body.password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  if (body.password !== body.confirm)
    throw createError({ statusCode: 400, statusMessage: 'Passwords do not match' })

  const id   = uuidv4()
  const hash = await hashPassword(body.password)
  await dbExec('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [id, body.username.trim(), hash, 'admin'])

  const token = await createSession(id)
  setCookie(event, 'mc_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  })
  return { success: true, username: body.username.trim() }
})
