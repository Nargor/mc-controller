import { existsSync, rmSync } from 'fs'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const server = await dbQueryOne<any>('SELECT * FROM servers WHERE id = ?', [id])
  if (!server) throw createError({ statusCode: 404, statusMessage: 'Server not found' })

  // Force removal stops a running container first. This makes deletion a single,
  // deliberate action whether the server is stopped, starting, or running.
  await dbExec("UPDATE servers SET status='stopping' WHERE id=?", [id])
  if (useNativeRuntime()) {
    await stopNativeServer(id)
  } else {
    for (const ref of [server.container_id, `mc-${id}`].filter(Boolean)) {
      try { await getDocker().getContainer(ref).remove({ force: true }) } catch {}
    }
  }

  const dataPath = getServerDataPath(id)
  if (existsSync(dataPath)) rmSync(dataPath, { recursive: true, force: true })

  await dbExec('DELETE FROM servers WHERE id = ?', [id])
  return { success: true }
})
