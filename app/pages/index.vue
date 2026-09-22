<template>
  <div class="max-w-6xl mx-auto p-5 sm:p-8">
    <div class="flex flex-wrap gap-4 items-end justify-between mb-8">
      <div><p class="text-mc-green text-sm font-medium">จัดการ Minecraft ของคุณ</p><h1 class="text-3xl font-bold text-white mt-1">เซิร์ฟเวอร์</h1></div>
      <NuxtLink to="/servers/new" class="rounded-xl bg-mc-green hover:bg-green-300 text-dark-950 px-4 py-2.5 font-semibold transition-colors">+ สร้างเซิร์ฟเวอร์</NuxtLink>
    </div>
    <div v-if="store.loading" class="text-dark-400 py-16 text-center">กำลังโหลด…</div>
    <div v-else-if="!store.servers.length" class="rounded-2xl border border-dashed border-dark-600 p-12 text-center bg-dark-900/50">
      <div class="text-4xl mb-4">⛏️</div><h2 class="text-white font-semibold text-lg">ยังไม่มีเซิร์ฟเวอร์</h2><p class="text-dark-400 text-sm mt-2">สร้างเครื่องแรก แล้วเลือกเวอร์ชันและพอร์ตที่ต้องการได้เลย</p>
      <NuxtLink to="/servers/new" class="inline-block mt-5 text-mc-green hover:underline">สร้างเซิร์ฟเวอร์แรก</NuxtLink>
    </div>
    <div v-else class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"><ServerCard v-for="server in store.servers" :key="server.id" :server="server" @delete="askDelete" /></div>
    <ConfirmDialog v-model="confirmDelete" danger title="ลบเซิร์ฟเวอร์?" :message="`ระบบจะหยุด ${deleteTarget?.name || 'เซิร์ฟเวอร์'} (ถ้ากำลังทำงาน) แล้วลบ container, world และไฟล์ทั้งหมดถาวร`" confirm-text="ลบถาวร" @confirm="remove" />
  </div>
</template>
<script setup lang="ts">
const store = useServersStore()
const confirmDelete = ref(false)
const deleteTarget = ref<import('~/stores/servers').Server | null>(null)
function askDelete(server: import('~/stores/servers').Server) { deleteTarget.value = server; confirmDelete.value = true }
async function remove() { if (!deleteTarget.value) return; try { await store.deleteServer(deleteTarget.value.id) } finally { deleteTarget.value = null } }
await useAsyncData('servers:list', () => store.fetchServers())
</script>
