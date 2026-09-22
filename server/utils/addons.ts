import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'

export type AddonKind = 'mod' | 'plugin'

const capabilities: Record<string, AddonKind[]> = {
  fabric: ['mod'], forge: ['mod'], neoforge: ['mod'], curseforge: ['mod'],
  paper: ['plugin'], spigot: ['plugin'], bukkit: ['plugin'],
}

export function supportsAddons(type: string, kind: AddonKind): boolean {
  return capabilities[type]?.includes(kind) || false
}

export async function getAddonServer(id: string, kind: AddonKind): Promise<any> {
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })
  if (!supportsAddons(server.type, kind)) throw createError({ statusCode: 400, statusMessage: `This server type does not support ${kind}s` })
  return server
}

export function getAddonDirectory(server: any, kind: AddonKind): string {
  const directory = join(getServerDataPath(server.id), kind === 'mod' ? 'mods' : 'plugins')
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
  return directory
}

type InstalledAddon = { file: string; projectId?: string; title?: string; version?: string; source?: string }
type AddonManifest = Record<string, Omit<InstalledAddon, 'file'>>

function manifestPath(directory: string) { return join(directory, '.mc-controller-addons.json') }

function readManifest(directory: string): AddonManifest {
  try { return JSON.parse(readFileSync(manifestPath(directory), 'utf8')) as AddonManifest }
  catch { return {} }
}

function saveManifest(directory: string, manifest: AddonManifest): void {
  writeFileSync(manifestPath(directory), JSON.stringify(manifest, null, 2))
}

export function listInstalledAddons(server: any, kind: AddonKind): InstalledAddon[] {
  const directory = getAddonDirectory(server, kind)
  const manifest = readManifest(directory)
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(jar|zip)$/i.test(entry.name))
    .map(entry => ({ file: entry.name, ...manifest[entry.name] }))
    .sort((a, b) => a.file.localeCompare(b.file))
}

function loaderFor(server: any): string | null {
  if (server.type === 'curseforge') return null
  return ['fabric', 'forge', 'neoforge', 'paper', 'spigot', 'bukkit'].includes(server.type) ? server.type : null
}

async function modrinthJson(path: string): Promise<any> {
  const response = await fetch(`https://api.modrinth.com/v2${path}`, { headers: { 'User-Agent': 'MC-Controller/1.0' } })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: `Modrinth request failed (${response.status})` })
  return response.json()
}

export async function searchModrinth(server: any, kind: AddonKind, query: string): Promise<any[]> {
  if (query.length > 100) throw createError({ statusCode: 400, statusMessage: 'Search text is too long' })
  const params = new URLSearchParams({ query, limit: '24', index: 'relevance', facets: JSON.stringify([[`project_type:${kind}`]]) })
  const result = await modrinthJson(`/search?${params}`)
  return (result.hits || []).map((hit: any) => ({
    id: hit.project_id, slug: hit.slug, title: hit.title, description: hit.description,
    iconUrl: hit.icon_url, downloads: hit.downloads, categories: hit.categories || [],
  }))
}

export async function getModrinthVersions(server: any, projectId: string): Promise<any[]> {
  validateModrinthId(projectId, 'project')
  const params = new URLSearchParams({ game_versions: JSON.stringify([server.mc_version]) })
  const loader = loaderFor(server)
  if (loader) params.set('loaders', JSON.stringify([loader]))
  let versions = await modrinthJson(`/project/${encodeURIComponent(projectId)}/version?${params}`)
  // Older plugins sometimes omit loader metadata. Fall back to MC version only.
  if (!versions.length && loader) versions = await modrinthJson(`/project/${encodeURIComponent(projectId)}/version?game_versions=${encodeURIComponent(JSON.stringify([server.mc_version]))}`)
  return versions.map((version: any) => ({
    id: version.id, projectId: version.project_id, name: version.name, number: version.version_number,
    type: version.version_type, published: version.date_published, files: (version.files || []).map((file: any) => ({ name: file.filename, primary: file.primary })),
  }))
}

export async function installModrinthAddon(server: any, kind: AddonKind, projectId: string, versionId: string): Promise<InstalledAddon> {
  validateModrinthId(projectId, 'project')
  validateModrinthId(versionId, 'version')
  const version = await modrinthJson(`/version/${encodeURIComponent(versionId)}`)
  if (version.project_id !== projectId) throw createError({ statusCode: 400, statusMessage: 'Selected version does not belong to this project' })
  const file = version.files?.find((item: any) => item.primary) || version.files?.[0]
  if (!file?.url || !file?.filename) throw createError({ statusCode: 400, statusMessage: 'Selected version has no downloadable file' })
  const directory = getAddonDirectory(server, kind)
  const fileName = basename(file.filename)
  if (!/^[^\\/\0\r\n]{1,255}\.(jar|zip)$/i.test(fileName))
    throw createError({ statusCode: 400, statusMessage: 'Modrinth returned an invalid addon file name' })
  const target = join(directory, fileName)
  if (existsSync(target)) throw createError({ statusCode: 409, statusMessage: `${fileName} is already installed` })
  let url: URL
  try { url = new URL(file.url) } catch { throw createError({ statusCode: 502, statusMessage: 'Modrinth returned an invalid download URL' }) }
  if (url.protocol !== 'https:') throw createError({ statusCode: 502, statusMessage: 'Addon download must use HTTPS' })
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: `Unable to download ${fileName}` })
  const size = Number(response.headers.get('content-length') || 0)
  if (size > 512 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Addon is larger than 512 MB' })
  const contents = Buffer.from(await response.arrayBuffer())
  if (contents.length > 512 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Addon is larger than 512 MB' })
  const expectedHash = file.hashes?.sha512 || file.hashes?.sha1
  if (expectedHash) {
    const algorithm = file.hashes.sha512 ? 'sha512' : 'sha1'
    if (createHash(algorithm).update(contents).digest('hex') !== expectedHash)
      throw createError({ statusCode: 502, statusMessage: 'Addon checksum verification failed' })
  }
  writeFileSync(target, contents)
  const manifest = readManifest(directory)
  manifest[fileName] = { projectId, title: version.name, version: version.version_number, source: 'Modrinth' }
  saveManifest(directory, manifest)
  return { file: fileName, ...manifest[fileName] }
}

export function deleteInstalledAddon(server: any, kind: AddonKind, requestedFile: string): void {
  const file = basename(requestedFile)
  if (file !== requestedFile || !/\.(jar|zip)$/i.test(file)) throw createError({ statusCode: 400, statusMessage: 'Invalid addon file' })
  const directory = getAddonDirectory(server, kind)
  const target = join(directory, file)
  if (!existsSync(target)) throw createError({ statusCode: 404, statusMessage: 'Addon file not found' })
  unlinkSync(target)
  const manifest = readManifest(directory)
  delete manifest[file]
  saveManifest(directory, manifest)
}

function validateModrinthId(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw createError({ statusCode: 400, statusMessage: `Invalid Modrinth ${label} ID` })
}
