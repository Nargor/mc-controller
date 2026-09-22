import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { safeFileName, safeServerPath } from '../../../../utils/files'

const MAX_UPLOAD_FILE_BYTES = 256 * 1024 * 1024
const MAX_UPLOAD_FILES = 50

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const base = getServerDataPath(id)
  const form = await readFormData(event)

  const destRel = (form.get('path') as string) || ''
  const files   = form.getAll('files') as File[]
  if (!files.length) throw createError({ statusCode: 400, statusMessage: 'No files provided' })
  if (files.length > MAX_UPLOAD_FILES) throw createError({ statusCode: 400, statusMessage: `Upload at most ${MAX_UPLOAD_FILES} files at a time` })

  const destDir = safeServerPath(base, destRel, { allowRoot: true })
  mkdirSync(destDir, { recursive: true })

  const uploaded: string[] = []
  for (const file of files) {
    if (!(file instanceof File) || file.size > MAX_UPLOAD_FILE_BYTES)
      throw createError({ statusCode: 400, statusMessage: 'Each uploaded file must be 256 MB or smaller' })
    const name = safeFileName(String(file.name || 'upload').replace(/[\\/]/g, '_'))
    const buf  = Buffer.from(await file.arrayBuffer())
    writeFileSync(safeServerPath(base, join(destRel, name)), buf)
    uploaded.push(name)
  }
  return { success: true, uploaded }
})
