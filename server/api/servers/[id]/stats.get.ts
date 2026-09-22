export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT container_id, status FROM servers WHERE id = ?', [id])
  if (useNativeRuntime()) return { cpuPercent: 0, memoryMB: 0 }
  if (!server?.container_id || server.status !== 'running') return { cpuPercent: 0, memoryMB: 0 }
  return getContainerStats(server.container_id)
})
