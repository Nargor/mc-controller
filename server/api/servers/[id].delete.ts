import { existsSync, rmSync } from 'fs'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })
  if (server.status === 'running')
    throw createError({ statusCode: 400, statusMessage: 'Stop the server before deleting' })

  // Remove Docker container
  for (const ref of [server.container_id, `mc-${id}`].filter(Boolean)) {
    try { await getDocker().getContainer(ref).remove({ force: true }) } catch {}
  }

  const dataPath = getServerDataPath(id)
  if (existsSync(dataPath)) rmSync(dataPath, { recursive: true, force: true })

  await dbExec('DELETE FROM servers WHERE id = ?', [id])
  return { success: true }
})
