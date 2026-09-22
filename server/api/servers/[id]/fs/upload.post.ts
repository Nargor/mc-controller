import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')!
  const base = getServerDataPath(id)
  const form = await readFormData(event)

  const destRel = (form.get('path') as string) || ''
  const files   = form.getAll('files') as File[]
  if (!files.length) throw createError({ statusCode: 400, statusMessage: 'No files provided' })

  const destDir = safeJoin(base, destRel)
  mkdirSync(destDir, { recursive: true })

  const uploaded: string[] = []
  for (const file of files) {
    const name = (file as any).name || 'upload'
    const buf  = Buffer.from(await file.arrayBuffer())
    writeFileSync(join(destDir, name), buf)
    uploaded.push(name)
  }
  return { success: true, uploaded }
})

function safeJoin(base: string, rel: string): string {
  const safe = rel.replace(/\.\./g, '').replace(/^\/+/, '')
  const out  = resolve(join(base, safe))
  if (!out.startsWith(base)) throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return out
}
