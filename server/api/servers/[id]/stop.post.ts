export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server?.container_id) throw createError({ statusCode: 404, statusMessage: 'Server or container not found' })

  await dbExec("UPDATE servers SET status='stopping' WHERE id=?", [id])
  try {
    await getDocker().getContainer(server.container_id).stop({ t: 30 })
    await dbExec("UPDATE servers SET status='stopped' WHERE id=?", [id])
    return { success: true, status: 'stopped' }
  } catch (e: any) {
    await dbExec("UPDATE servers SET status='error' WHERE id=?", [id])
    throw createError({ statusCode: 500, statusMessage: e.message })
  }
})
