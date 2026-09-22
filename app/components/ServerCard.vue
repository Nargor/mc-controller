<template>
  <div
    class="block bg-dark-800 border border-dark-700 rounded-xl p-5 hover:border-dark-500 hover:bg-dark-750 transition-all group">
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center text-xl"><ServerTypeIcon :type="server.type" /></div>
        <div class="min-w-0">
          <h3 class="font-semibold text-white group-hover:text-mc-green transition-colors truncate">{{ server.name }}</h3>
          <p class="text-xs text-dark-400 mt-0.5">{{ LABELS[server.type] || server.type }} · {{ server.mc_version }}</p>
        </div>
      </div>
      <ServerStatus :status="server.status" />
    </div>
    <div class="flex items-center justify-between gap-3 text-xs text-dark-500">
      <div class="flex items-center gap-4">
      <span>🔌 {{ server.port }}</span>
      <span>👥 {{ server.max_players }} max</span>
      <span>💾 {{ server.memory_mb }}MB</span>
      </div>
      <div class="flex gap-3"><NuxtLink :to="`/servers/${server.id}`" class="text-mc-green hover:underline">จัดการ</NuxtLink><button class="text-red-400 hover:text-red-300" @click="$emit('delete', server)">ลบ</button></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Server } from '~/stores/servers'
defineProps<{ server: Server }>()
defineEmits<{ delete: [server: Server] }>()
const LABELS: Record<string,string> = { vanilla:'Vanilla', fabric:'Fabric', forge:'Forge', neoforge:'NeoForge', paper:'Paper', spigot:'Spigot', bukkit:'Bukkit', curseforge:'CurseForge' }
</script>
