export default defineEventHandler(async () => ({
  firstRun: await isFirstRun(),
}))
