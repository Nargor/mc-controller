import { existsSync, lstatSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

type SafePathOptions = { allowRoot?: boolean }

/** Resolve a user-provided relative path and reject traversal and symlink escapes. */
export function safeServerPath(base: string, requested: unknown, options: SafePathOptions = {}): string {
  const value = (typeof requested === 'string' ? requested : '').replace(/\\/g, '/')
  if (value.includes('\0')) throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  if (isAbsolute(value)) throw createError({ statusCode: 400, statusMessage: 'Path must be relative' })
  const root = resolve(base)
  const target = resolve(root, value)
  const pathFromRoot = relative(root, target)
  if (pathFromRoot === '' || pathFromRoot === '.') {
    if (!options.allowRoot) throw createError({ statusCode: 400, statusMessage: 'A file or directory path is required' })
    return target
  }
  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot))
    throw createError({ statusCode: 400, statusMessage: 'Path escapes the server directory' })
  assertNoSymlink(root, pathFromRoot)
  return target
}

function assertNoSymlink(root: string, pathFromRoot: string): void {
  let current = root
  for (const part of pathFromRoot.split(sep)) {
    if (!part) continue
    current = join(current, part)
    if (!existsSync(current)) continue
    if (lstatSync(current).isSymbolicLink())
      throw createError({ statusCode: 400, statusMessage: 'Symbolic links are not accessible from the file manager' })
  }
}

export function safeFileName(requested: unknown): string {
  const name = typeof requested === 'string' ? requested : ''
  if (!name || name === '.' || name === '..' || /[\\/\0\r\n]/.test(name))
    throw createError({ statusCode: 400, statusMessage: 'Invalid file name' })
  return name
}
