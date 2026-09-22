import { mkdirSync } from 'fs'
import { resolve, join } from 'path'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const dir  = safeServerPath(base, body.path || '')
  mkdirSync(dir, { recursive: true })
  return { success: true }
})
