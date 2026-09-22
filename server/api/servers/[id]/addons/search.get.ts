export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const kind = query.kind === 'plugin' ? 'plugin' : 'mod'
  const text = String(query.q || '').trim()
  if (!text) return { results: [] }
  const server = await getAddonServer(getRouterParam(event, 'id')!, kind)
  return { results: await searchModrinth(server, kind, text) }
})
