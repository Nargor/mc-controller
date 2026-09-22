export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })
  if (useNativeRuntime()) {
    await stopNativeServer(id)
    const pid = await startNativeServer(server)
    await dbExec("UPDATE servers SET container_id=?, status='running' WHERE id=?", [`native:${pid || ''}`, id])
    return { success: true, status: 'running', runtime: 'native' }
  }
  if (!server.container_id) throw createError({ statusCode: 404, statusMessage: 'Server container not found' })
  await getDocker().getContainer(server.container_id).restart({ t: 30 })
  await dbExec("UPDATE servers SET status='running' WHERE id=?", [id])
  return { success: true, status: 'running' }
})
