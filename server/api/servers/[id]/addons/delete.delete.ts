export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const kind = body.kind === 'plugin' ? 'plugin' : 'mod'
  const server = await getAddonServer(getRouterParam(event, 'id')!, kind)
  if (server.status !== 'stopped') throw createError({ statusCode: 400, statusMessage: 'Stop the server before removing addons' })
  deleteInstalledAddon(server, kind, String(body.file || ''))
  return { success: true }
})
