export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })

  if (useNativeRuntime() && ['running','starting'].includes(server.status)) {
    if (!isNativeRunning(id)) {
      await dbExec("UPDATE servers SET status='stopped', container_id=NULL WHERE id=?", [id])
      server.status = 'stopped'; server.container_id = null
    }
  } else if (server.container_id && ['running','starting'].includes(server.status)) {
    const real = await syncContainerStatus(server.container_id)
    if (real !== server.status) {
      await dbExec('UPDATE servers SET status = ? WHERE id = ?', [real, id])
      server.status = real
    }
  }
  return server
})
