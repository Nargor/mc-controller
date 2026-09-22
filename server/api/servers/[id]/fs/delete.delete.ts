import { existsSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const paths: string[] = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : [])
  for (const p of paths) {
    try {
      const target = safeServerPath(base, p)
      if (existsSync(target)) rmSync(target, { recursive: true, force: true })
    } catch {}
  }
  return { success: true, deleted: paths.length }
})
