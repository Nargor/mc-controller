import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { extname, dirname } from 'path'
import { safeServerPath } from '../../../../utils/files'

const MAX_ZIP_ENTRIES = 10_000
const MAX_ZIP_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const base = getServerDataPath(id)
  const file = safeServerPath(base, body.path || '')
  const dest = body.dest ? safeServerPath(base, body.dest) : dirname(file)

  if (!existsSync(file)) throw createError({ statusCode: 404, statusMessage: 'ZIP file not found' })
  if (extname(file).toLowerCase() !== '.zip') throw createError({ statusCode: 400, statusMessage: 'Not a .zip file' })

  mkdirSync(dest, { recursive: true })
  let zip: AdmZip
  try { zip = new AdmZip(file) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Invalid ZIP file' }) }
  const entries = zip.getEntries()
  if (entries.length > MAX_ZIP_ENTRIES)
    throw createError({ statusCode: 400, statusMessage: `ZIP files may contain at most ${MAX_ZIP_ENTRIES} entries` })
  const uncompressedBytes = entries.reduce((total, entry) => total + Math.max(0, Number((entry as any).header?.size) || 0), 0)
  if (uncompressedBytes > MAX_ZIP_UNCOMPRESSED_BYTES)
    throw createError({ statusCode: 400, statusMessage: 'ZIP expands to more than 1 GB' })

  // Extract explicitly instead of extractAllTo: that method follows ZIP
  // symlinks on some platforms. Every entry is also constrained to destination.
  for (const entry of entries) {
    if (!entry.entryName || entry.entryName.includes('\0')) continue
    const target = safeServerPath(dest, entry.entryName, { allowRoot: true })
    if (entry.isDirectory) {
      mkdirSync(target, { recursive: true })
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, entry.getData())
  }
  return { success: true, extractedTo: body.dest || '', entries: entries.length }
})
