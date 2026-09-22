import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { safeServerPath } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const base = getServerDataPath(id)
  const form = await readFormData(event)

  const destRel = (form.get('path') as string) || ''
  const files   = form.getAll('files') as File[]
  if (!files.length) throw createError({ statusCode: 400, statusMessage: 'No files provided' })

  const destDir = safeServerPath(base, destRel)
  mkdirSync(destDir, { recursive: true })

  const uploaded: string[] = []
  for (const file of files) {
    const name = String((file as any).name || 'upload').replace(/[\\/]/g, '_')
    const buf  = Buffer.from(await file.arrayBuffer())
    writeFileSync(join(destDir, name), buf)
    uploaded.push(name)
  }
  return { success: true, uploaded }
})
