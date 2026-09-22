import AdmZip from 'adm-zip'
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { safeServerPath } from '../../../../utils/files'

const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const q = getQuery(event) as any
  const base = getServerDataPath(id)
  const paths: string[] = Array.isArray(q.paths) ? q.paths : q.paths ? [q.paths] : q.path ? [q.path] : []
  if (!paths.length || paths.length > 50) throw createError({ statusCode: 400, statusMessage: 'Select between 1 and 50 files or folders' })
  const targets = paths.map(path => safeServerPath(base, path))

  // A single normal file can be returned directly, without constructing an
  // archive in memory.
  if (targets.length === 1 && existsSync(targets[0]) && lstatSync(targets[0]).isFile()) {
    const file = targets[0]
    if (lstatSync(file).size > MAX_DOWNLOAD_BYTES)
      throw createError({ statusCode: 413, statusMessage: 'Files larger than 1 GB cannot be downloaded from the panel' })
    setHeader(event, 'Content-Disposition', `attachment; filename="${basename(file).replace(/["\\r\\n]/g, '_')}"`)
    setHeader(event, 'Content-Type', 'application/octet-stream')
    return readFileSync(file)
  }

  const zip = new AdmZip()
  const counter = { bytes: 0 }
  for (const target of targets) {
    if (!existsSync(target)) throw createError({ statusCode: 404, statusMessage: 'File not found' })
    addToZip(zip, target, basename(target), counter)
  }
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', 'attachment; filename="download.zip"')
  return zip.toBuffer()
})

function addToZip(zip: AdmZip, source: string, archivePath: string, counter: { bytes: number }): void {
  const stat = lstatSync(source)
  if (stat.isSymbolicLink()) return
  if (stat.isDirectory()) {
    zip.addFile(`${archivePath}/`, Buffer.alloc(0))
    for (const entry of readdirSync(source, { withFileTypes: true }))
      addToZip(zip, join(source, entry.name), `${archivePath}/${entry.name}`, counter)
    return
  }
  if (!stat.isFile()) return
  counter.bytes += stat.size
  if (counter.bytes > MAX_DOWNLOAD_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'Selected files exceed the 1 GB download limit' })
  zip.addFile(archivePath, readFileSync(source))
}
