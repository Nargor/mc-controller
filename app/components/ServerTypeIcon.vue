<template><span :title="type">{{ ICONS[type||''] || '🟢' }}</span></template>
<script setup lang="ts">
defineProps<{ type?: string }>()
const ICONS: Record<string,string> = { vanilla:'🍦', fabric:'🧵', forge:'⚒️', neoforge:'⚙️', paper:'📄', spigot:'🌵', bukkit:'🪣', curseforge:'🔥' }
</script>
