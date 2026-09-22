export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })

  await dbExec("UPDATE servers SET status='stopping' WHERE id=?", [id])
  try {
    if (useNativeRuntime()) {
      await stopNativeServer(id)
      await dbExec("UPDATE servers SET status='stopped', container_id=NULL WHERE id=?", [id])
      return { success: true, status: 'stopped' }
    }
    if (!server.container_id) throw createError({ statusCode: 404, statusMessage: 'Server container not found' })
    await getDocker().getContainer(server.container_id).stop({ t: 30 })
    await dbExec("UPDATE servers SET status='stopped' WHERE id=?", [id])
    return { success: true, status: 'stopped' }
  } catch (e: any) {
    await dbExec("UPDATE servers SET status='error' WHERE id=?", [id])
    throw createError({ statusCode: 500, statusMessage: e.message })
  }
})
