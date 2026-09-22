import { existsSync, rmSync } from 'fs'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const paths: string[] = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : [])
  if (!paths.length || paths.length > 50) throw createError({ statusCode: 400, statusMessage: 'Select between 1 and 50 files or folders' })
  const targets = paths.map(p => safeServerPath(base, p))
  let deleted = 0
  for (const target of targets) {
    if (existsSync(target)) { rmSync(target, { recursive: true, force: true }); deleted++ }
  }
  return { success: true, deleted }
})
