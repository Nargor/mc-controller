import Docker from 'dockerode'
import { resolve, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let _docker: Docker | null = null

export function getDocker(): Docker {
  if (!_docker) {
    const config = useRuntimeConfig()
    const socketPath = config.dockerSocket || process.env.DOCKER_SOCKET || '/var/run/docker.sock'
    try {
      _docker = new Docker({ socketPath })
    } catch {
      _docker = new Docker({ host: '127.0.0.1', port: 2375 })
    }
  }
  return _docker
}

// Convenience alias
export const docker = {
  get instance() { return getDocker() },
  getContainer: (id: string) => getDocker().getContainer(id),
}

export function getServerDataPath(serverId: string): string {
  const config = useRuntimeConfig()
  const base = config.mcDataPath || process.env.MC_DATA_PATH || './data/servers'
  const dir = resolve(join(base, serverId))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** The Docker daemon resolves bind sources on its host, not inside this app container. */
export function getServerHostDataPath(serverId: string): string {
  const config = useRuntimeConfig()
  const base = config.mcDataHostPath || config.mcDataPath || process.env.MC_DATA_PATH || './data/servers'
  return resolve(join(base, serverId))
}

type McServerType = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'paper' | 'spigot' | 'bukkit' | 'curseforge'

const TYPE_MAP: Record<McServerType, string> = {
  vanilla:    'VANILLA',
  fabric:     'FABRIC',
  forge:      'FORGE',
  neoforge:   'NEOFORGE',
  paper:      'PAPER',
  spigot:     'SPIGOT',
  bukkit:     'BUKKIT',
  curseforge: 'AUTO_CURSEFORGE',
}

export async function createServerContainer(server: any): Promise<Docker.Container> {
  const d = getDocker()
  getServerDataPath(server.id)
  const hostDataPath = getServerHostDataPath(server.id)
  const config = useRuntimeConfig()

  const envVars: string[] = [
    'EULA=TRUE',
    `TYPE=${TYPE_MAP[server.type as McServerType] || 'VANILLA'}`,
    `VERSION=${server.mc_version}`,
    `MEMORY=${server.memory_mb}M`,
    `MAX_PLAYERS=${server.max_players}`,
    `MOTD=${server.motd}`,
    `DIFFICULTY=${server.difficulty}`,
    `MODE=${server.gamemode}`,
    `ONLINE_MODE=${server.online_mode ? 'true' : 'false'}`,
    `ENABLE_WHITELIST=${server.whitelist ? 'TRUE' : 'FALSE'}`,
    'USE_AIKAR_FLAGS=true',
    'ENABLE_RCON=true',
    'RCON_PASSWORD=mccontroller',
    'RCON_PORT=25575',
  ]

  if (server.type === 'fabric' && server.loader_version)   envVars.push(`FABRIC_LOADER_VERSION=${server.loader_version}`)
  if (server.type === 'forge' && server.loader_version)    envVars.push(`FORGE_VERSION=${server.loader_version}`)
  if (server.type === 'neoforge' && server.loader_version) envVars.push(`NEOFORGE_VERSION=${server.loader_version}`)
  if (server.type === 'curseforge') {
    if (server.modpack_id) envVars.push(`CF_SLUG=${server.modpack_id}`)
    if (config.curseforgeApiKey) envVars.push(`CF_API_KEY=${config.curseforgeApiKey}`)
  }

  // Remove existing container
  try { await d.getContainer(`mc-${server.id}`).remove({ force: true }) } catch {}

  return d.createContainer({
    name: `mc-${server.id}`,
    Image: 'itzg/minecraft-server:latest',
    Env: envVars,
    ExposedPorts: { '25565/tcp': {}, '25575/tcp': {} },
    HostConfig: {
      PortBindings: { '25565/tcp': [{ HostPort: server.port.toString() }] },
      Binds: [`${hostDataPath}:/data`],
      Memory: Math.max(256, Number(server.memory_mb) || 1024) * 1024 * 1024,
      RestartPolicy: { Name: 'unless-stopped' },
    },
  })
}

export async function getContainerStats(containerId: string): Promise<{ cpuPercent: number; memoryMB: number }> {
  try {
    const stats = await getDocker().getContainer(containerId).stats({ stream: false }) as any
    const cpuDelta    = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0)
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0)
    const numCpus     = stats.cpu_stats.online_cpus || 1
    const cpuPercent  = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0
    const memoryMB    = (stats.memory_stats.usage || 0) / (1024 * 1024)
    return { cpuPercent: Math.round(cpuPercent * 10) / 10, memoryMB: Math.round(memoryMB) }
  } catch {
    return { cpuPercent: 0, memoryMB: 0 }
  }
}

export async function syncContainerStatus(containerId: string): Promise<string> {
  try {
    const info = await getDocker().getContainer(containerId).inspect()
    if (info.State.Running) return 'running'
    return 'stopped'
  } catch {
    return 'stopped'
  }
}
