<template>
  <div class="min-h-screen bg-dark-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-2xl bg-mc-green mx-auto mb-4 flex items-center justify-center text-3xl text-dark-950">⛏</div>
        <h1 class="text-2xl font-bold text-white">MC Controller</h1>
        <p class="text-dark-400 mt-1 text-sm">เข้าสู่ระบบเพื่อจัดการเซิร์ฟเวอร์</p>
      </div>
      <form @submit.prevent="login" class="space-y-4">
        <input v-model="form.username" type="text" placeholder="ชื่อผู้ใช้"
          class="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mc-green" required autofocus />
        <input v-model="form.password" type="password" placeholder="รหัสผ่าน"
          class="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-mc-green" required />
        <div v-if="error" class="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded-xl px-4 py-3">{{ error }}</div>
        <button type="submit" :disabled="loading" class="w-full bg-mc-green hover:bg-green-300 disabled:opacity-50 text-dark-950 font-semibold py-3 rounded-xl transition-colors">
          {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </button>
      </form>
    </div>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ layout: false })

const auth = useAuthStore()
const router = useRouter()
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  const s = await $fetch('/api/setup/status').catch(() => null) as any
  if (s?.firstRun) return navigateTo('/setup')
  if (await auth.fetchMe()) return navigateTo('/')
})

async function login() {
  loading.value = true; error.value = ''
  try { await auth.login(form.username, form.password); router.push('/') }
  catch (e: any) { error.value = e?.data?.statusMessage || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
  finally { loading.value = false }
}
</script>
