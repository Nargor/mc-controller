import { existsSync, rmSync } from 'fs'
import { resolve, join } from 'path'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const paths: string[] = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : [])
  for (const p of paths) {
    try {
      const target = safeJoin(base, p)
      if (existsSync(target)) rmSync(target, { recursive: true, force: true })
    } catch {}
  }
  return { success: true, deleted: paths.length }
})

function safeJoin(base: string, rel: string): string {
  const safe = rel.replace(/\.\./g, '').replace(/^\/+/, '')
  const out  = resolve(join(base, safe))
  if (!out.startsWith(base)) throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return out
}
