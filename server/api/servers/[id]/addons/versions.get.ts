export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const kind = query.kind === 'plugin' ? 'plugin' : 'mod'
  const projectId = String(query.projectId || '').trim()
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const server = await getAddonServer(getRouterParam(event, 'id')!, kind)
  return { versions: await getModrinthVersions(server, projectId) }
})
