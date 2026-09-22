const cache: Record<string, { data: any; at: number }> = {}
const TTL = 10 * 60 * 1000

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  if (cache[key] && now - cache[key].at < TTL) return cache[key].data
  const data = await fn()
  cache[key] = { data, at: now }
  return data
}

export async function getVersions(type: string, query?: string): Promise<any> {
  switch (type) {
    case 'vanilla':    return getVanillaVersions()
    case 'fabric':     return getFabricVersions()
    case 'forge':      return getForgeVersions()
    case 'neoforge':   return getNeoForgeVersions()
    case 'paper':      return getPaperVersions()
    case 'spigot':
    case 'bukkit':     return getSpigotVersions()
    case 'curseforge': return getCurseForgeModpacks(query || 'popular')
    default: throw new Error(`Unknown server type: ${type}`)
  }
}

async function getVanillaVersions() {
  return cached('vanilla', async () => {
    const res  = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
    const json = await res.json() as any
    return json.versions
      .filter((v: any) => v.type === 'release' || v.type === 'snapshot')
      .map((v: any) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }))
  })
}

async function getFabricVersions() {
  return cached('fabric', async () => {
    const [gameRes, loaderRes] = await Promise.all([
      fetch('https://meta.fabricmc.net/v2/versions/game'),
      fetch('https://meta.fabricmc.net/v2/versions/loader'),
    ])
    const games   = await gameRes.json()   as any[]
    const loaders = await loaderRes.json() as any[]
    const stableLoaders = loaders.filter((l: any) => l.stable).map((l: any) => l.version).slice(0, 15)
    return games.map((g: any) => ({
      mcVersion:     g.version,
      stable:        g.stable,
      loaderVersions: g.stable ? stableLoaders : loaders.map((l: any) => l.version).slice(0, 15),
    }))
  })
}

async function getForgeVersions() {
  return cached('forge', async () => {
    const res  = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json')
    const json = await res.json() as any
    return Object.entries(json)
      .map(([mc, versions]) => ({
        mcVersion:     mc,
        forgeVersions: (versions as string[]).slice(-10).reverse(),
      }))
      .reverse()
  })
}

async function getNeoForgeVersions() {
  return cached('neoforge', async () => {
    const res  = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml')
    const text = await res.text()
    const matches = text.match(/<version>([^<]+)<\/version>/g) || []
    return matches
      .map(m => {
        const v     = m.replace(/<\/?version>/g, '')
        const parts = v.split('.')
        const mc    = parts.length >= 2 ? `1.${parts[0]}.${parts[1]}` : `1.${parts[0]}`
        return { version: v, mcVersion: mc }
      })
      .reverse()
      .slice(0, 60)
  })
}

async function getPaperVersions() {
  return cached('paper', async () => {
    const res     = await fetch('https://api.papermc.io/v2/projects/paper')
    const json    = await res.json() as any
    const versions = (json.versions as string[]).reverse().slice(0, 25)
    const results  = await Promise.allSettled(
      versions.map(async (v: string) => {
        const r = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${v}`)
        const d = await r.json() as any
        const builds: number[] = d.builds || []
        return { mcVersion: v, latestBuild: builds[builds.length - 1] || 0 }
      })
    )
    return results.filter(r => r.status === 'fulfilled').map(r => (r as any).value)
  })
}

async function getSpigotVersions(): Promise<string[]> {
  return [
    '1.21.4','1.21.3','1.21.1','1.21',
    '1.20.6','1.20.4','1.20.2','1.20.1','1.20',
    '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
    '1.18.2','1.18.1','1.18',
    '1.17.1','1.17',
    '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1',
    '1.15.2','1.15.1','1.15',
    '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
    '1.13.2','1.13.1','1.13',
    '1.12.2','1.12.1','1.12',
    '1.11.2','1.11','1.10.2','1.9.4','1.9.2','1.9','1.8.8',
  ]
}

async function getCurseForgeModpacks(query: string) {
  const config = useRuntimeConfig()
  const apiKey = config.curseforgeApiKey
  if (!apiKey) return []
  const url = `https://api.curseforge.com/v1/mods/search?gameId=432&classId=4471&searchFilter=${encodeURIComponent(query)}&pageSize=20&sortField=2&sortOrder=desc`
  const res  = await fetch(url, { headers: { 'x-api-key': apiKey } })
  if (!res.ok) return []
  const json = await res.json() as any
  return (json.data || []).map((m: any) => ({
    id:            String(m.id),
    name:          m.name,
    slug:          m.slug,
    summary:       m.summary || '',
    logoUrl:       m.logo?.url || '',
    downloadCount: m.downloadCount || 0,
    mcVersion:     m.latestFilesIndexes?.[0]?.gameVersion || '',
  }))
}
