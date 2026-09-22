export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, 'type')!
  const { q } = getQuery(event) as { q?: string }
  return getVersions(type, q)
})
