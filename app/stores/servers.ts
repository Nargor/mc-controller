import { defineStore } from 'pinia'

export interface Server {
  id: string; name: string; type: string; mc_version: string
  loader_version: string | null; modpack_id: string | null; modpack_name: string | null
  fabric_launcher_version: string; curseforge_files: string; modrinth_projects: string
  modrinth_download_dependencies: 'none' | 'required' | 'optional'; modrinth_default_version_type: 'release' | 'beta' | 'alpha'
  port: number; max_players: number; memory_mb: number; motd: string
  difficulty: string; gamemode: string; whitelist: number; online_mode: number
  pvp: number; world_seed: string; world_type: string; view_distance: number; simulation_distance: number
  enable_command_blocks: number; player_idle_timeout: number; prevent_proxy_connections: number
  op_names: string; op_permission_level: number; allow_flight: number
  initial_memory_mb: number; cpu_limit: number; cpu_reservation: number; memory_reservation_mb: number
  linux_uid: number; linux_gid: number; aikar_flags: number; jmx_enabled: number
  jvm_options: string; jvm_xx_options: string; system_properties: string; additional_arguments: string; timezone: string
  auto_stop_enabled: number; auto_pause_enabled: number; initial_timeout_seconds: number; established_timeout_seconds: number
  reconnect_interface: string; rolling_logs: number; show_log_timestamps: number
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
  container_id: string | null; created_at: string; updated_at: string
}

export const useServersStore = defineStore('servers', () => {
  const servers = ref<Server[]>([])
  const loading = ref(false)

  function apiFetch(): typeof $fetch {
    // useRequestFetch forwards the incoming cookie during SSR. Without it a
    // page refresh on a protected nested route loses its auth state.
    return import.meta.server ? useRequestFetch() : $fetch
  }

  async function fetchServers() {
    loading.value = true
    try { servers.value = await apiFetch()('/api/servers') as Server[] }
    finally { loading.value = false }
  }

  async function fetchServer(id: string): Promise<Server> {
    const s = await apiFetch()(`/api/servers/${id}`) as Server
    const i = servers.value.findIndex(x => x.id === id)
    if (i !== -1) servers.value[i] = s; else servers.value.unshift(s)
    return s
  }

  async function createServer(data: Partial<Server>): Promise<Server> {
    const s = await apiFetch()('/api/servers', { method: 'POST', body: data }) as Server
    servers.value.unshift(s); return s
  }

  async function updateServer(id: string, data: Partial<Server>): Promise<Server> {
    const s = await apiFetch()(`/api/servers/${id}`, { method: 'PUT', body: data }) as Server
    const i = servers.value.findIndex(x => x.id === id)
    if (i !== -1) servers.value[i] = s; return s
  }

  async function deleteServer(id: string) {
    await apiFetch()(`/api/servers/${id}`, { method: 'DELETE' })
    servers.value = servers.value.filter(s => s.id !== id)
  }

  function setStatus(id: string, status: Server['status']) {
    const s = servers.value.find(x => x.id === id)
    if (s) s.status = status
  }

  async function startServer(id: string)   { setStatus(id,'starting'); await apiFetch()(`/api/servers/${id}/start`,   { method: 'POST' }); setStatus(id,'running') }
  async function stopServer(id: string)    { setStatus(id,'stopping'); await apiFetch()(`/api/servers/${id}/stop`,    { method: 'POST' }); setStatus(id,'stopped') }
  async function restartServer(id: string) { await apiFetch()(`/api/servers/${id}/restart`, { method: 'POST' }) }

  return { servers, loading, fetchServers, fetchServer, createServer, updateServer, deleteServer, startServer, stopServer, restartServer, setStatus }
})
