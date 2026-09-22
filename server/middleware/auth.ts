// Auto-applied to all /api/** routes
export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Nitro middleware also receives page/asset requests. Protect API routes only;
  // the client route middleware redirects unauthenticated visitors to /login.
  if (!path.startsWith('/api/')) return

  // Public — no auth needed
  const publicPaths = ['/api/setup', '/api/setup/status', '/api/auth/login']
  if (publicPaths.some(p => path === p || path.startsWith(p + '/'))) return

  if (event.method === 'OPTIONS') return

  const token = getCookie(event, 'mc_session')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const user = await getSessionUser(token)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Session expired' })

  event.context.user = user
})
