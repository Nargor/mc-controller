import { existsSync, statSync, readdirSync } from 'fs'
import { join } from 'path'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const { path: p } = getQuery(event) as { path?: string }
  const base = getServerDataPath(id)
  const dir  = safeServerPath(base, p || '', { allowRoot: true })
  if (!existsSync(dir)) return []
  if (!statSync(dir).isDirectory()) throw createError({ statusCode: 400, statusMessage: 'Not a directory' })

  return readdirSync(dir, { withFileTypes: true })
    .filter(e => !e.isSymbolicLink())
    .map(e => {
      let size: number | null = null, modified = ''
      try { const s = statSync(join(dir, e.name)); size = e.isFile() ? s.size : null; modified = s.mtime.toISOString() } catch {}
      return { name: e.name, type: e.isDirectory() ? 'directory' : 'file', size, modified }
    })
    .sort((a, b) => a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name.localeCompare(b.name))
})
