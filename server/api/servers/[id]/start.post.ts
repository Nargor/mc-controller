export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })
  if (server.status === 'running') throw createError({ statusCode: 400, statusMessage: 'Already running' })

  await dbExec("UPDATE servers SET status='starting' WHERE id=?", [id])
  try {
    let container
    if (server.container_id) {
      try {
        container = getDocker().getContainer(server.container_id)
        const info = await container.inspect()
        if (info.State.Running) {
          await dbExec("UPDATE servers SET status='running' WHERE id=?", [id])
          return { success: true, status: 'running' }
        }
        await container.start()
      } catch {
        container = await createServerContainer(server)
        await container.start()
        await dbExec('UPDATE servers SET container_id=? WHERE id=?', [(container as any).id, id])
      }
    } else {
      container = await createServerContainer(server)
      await container.start()
      await dbExec('UPDATE servers SET container_id=? WHERE id=?', [(container as any).id, id])
    }
    await dbExec("UPDATE servers SET status='running' WHERE id=?", [id])
    return { success: true, status: 'running' }
  } catch (e: any) {
    await dbExec("UPDATE servers SET status='error' WHERE id=?", [id])
    throw createError({ statusCode: 500, statusMessage: e.message })
  }
})
