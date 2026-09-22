type Bucket = { attempts: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/** A small in-process guard for unauthenticated password/setup endpoints. */
export function enforceRateLimit(event: any, scope: string, maxAttempts: number, windowMs: number): void {
  const ip = event.node?.req?.socket?.remoteAddress || 'unknown'
  const key = `${scope}:${ip}`
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { attempts: 1, resetAt: now + windowMs })
    return
  }
  current.attempts++
  if (current.attempts > maxAttempts) {
    setHeader(event, 'Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Please try again later.' })
  }
}

export function isSameOriginWebSocket(request: any): boolean {
  const headers = request?.headers
  const get = (name: string) => typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]
  const origin = get('origin')
  if (!origin) return false
  try {
    const originHost = new URL(origin).host
    const host = String(get('x-forwarded-host') || get('host') || '').split(',')[0].trim()
    return Boolean(host) && originHost === host
  } catch { return false }
}
