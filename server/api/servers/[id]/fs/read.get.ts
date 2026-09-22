import { existsSync, statSync, readFileSync } from 'fs'
import { extname, basename, resolve, join } from 'path'

const TEXT_EXT = new Set(['.yml','.yaml','.json','.txt','.properties','.conf','.cfg','.toml','.log','.xml','.md','.sh','.ini','.mcfunction','.env','.js','.ts'])

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const { path: p } = getQuery(event) as { path?: string }
  const base = getServerDataPath(id)
  const file = safeJoin(base, p || '')
  if (!existsSync(file) || !statSync(file).isFile()) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const ext = extname(file).toLowerCase()
  if (!TEXT_EXT.has(ext)) {
    setHeader(event, 'Content-Type', 'application/octet-stream')
    setHeader(event, 'Content-Disposition', `attachment; filename="${basename(file)}"`)
    return readFileSync(file)
  }
  return { content: readFileSync(file, 'utf8'), path: p }
})

function safeJoin(base: string, rel: string): string {
  const safe = rel.replace(/\.\./g, '').replace(/^\/+/, '')
  const out  = resolve(join(base, safe))
  if (!out.startsWith(base)) throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return out
}
