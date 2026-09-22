export default defineNitroPlugin(async () => {
  console.log('[MC-Controller] Initializing database...')
  await initDb()
  console.log('[MC-Controller] Database ready ✓')
})
