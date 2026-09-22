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
  const minecraftBinding: Record<string, string> = { HostPort: server.port.toString() }
  if (config.mcBindIp) minecraftBinding.HostIp = config.mcBindIp

  const envVars: string[] = [
    'EULA=TRUE',
    `TYPE=${TYPE_MAP[server.type as McServerType] || 'VANILLA'}`,
    `VERSION=${server.mc_version}`,
    `UID=${Number.isInteger(Number(server.linux_uid)) ? Number(server.linux_uid) : 1000}`,
    `GID=${Number.isInteger(Number(server.linux_gid)) ? Number(server.linux_gid) : 1000}`,
    `INIT_MEMORY=${Math.max(256, Number(server.initial_memory_mb) || 1024)}M`,
    `MEMORY=${server.memory_mb}M`,
    `MAX_PLAYERS=${server.max_players}`,
    `MOTD=${server.motd}`,
    `DIFFICULTY=${server.difficulty}`,
    `MODE=${server.gamemode}`,
    `ONLINE_MODE=${server.online_mode ? 'true' : 'false'}`,
    `ENABLE_WHITELIST=${server.whitelist ? 'TRUE' : 'FALSE'}`,
    `PVP=${server.pvp ? 'true' : 'false'}`,
    `LEVEL_SEED=${server.world_seed || ''}`,
    `LEVEL_TYPE=${server.world_type || 'normal'}`,
    `VIEW_DISTANCE=${server.view_distance || 10}`,
    `SIMULATION_DISTANCE=${server.simulation_distance || 10}`,
    `ENABLE_COMMAND_BLOCK=${server.enable_command_blocks ? 'true' : 'false'}`,
    `PLAYER_IDLE_TIMEOUT=${server.player_idle_timeout || 0}`,
    `PREVENT_PROXY_CONNECTIONS=${server.prevent_proxy_connections ? 'true' : 'false'}`,
    `OPS=${server.op_names || ''}`,
    `OP_PERMISSION_LEVEL=${server.op_permission_level || 4}`,
    `ALLOW_FLIGHT=${server.allow_flight ? 'true' : 'false'}`,
    `CURSEFORGE_FILES=${server.curseforge_files || ''}`,
    `MODRINTH_PROJECTS=${server.modrinth_projects || ''}`,
    `MODRINTH_DOWNLOAD_DEPENDENCIES=${server.modrinth_download_dependencies || 'none'}`,
    `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE=${server.modrinth_default_version_type || 'release'}`,
    `USE_AIKAR_FLAGS=${server.aikar_flags ? 'true' : 'false'}`,
    `ENABLE_JMX=${server.jmx_enabled ? 'true' : 'false'}`,
    `JVM_OPTS=${server.jvm_options || ''}`,
    `JVM_XX_OPTS=${server.jvm_xx_options || ''}`,
    `JVM_DD_OPTS=${server.system_properties || ''}`,
    `EXTRA_ARGS=${server.additional_arguments || ''}`,
    `TZ=${server.timezone || 'UTC'}`,
    `ENABLE_AUTOSTOP=${server.auto_stop_enabled ? 'TRUE' : 'FALSE'}`,
    `ENABLE_AUTOPAUSE=${server.auto_pause_enabled ? 'TRUE' : 'FALSE'}`,
    `AUTOSTOP_TIMEOUT_INIT=${server.initial_timeout_seconds || 0}`,
    `AUTOSTOP_TIMEOUT_EST=${server.established_timeout_seconds || 0}`,
    `AUTOPAUSE_TIMEOUT_INIT=${server.initial_timeout_seconds || 0}`,
    `AUTOPAUSE_TIMEOUT_EST=${server.established_timeout_seconds || 0}`,
    `AUTOPAUSE_KNOCK_INTERFACE=${server.reconnect_interface || 'eth0'}`,
    `ENABLE_ROLLING_LOGS=${server.rolling_logs ? 'true' : 'false'}`,
    'ENABLE_RCON=true',
    'RCON_PASSWORD=mccontroller',
    'RCON_PORT=25575',
  ]

  if (server.type === 'fabric' && server.loader_version)   envVars.push(`FABRIC_LOADER_VERSION=${server.loader_version}`)
  if (server.type === 'fabric' && server.fabric_launcher_version) envVars.push(`FABRIC_LAUNCHER_VERSION=${server.fabric_launcher_version}`)
  if (server.type === 'forge' && server.loader_version)    envVars.push(`FORGE_VERSION=${server.loader_version}`)
  if (server.type === 'neoforge' && server.loader_version) envVars.push(`NEOFORGE_VERSION=${server.loader_version}`)
  if (server.type === 'curseforge') {
    if (server.modpack_id) envVars.push(`CF_SLUG=${server.modpack_id}`)
  }
  // Required by Auto CurseForge and by CURSEFORGE_FILES. The value remains
  // server-only and is never returned by the browser API.
  if (config.curseforgeApiKey && (server.type === 'curseforge' || server.curseforge_files)) envVars.push(`CF_API_KEY=${config.curseforgeApiKey}`)

  // Remove existing container
  try { await d.getContainer(`mc-${server.id}`).remove({ force: true }) } catch {}

  return d.createContainer({
    name: `mc-${server.id}`,
    Image: 'itzg/minecraft-server:latest',
    Env: envVars,
    ExposedPorts: { '25565/tcp': {}, '25575/tcp': {} },
    HostConfig: {
      PortBindings: { '25565/tcp': [minecraftBinding] },
      Binds: [`${hostDataPath}:/data`],
      Memory: Math.max(256, Number(server.memory_mb) || 1024) * 1024 * 1024,
      MemoryReservation: Math.max(0, Number(server.memory_reservation_mb) || 0) * 1024 * 1024,
      // Docker expresses an upper CPU limit as quota per 100ms period; a
      // reservation maps to relative CPU shares when no hard cap is required.
      CpuPeriod: (Number(server.cpu_limit) || Number(server.cpu_reservation)) > 0 ? 100_000 : 0,
      CpuQuota: Number(server.cpu_limit) > 0 ? Math.round(Number(server.cpu_limit) * 100_000) : 0,
      CpuShares: Number(server.cpu_reservation) > 0 ? Math.max(2, Math.round(Number(server.cpu_reservation) * 1024)) : 0,
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
