<template>
  <div class="max-w-3xl mx-auto p-5 sm:p-8">
    <NuxtLink to="/" class="text-dark-400 hover:text-white text-sm">← กลับไปยังรายการ</NuxtLink>
    <h1 class="text-3xl font-bold text-white mt-4">สร้างเซิร์ฟเวอร์</h1><p class="text-dark-400 text-sm mt-1">ตั้งค่าเหล่านี้แก้ไขได้จนกว่าจะกดเริ่มครั้งแรก</p>
    <form class="mt-7 space-y-6" @submit.prevent="create">
      <section class="panel"><h2>ข้อมูลหลัก</h2><div class="grid sm:grid-cols-2 gap-4 mt-4">
        <label class="field sm:col-span-2">ชื่อเซิร์ฟเวอร์<input v-model="form.name" required maxlength="80" placeholder="เช่น Survival ของเพื่อน" /></label>
        <label class="field">ชนิดเซิร์ฟเวอร์<select v-model="form.type"><option v-for="type in types" :key="type.id" :value="type.id">{{ type.label }}</option></select></label>
        <label class="field">เวอร์ชัน Minecraft<select v-model="form.mc_version" :disabled="versionsLoading || !gameVersions.length"><option value="">{{ versionsLoading ? 'กำลังโหลด…' : 'เลือกเวอร์ชัน' }}</option><option v-for="version in gameVersions" :key="version" :value="version">{{ version }}</option></select></label>
        <label v-if="loaderVersions.length" class="field">เวอร์ชัน Loader<select v-model="form.loader_version"><option value="">ล่าสุดอัตโนมัติ</option><option v-for="version in loaderVersions" :key="version" :value="version">{{ version }}</option></select></label>
        <label v-if="form.type === 'curseforge'" class="field sm:col-span-2">Modpack<select v-model="form.modpack_id" @change="selectModpack"><option value="">เลือก Modpack</option><option v-for="pack in rawVersions" :key="pack.slug" :value="pack.slug">{{ pack.name }}{{ pack.mcVersion ? ` (Minecraft ${pack.mcVersion})` : '' }}</option></select><small>ต้องกำหนด CURSEFORGE_API_KEY ใน environment ก่อน รายการจึงจะแสดง</small></label>
        <label class="field">พอร์ต<input v-model.number="form.port" type="number" min="1" max="65535" required /><small>พอร์ตต้องไม่ซ้ำกัน</small></label>
      </div></section>
      <section class="panel"><h2>การเล่น</h2><div class="grid sm:grid-cols-2 gap-4 mt-4">
        <label class="field">ข้อความ MOTD<input v-model="form.motd" maxlength="120" /></label>
        <label class="field">จำนวนผู้เล่นสูงสุด<input v-model.number="form.max_players" type="number" min="1" max="1000" /></label>
        <label class="field">หน่วยความจำ (MB)<input v-model.number="form.memory_mb" type="number" min="256" step="256" /></label>
        <label class="field">โหมดเกม<select v-model="form.gamemode"><option value="survival">Survival</option><option value="creative">Creative</option><option value="adventure">Adventure</option><option value="spectator">Spectator</option></select></label>
        <label class="field">ระดับความยาก<select v-model="form.difficulty"><option value="peaceful">Peaceful</option><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label>
        <div class="space-y-3 pt-5"><label class="check"><input v-model="form.online_mode" type="checkbox" /> ตรวจสอบบัญชีแท้ (online mode)</label><label class="check"><input v-model="form.whitelist" type="checkbox" /> เปิด whitelist</label></div>
      </div></section>
      <p v-if="error" class="rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300">{{ error }}</p>
      <div class="flex gap-3 justify-end"><NuxtLink to="/" class="button secondary">ยกเลิก</NuxtLink><button class="button primary" :disabled="saving || !form.mc_version">{{ saving ? 'กำลังสร้าง…' : 'สร้างเซิร์ฟเวอร์' }}</button></div>
    </form>
  </div>
</template>
<script setup lang="ts">
const store = useServersStore(); const router = useRouter()
const types = [{ id:'vanilla', label:'Vanilla' },{ id:'fabric', label:'Fabric' },{ id:'forge', label:'Forge' },{ id:'neoforge', label:'NeoForge' },{ id:'paper', label:'Paper' },{ id:'spigot', label:'Spigot' },{ id:'bukkit', label:'Bukkit' },{ id:'curseforge', label:'CurseForge Modpack' }]
const form = reactive<any>({ name:'', type:'vanilla', mc_version:'', loader_version:'', modpack_id:'', modpack_name:'', port:25565, max_players:20, memory_mb:2048, motd:'A Minecraft Server', difficulty:'normal', gamemode:'survival', whitelist:false, online_mode:true })
const rawVersions = ref<any[]>([]); const versionsLoading = ref(false); const saving = ref(false); const error = ref('')
const gameVersions = computed(() => rawVersions.value.map(v => typeof v === 'string' ? v : v.mcVersion || v.id).filter(Boolean))
const loaderVersions = computed(() => { const version = rawVersions.value.find(v => (v.mcVersion || v.id) === form.mc_version); return version?.loaderVersions || version?.forgeVersions || (form.type === 'neoforge' ? rawVersions.value.filter(v => v.mcVersion === form.mc_version).map(v => v.version) : []) })
async function loadVersions() { versionsLoading.value = true; form.mc_version = ''; form.loader_version = ''; try { rawVersions.value = await $fetch(`/api/versions/${form.type}`) as any[]; form.mc_version = gameVersions.value[0] || '' } catch (e:any) { error.value = e?.data?.statusMessage || 'โหลดเวอร์ชันไม่สำเร็จ' } finally { versionsLoading.value = false } }
function selectModpack() { const pack = rawVersions.value.find(p => p.slug === form.modpack_id); if (pack) { form.modpack_name = pack.name; form.mc_version = pack.mcVersion || form.mc_version } }
async function loadPort() { try { form.port = (await $fetch('/api/ports/next') as any).port } catch {} }
async function create() { saving.value = true; error.value = ''; try { const server = await store.createServer(form); router.push(`/servers/${server.id}`) } catch (e:any) { error.value = e?.data?.statusMessage || 'สร้างเซิร์ฟเวอร์ไม่สำเร็จ' } finally { saving.value = false } }
watch(() => form.type, loadVersions); onMounted(async () => { await Promise.all([loadVersions(), loadPort()]) })
</script>
<style scoped>
.panel{ @apply bg-dark-900 border border-dark-700 rounded-2xl p-5; }.panel h2{ @apply text-white font-semibold; }.field{ @apply flex flex-col gap-1.5 text-sm text-dark-300; }.field input,.field select{ @apply rounded-lg bg-dark-800 border border-dark-600 px-3 py-2.5 text-white outline-none focus:border-mc-green disabled:opacity-60; }.field small{ @apply text-xs text-dark-500; }.check{ @apply flex gap-2 items-center text-sm text-dark-300; }.check input{ @apply accent-green-400; }.button{ @apply px-4 py-2.5 rounded-xl font-medium text-sm transition-colors; }.primary{ @apply bg-mc-green hover:bg-green-300 text-dark-950 disabled:opacity-50; }.secondary{ @apply bg-dark-700 hover:bg-dark-600 text-dark-200; }
</style>
