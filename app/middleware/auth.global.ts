// Runs for every page: redirect a new installation to setup, otherwise login.
export default defineNuxtRouteMiddleware(async (to) => {
  if (['/login', '/setup'].includes(to.path)) return

  const auth = useAuthStore()
  if (auth.user) return

  // On SSR the request-aware fetcher forwards mc_session from the browser.
  const apiFetch = import.meta.server ? useRequestFetch() : $fetch
  const ok = await auth.fetchMe(apiFetch)
  if (ok) return

  try {
    const status = await apiFetch('/api/setup/status') as { firstRun?: boolean }
    if (status.firstRun) return navigateTo('/setup')
  } catch {
    // Login is the safe fallback when the setup status endpoint is unavailable.
  }
  return navigateTo('/login')
})
