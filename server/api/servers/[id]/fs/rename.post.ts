import { renameSync, existsSync, mkdirSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const from = safeServerPath(base, body.from || '')
  const to   = safeServerPath(base, body.to || '')
  if (!existsSync(from)) throw createError({ statusCode: 404, statusMessage: 'Source not found' })
  if (existsSync(to))    throw createError({ statusCode: 409, statusMessage: 'Destination exists' })
  mkdirSync(dirname(to), { recursive: true })
  renameSync(from, to)
  return { success: true }
})
