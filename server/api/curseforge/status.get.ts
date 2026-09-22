/** Deliberately returns only presence; API keys must never be exposed to the client. */
export default defineEventHandler(() => ({ configured: Boolean(useRuntimeConfig().curseforgeApiKey) }))
