export default defineEventHandler(async () => ({
  port: await getNextAvailablePort(),
}))
