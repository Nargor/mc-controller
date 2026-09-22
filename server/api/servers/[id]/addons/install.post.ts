export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const kind = body.kind === 'plugin' ? 'plugin' : 'mod'
  const server = await getAddonServer(getRouterParam(event, 'id')!, kind)
  if (server.status !== 'stopped') throw createError({ statusCode: 400, statusMessage: 'Stop the server before installing addons' })
  const projectId = String(body.projectId || '').trim()
  const versionId = String(body.versionId || '').trim()
  if (!projectId || !versionId) throw createError({ statusCode: 400, statusMessage: 'Choose a project and version first' })
  return { addon: await installModrinthAddon(server, kind, projectId, versionId) }
})
