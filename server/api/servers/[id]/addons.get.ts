export default defineEventHandler(async (event) => {
  const kind = getQuery(event).kind === 'plugin' ? 'plugin' : 'mod'
  const server = await getAddonServer(getRouterParam(event, 'id')!, kind)
  return { addons: listInstalledAddons(server, kind) }
})
