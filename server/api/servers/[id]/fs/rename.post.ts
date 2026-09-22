import { renameSync, existsSync, mkdirSync } from 'fs'
import { resolve, join, dirname } from 'path'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const from = safeJoin(base, body.from || '')
  const to   = safeJoin(base, body.to || '')
  if (!existsSync(from)) throw createError({ statusCode: 404, statusMessage: 'Source not found' })
  if (existsSync(to))    throw createError({ statusCode: 409, statusMessage: 'Destination exists' })
  mkdirSync(dirname(to), { recursive: true })
  renameSync(from, to)
  return { success: true }
})

function safeJoin(base: string, rel: string): string {
  const safe = rel.replace(/\.\./g, '').replace(/^\/+/, '')
  const out  = resolve(join(base, safe))
  if (!out.startsWith(base)) throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return out
}
