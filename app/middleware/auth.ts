// Auth guard - redirects to /setup (first run) or /login (needs auth)
export default defineNuxtRouteMiddleware(async (to) => {
  if (['/login', '/setup'].includes(to.path)) return

  const auth = useAuthStore()
  if (!auth.user) {
    const ok = await auth.fetchMe()
    if (!ok) {
      try {
        const s = await $fetch('/api/setup/status') as any
        if (s?.firstRun) return navigateTo('/setup')
      } catch {}
      return navigateTo('/login')
    }
  }
})
