import { defineStore } from 'pinia'

interface User { id: string; username: string; role: string }

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)

  async function fetchMe(): Promise<boolean> {
    try { user.value = await $fetch('/api/auth/me') as User; return true }
    catch { user.value = null; return false }
  }

  async function login(username: string, password: string) {
    const res = await $fetch('/api/auth/login', { method: 'POST', body: { username, password } }) as any
    user.value = { id: '', username: res.username, role: res.role }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'DELETE' }).catch(() => {})
    user.value = null
    await navigateTo('/login')
  }

  async function setupAdmin(username: string, password: string, confirm: string) {
    const res = await $fetch('/api/setup', { method: 'POST', body: { username, password, confirm } }) as any
    user.value = { id: '', username: res.username, role: 'admin' }
  }

  return { user, fetchMe, login, logout, setupAdmin }
})
