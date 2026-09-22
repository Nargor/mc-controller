<template>
  <div class="min-h-screen bg-dark-950 flex flex-col">
    <!-- Top bar -->
    <nav class="bg-dark-900 border-b border-dark-700 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-40">
      <NuxtLink to="/" class="text-dark-400 hover:text-white p-1 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </NuxtLink>
      <span class="text-dark-600">/</span>
      <ServerTypeIcon :type="server?.type" class="text-xl flex-shrink-0" />
      <span class="font-semibold text-white truncate">{{ server?.name || '...' }}</span>
      <ServerStatus :status="server?.status" />
      <div class="ml-auto flex items-center gap-4 text-sm">
        <span class="text-dark-500 font-mono hidden sm:block">:{{ server?.port }}</span>
        <button @click="auth.logout()" class="text-dark-500 hover:text-white transition-colors">ออก</button>
      </div>
    </nav>

    <div class="flex flex-1 overflow-hidden" style="height:calc(100vh - 57px)">
      <!-- Sidebar -->
      <aside class="w-52 bg-dark-900 border-r border-dark-700 flex flex-col py-3 flex-shrink-0">
        <nav class="flex flex-col gap-0.5 px-2">
          <SidebarLink :to="`/servers/${id}`" icon="🏠">ภาพรวม</SidebarLink>
          <SidebarLink :to="`/servers/${id}/type`" icon="🧱"
            :disabled="server?.status !== 'stopped'" disabled-tooltip="หยุดเซิร์ฟเวอร์ก่อน">Server type</SidebarLink>
          <SidebarLink :to="`/servers/${id}/settings`" icon="⚙️"
            :disabled="server?.status !== 'stopped'" disabled-tooltip="หยุดเซิร์ฟเวอร์ก่อน">ตั้งค่า</SidebarLink>
          <SidebarLink :to="`/servers/${id}/resources`" icon="📊"
            :disabled="server?.status !== 'stopped'" disabled-tooltip="หยุดเซิร์ฟเวอร์ก่อน">Resources</SidebarLink>
          <SidebarLink :to="`/servers/${id}/mods`" icon="🧩"
            :disabled="server?.status !== 'stopped'" disabled-tooltip="หยุดเซิร์ฟเวอร์ก่อน">Mods</SidebarLink>
          <SidebarLink :to="`/servers/${id}/console`" icon="💻"
            :disabled="server?.status !== 'running'" disabled-tooltip="เซิร์ฟเวอร์ต้องทำงานอยู่">คอนโซล</SidebarLink>
          <SidebarLink :to="`/servers/${id}/files`" icon="📁">จัดการไฟล์</SidebarLink>
        </nav>
      </aside>
      <main class="flex-1 overflow-auto"><slot /></main>
    </div>
  </div>
</template>
<script setup lang="ts">
const route = useRoute()
const auth  = useAuthStore()
const store = useServersStore()
const id     = computed(() => route.params.id as string)
const server = computed(() => store.servers.find(s => s.id === id.value))
// A reactive key means Nuxt refetches when navigating between server IDs,
// while SSR renders the requested URL with its session cookie on first load.
await useAsyncData(() => `server:${id.value}`, () => store.fetchServer(id.value), { watch: [id] })
</script>
