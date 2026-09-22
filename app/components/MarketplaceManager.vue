<template>
  <section class="panel">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><h2>{{ title }}</h2><p class="hint mt-1">ค้นหาจาก Modrinth เลือกเวอร์ชันที่รองรับ แล้วติดตั้งลงในโฟลเดอร์ {{ kind === 'mod' ? 'mods' : 'plugins' }}</p></div>
      <span :class="editable ? 'badge ok' : 'badge bad'">{{ editable ? 'พร้อมติดตั้ง' : 'ต้องหยุดเซิร์ฟเวอร์ก่อน' }}</span>
    </div>

    <form class="flex gap-2 mt-4" @submit.prevent="search">
      <input v-model.trim="query" class="search" :placeholder="`ค้นหา ${title}`" :disabled="searching || !editable" />
      <button class="button secondary" :disabled="searching || !query || !editable">{{ searching ? 'กำลังค้นหา…' : 'ค้นหา' }}</button>
    </form>
    <p v-if="error" class="text-red-300 text-sm mt-3">{{ error }}</p>

    <div v-if="results.length" class="grid md:grid-cols-2 gap-3 mt-4">
      <button v-for="result in results" :key="result.id" class="result" :class="selected?.id === result.id ? 'selected' : ''" @click="chooseProject(result)">
        <img v-if="result.iconUrl" :src="result.iconUrl" class="icon" alt="" /><span v-else class="icon placeholder">{{ kind === 'mod' ? '🧩' : '🔌' }}</span>
        <span class="min-w-0 text-left"><strong>{{ result.title }}</strong><small>{{ result.description || result.slug }}</small></span>
      </button>
    </div>

    <div v-if="selected" class="install-box mt-4">
      <div><strong class="text-white">{{ selected.title }}</strong><p class="hint">{{ loadingVersions ? 'กำลังค้นหาเวอร์ชันที่รองรับ…' : `${versions.length} เวอร์ชันที่เข้ากับ Minecraft ${server?.mc_version || ''}` }}</p></div>
      <div class="flex flex-wrap gap-2 items-end mt-3">
        <label class="field flex-1 min-w-48">Version
          <select v-model="selectedVersion" :disabled="loadingVersions"><option value="">เลือกเวอร์ชัน</option><option v-for="version in versions" :key="version.id" :value="version.id">{{ version.number }} — {{ version.type }}</option></select>
        </label>
        <button class="button primary" :disabled="!selectedVersion || installing || !editable" @click="install">{{ installing ? 'กำลังติดตั้ง…' : 'ติดตั้ง' }}</button>
      </div>
      <p v-if="!loadingVersions && !versions.length" class="text-amber-300 text-xs mt-3">ไม่พบเวอร์ชันที่เข้ากับ Minecraft/loader ของเซิร์ฟเวอร์นี้</p>
    </div>

    <div class="mt-6 border-t border-dark-700 pt-4">
      <h3 class="text-sm font-medium text-white">Installed {{ title }}</h3>
      <p v-if="loadingInstalled" class="hint mt-2">กำลังอ่านรายการ…</p>
      <p v-else-if="!installed.length" class="hint mt-2">ยังไม่มี{{ title }}</p>
      <div v-else class="mt-3 space-y-2">
        <div v-for="addon in installed" :key="addon.file" class="installed"><span class="min-w-0"><strong>{{ addon.title || addon.file }}</strong><small>{{ addon.version ? `${addon.version} · ` : '' }}{{ addon.file }}</small></span><button class="remove" :disabled="!editable" @click="remove(addon.file)">ลบ</button></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ kind: 'mod' | 'plugin' }>()
const route = useRoute()
const store = useServersStore()
const id = route.params.id as string
const server = computed(() => store.servers.find(item => item.id === id))
const title = computed(() => props.kind === 'mod' ? 'Mods' : 'Plugins')
const editable = computed(() => server.value?.status === 'stopped')
const query = ref('')
const results = ref<any[]>([])
const selected = ref<any | null>(null)
const versions = ref<any[]>([])
const selectedVersion = ref('')
const installed = ref<any[]>([])
const searching = ref(false)
const loadingVersions = ref(false)
const loadingInstalled = ref(false)
const installing = ref(false)
const error = ref('')

