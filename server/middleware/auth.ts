// Auto-applied to all /api/** routes
export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Nitro middleware also receives page/asset requests. Protect API routes only;
  // the client route middleware redirects unauthenticated visitors to /login.
  if (!path.startsWith('/api/')) return

  if (event.method === 'OPTIONS') return

  // Cookie sessions must never authorize a cross-origin state-changing request.
  // Requests without Origin are allowed for CLI/API users; browsers always send
  // it for JSON mutations and WebSocket upgrades are checked separately.
  if (!['GET', 'HEAD'].includes(event.method || '')) {
    const origin = getRequestHeader(event, 'origin')
    if (origin) {
      let originHost = ''
      try { originHost = new URL(origin).host } catch {
        throw createError({ statusCode: 403, statusMessage: 'Invalid request origin' })
      }
      const host = (getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '').split(',')[0].trim()
      if (!host || originHost !== host)
        throw createError({ statusCode: 403, statusMessage: 'Cross-origin request blocked' })
    }
  }

  // Public — no auth needed. Keep this exact so a future nested endpoint does
  // not accidentally become public.
  if (path === '/api/setup' || path === '/api/setup/status' || path === '/api/auth/login') return

  const token = getCookie(event, 'mc_session')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const user = await getSessionUser(token)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Session expired' })

  event.context.user = user
})
