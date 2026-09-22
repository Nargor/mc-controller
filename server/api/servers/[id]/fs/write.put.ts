import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const file = safeServerPath(base, body.path || '')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body.content || '', 'utf8')
  return { success: true }
})
