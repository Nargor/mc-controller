import { mkdirSync } from 'fs'
import { resolve, join } from 'path'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const dir  = safeJoin(base, body.path || '')
  mkdirSync(dir, { recursive: true })
  return { success: true }
})

function safeJoin(base: string, rel: string): string {
  const safe = rel.replace(/\.\./g, '').replace(/^\/+/, '')
  const out  = resolve(join(base, safe))
  if (!out.startsWith(base)) throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return out
}
