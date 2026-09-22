import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve, join } from 'path'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const file = safeJoin(base, body.path || '')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body.content || '', 'utf8')
  return { success: true }
})

function safeJoin(base: string, rel: string): string {
  const safe = rel.replace(/\.\./g, '').replace(/^\/+/, '')
  const out  = resolve(join(base, safe))
  if (!out.startsWith(base)) throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return out
}
