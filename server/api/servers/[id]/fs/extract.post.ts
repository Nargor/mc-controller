import AdmZip from 'adm-zip'
import { existsSync, mkdirSync } from 'fs'
import { extname, dirname, join, resolve } from 'path'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const file = safeJoin(base, body.path || '')
  const dest = body.dest ? safeJoin(base, body.dest) : dirname(file)

  if (!existsSync(file)) throw createError({ statusCode: 404, statusMessage: 'ZIP file not found' })
  if (extname(file).toLowerCase() !== '.zip') throw createError({ statusCode: 400, statusMessage: 'Not a .zip file' })

  mkdirSync(dest, { recursive: true })
  const zip = new AdmZip(file)
  zip.extractAllTo(dest, true)
  return { success: true, extractedTo: body.dest || '', entries: zip.getEntries().length }
})

function safeJoin(base: string, rel: string): string {
  const safe = rel.replace(/\.\./g, '').replace(/^\/+/, '')
  const out  = resolve(join(base, safe))
  if (!out.startsWith(base)) throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return out
}