async function loadInstalled() {
  loadingInstalled.value = true
  try {
    const response = await $fetch(`/api/servers/${id}/addons`, { query: { kind: props.kind } }) as any
    installed.value = response.addons || []
  } catch (cause: any) { error.value = cause?.data?.statusMessage || 'โหลดรายการที่ติดตั้งไม่สำเร็จ' }
  finally { loadingInstalled.value = false }
}

async function search() {
  searching.value = true; error.value = ''; selected.value = null; versions.value = []
  try {
    const response = await $fetch(`/api/servers/${id}/addons/search`, { query: { kind: props.kind, q: query.value } }) as any
    results.value = response.results || []
  } catch (cause: any) { error.value = cause?.data?.statusMessage || 'ค้นหาไม่สำเร็จ' }
  finally { searching.value = false }
}

async function chooseProject(project: any) {
  selected.value = project; selectedVersion.value = ''; versions.value = []; loadingVersions.value = true; error.value = ''
  try {
    const response = await $fetch(`/api/servers/${id}/addons/versions`, { query: { kind: props.kind, projectId: project.id } }) as any
    versions.value = response.versions || []
  } catch (cause: any) { error.value = cause?.data?.statusMessage || 'โหลดเวอร์ชันไม่สำเร็จ' }
  finally { loadingVersions.value = false }
}

async function install() {
  if (!selected.value || !selectedVersion.value) return
  installing.value = true; error.value = ''
  try {
    await $fetch(`/api/servers/${id}/addons/install`, { method: 'POST', body: { kind: props.kind, projectId: selected.value.id, versionId: selectedVersion.value } })
    await loadInstalled()
  } catch (cause: any) { error.value = cause?.data?.statusMessage || 'ติดตั้งไม่สำเร็จ' }
  finally { installing.value = false }
}

async function remove(file: string) {
  if (!confirm(`ลบ ${file} ใช่หรือไม่?`)) return
  error.value = ''
  try {
    await $fetch(`/api/servers/${id}/addons/delete`, { method: 'DELETE', body: { kind: props.kind, file } })
    await loadInstalled()
  } catch (cause: any) { error.value = cause?.data?.statusMessage || 'ลบไม่สำเร็จ' }
}

onMounted(async () => { await store.fetchServer(id); await loadInstalled() })
</script>

<style scoped>
.panel { @apply rounded-2xl bg-dark-900 border border-dark-700 p-5 }.panel h2 { @apply text-white font-semibold }.hint { @apply text-xs text-dark-500 }
.badge { @apply rounded-full px-2 py-0.5 text-xs font-medium }.ok { @apply bg-green-500/15 text-green-300 }.bad { @apply bg-red-500/15 text-red-300 }
.search, .field select { @apply w-full rounded-lg bg-dark-800 border border-dark-600 px-3 py-2.5 text-sm text-white outline-none focus:border-mc-green }.field { @apply flex flex-col gap-1.5 text-sm text-dark-300 }
.button { @apply rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 }.secondary { @apply bg-dark-700 hover:bg-dark-600 text-white }.primary { @apply bg-mc-green hover:bg-green-300 text-dark-950 }
.result { @apply flex gap-3 items-center rounded-xl border border-dark-700 bg-dark-800 p-3 hover:border-dark-500 text-left transition-colors }.result.selected { @apply border-mc-green bg-green-500/10 }.icon { @apply h-10 w-10 rounded-lg object-cover flex-none }.placeholder { @apply bg-dark-700 flex items-center justify-center }.result strong,.installed strong { @apply block text-sm text-white truncate }.result small,.installed small { @apply block text-xs text-dark-500 truncate mt-0.5 }
.install-box { @apply rounded-xl border border-dark-600 bg-dark-800 p-4 }.installed { @apply flex items-center justify-between gap-3 rounded-lg bg-dark-800 px-3 py-2 }.remove { @apply text-xs text-red-300 hover:text-red-200 disabled:opacity-50 }
</style>
