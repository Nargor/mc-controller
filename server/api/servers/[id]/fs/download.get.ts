import AdmZip from 'adm-zip'
import { existsSync, readFileSync, statSync } from 'fs'
import { basename, join, resolve } from 'path'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const q    = getQuery(event) as any
  const base = getServerDataPath(id)

  let paths: string[] = Array.isArray(q.paths) ? q.paths : q.paths ? [q.paths] : q.path ? [q.path] : []
  if (!paths.length) throw createError({ statusCode: 400, statusMessage: 'No path provided' })

  // Single file → direct download
  if (paths.length === 1) {
    const file = safeServerPath(base, paths[0])
    if (existsSync(file) && statSync(file).isFile()) {
      setHeader(event, 'Content-Disposition', `attachment; filename="${basename(file)}"`)
      setHeader(event, 'Content-Type', 'application/octet-stream')
      return readFileSync(file)
    }
  }

  // Multiple / folder → zip
  const zip = new AdmZip()
  for (const p of paths) {
    try {
      const target = safeServerPath(base, p)
      if (!existsSync(target)) continue
      if (statSync(target).isDirectory()) zip.addLocalFolder(target, basename(target))
      else zip.addLocalFile(target)
    } catch {}
  }
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', 'attachment; filename="download.zip"')
  return zip.toBuffer()
})
