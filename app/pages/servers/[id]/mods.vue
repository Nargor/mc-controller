<template>
  <div v-if="server" class="max-w-4xl mx-auto p-5 sm:p-8">
    <h1 class="text-2xl font-bold text-white">Mods</h1>
    <p class="text-dark-400 text-sm mt-1">ค้นหา ติดตั้ง และตั้งค่าการดาวน์โหลด mod</p>

    <div class="mt-6"><MarketplaceManager kind="mod" /></div>

    <form class="mt-6 space-y-5" @submit.prevent="save">
      <fieldset :disabled="!editable" class="space-y-5 disabled:opacity-50">
        <section v-if="form.type === 'fabric'" class="panel">
          <h2>Fabric</h2>
          <div class="grid sm:grid-cols-2 gap-4 mt-4">
            <label class="field">Fabric loader version
              <select v-model="form.loader_version" :disabled="loadingFabric"><option value="">ล่าสุดอัตโนมัติ</option><option v-for="version in loaderVersions" :key="version" :value="version">{{ version }}</option></select>
            </label>
            <label class="field">Fabric launcher version
              <select v-model="form.fabric_launcher_version" :disabled="loadingFabric"><option value="">ล่าสุดอัตโนมัติ</option><option v-for="version in launcherVersions" :key="version" :value="version">{{ version }}</option></select>
            </label>
          </div>
          <p v-if="loadingFabric" class="hint mt-3">กำลังโหลดเวอร์ชันจาก Fabric Meta…</p>
        </section>

        <section class="panel">
          <div class="flex items-center gap-2"><h2>CurseForge files</h2><span :class="apiConfigured ? 'badge ok' : 'badge bad'">{{ apiConfigured ? 'API key configured' : 'CURSEFORGE_API_KEY missing' }}</span></div>
          <p class="hint mt-2">API key อ่านจาก <code>CURSEFORGE_API_KEY</code> ใน environment เท่านั้น จึงไม่ถูกเปิดเผยในหน้าเว็บ</p>
          <label class="field mt-4">Download Additional Mods (CurseForge files)
            <textarea v-model="form.curseforge_files" placeholder="หนึ่งรายการต่อบรรทัด: jei&#10;geckolib:4593548&#10;https://www.curseforge.com/minecraft/mc-mods/jei/files/4593548" />
            <small>ใส่ slug, Project ID, URL ของ project/file หรือ <code>slug:fileId</code></small>
          </label>
        </section>

        <section class="panel">
          <h2>Modrinth projects</h2>
          <label class="field mt-4">Modrinth Projects
            <textarea v-model="form.modrinth_projects" placeholder="หนึ่งรายการต่อบรรทัด:&#10;fabric-api&#10;lithium&#10;pl3xmap?:beta" />
            <small>ใส่ slug หรือ Project ID; เติม <code>?</code> เพื่อให้ข้ามได้ถ้ายังไม่มีเวอร์ชันที่รองรับ</small>
          </label>
          <div class="grid sm:grid-cols-2 gap-4 mt-4">
            <label class="field">Download dependencies
              <select v-model="form.modrinth_download_dependencies"><option value="none">None</option><option value="required">Require</option><option value="optional">Require + optional</option></select>
            </label>
            <label class="field">Default version type
              <select v-model="form.modrinth_default_version_type"><option value="release">Release</option><option value="beta">Beta (+ release)</option><option value="alpha">Alpha (+ beta + release)</option></select>
            </label>
          </div>
        </section>
      </fieldset>

      <p v-if="error" class="text-red-300 text-sm">{{ error }}</p>
      <button v-if="editable" class="button primary" :disabled="saving">{{ saving ? 'กำลังบันทึก…' : 'บันทึก Mods' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'server' })

const route = useRoute()
const store = useServersStore()
const id = route.params.id as string
const server = computed(() => store.servers.find(item => item.id === id))
const form = reactive<any>({})
const saving = ref(false)
const error = ref('')
const loadingFabric = ref(false)
const fabricData = ref<any[]>([])
const apiConfigured = ref(false)
const editable = computed(() => server.value?.status === 'stopped')
const loaderVersions = computed(() => fabricData.value.find(item => item.mcVersion === form.mc_version)?.loaderVersions || [])
const launcherVersions = computed(() => fabricData.value[0]?.launcherVersions || [])

function assign() {
  if (server.value) Object.assign(form, server.value)
}

async function loadFabricVersions() {
  if (form.type !== 'fabric') return
  loadingFabric.value = true
  try { fabricData.value = await $fetch('/api/versions/fabric') as any[] }
  catch { error.value = 'โหลดเวอร์ชัน Fabric ไม่สำเร็จ' }
  finally { loadingFabric.value = false }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await store.updateServer(id, form)
    assign()
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'บันทึกไม่สำเร็จ'
  } finally { saving.value = false }
}

onMounted(async () => {
  await store.fetchServer(id)
  assign()
  await Promise.all([
    loadFabricVersions(),
    $fetch('/api/curseforge/status').then((result: any) => { apiConfigured.value = Boolean(result.configured) }).catch(() => undefined),
  ])
})
</script>

<style scoped>
.panel { @apply rounded-2xl bg-dark-900 border border-dark-700 p-5 }
.panel h2 { @apply text-white font-semibold }
.field { @apply flex flex-col gap-1.5 text-sm text-dark-300 }
.field select, .field textarea { @apply rounded-lg bg-dark-800 border border-dark-600 px-3 py-2.5 text-white outline-none focus:border-mc-green }
.field textarea { @apply min-h-32 font-mono text-xs resize-y }
.field small, .hint { @apply text-xs text-dark-500 }
.badge { @apply rounded-full px-2 py-0.5 text-xs font-medium }.ok { @apply bg-green-500/15 text-green-300 }.bad { @apply bg-red-500/15 text-red-300 }
.button { @apply rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 }.primary { @apply bg-mc-green hover:bg-green-300 text-dark-950 }
</style>
