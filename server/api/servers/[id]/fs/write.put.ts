import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { safeServerPath } from '../../../../utils/files'

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const file = safeServerPath(base, body.path || '')
  if (typeof body.content !== 'string' || Buffer.byteLength(body.content, 'utf8') > MAX_TEXT_FILE_BYTES)
    throw createError({ statusCode: 400, statusMessage: 'Text files must be 2 MB or smaller' })
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body.content, 'utf8')
  return { success: true }
})
