export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server?.container_id) throw createError({ statusCode: 404, statusMessage: 'Server or container not found' })
  await getDocker().getContainer(server.container_id).restart({ t: 30 })
  await dbExec("UPDATE servers SET status='running' WHERE id=?", [id])
  return { success: true, status: 'running' }
})
