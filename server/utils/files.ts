import { isAbsolute, relative, resolve, sep } from 'path'

/** Resolve a user-provided relative path and reject traversal on every platform. */
export function safeServerPath(base: string, requested: unknown): string {
  const value = (typeof requested === 'string' ? requested : '').replace(/\\/g, '/')
  if (isAbsolute(value)) throw createError({ statusCode: 400, statusMessage: 'Path must be relative' })
  const root = resolve(base)
  const target = resolve(root, value)
  const pathFromRoot = relative(root, target)
  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot))
    throw createError({ statusCode: 400, statusMessage: 'Access denied' })
  return target
}
