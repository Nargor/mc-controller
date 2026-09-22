import { defineStore } from 'pinia'

export interface Server {
  id: string; name: string; type: string; mc_version: string
  loader_version: string | null; modpack_id: string | null; modpack_name: string | null
  port: number; max_players: number; memory_mb: number; motd: string
  difficulty: string; gamemode: string; whitelist: number; online_mode: number
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
  container_id: string | null; created_at: string; updated_at: string
}

export const useServersStore = defineStore('servers', () => {
  const servers = ref<Server[]>([])
  const loading = ref(false)

  async function fetchServers() {
    loading.value = true
    try { servers.value = await $fetch('/api/servers') as Server[] }
    finally { loading.value = false }
  }

  async function fetchServer(id: string): Promise<Server> {
    const s = await $fetch(`/api/servers/${id}`) as Server
    const i = servers.value.findIndex(x => x.id === id)
    if (i !== -1) servers.value[i] = s; else servers.value.unshift(s)
    return s
  }

  async function createServer(data: Partial<Server>): Promise<Server> {
    const s = await $fetch('/api/servers', { method: 'POST', body: data }) as Server
    servers.value.unshift(s); return s
  }

  async function updateServer(id: string, data: Partial<Server>): Promise<Server> {
    const s = await $fetch(`/api/servers/${id}`, { method: 'PUT', body: data }) as Server
    const i = servers.value.findIndex(x => x.id === id)
    if (i !== -1) servers.value[i] = s; return s
  }

  async function deleteServer(id: string) {
    await $fetch(`/api/servers/${id}`, { method: 'DELETE' })
    servers.value = servers.value.filter(s => s.id !== id)
  }

  function setStatus(id: string, status: Server['status']) {
    const s = servers.value.find(x => x.id === id)
    if (s) s.status = status
  }

  async function startServer(id: string)   { setStatus(id,'starting'); await $fetch(`/api/servers/${id}/start`,   { method: 'POST' }); setStatus(id,'running') }
  async function stopServer(id: string)    { setStatus(id,'stopping'); await $fetch(`/api/servers/${id}/stop`,    { method: 'POST' }); setStatus(id,'stopped') }
  async function restartServer(id: string) { await $fetch(`/api/servers/${id}/restart`, { method: 'POST' }) }

  return { servers, loading, fetchServers, fetchServer, createServer, updateServer, deleteServer, startServer, stopServer, restartServer, setStatus }
})
