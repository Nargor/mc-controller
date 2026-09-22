<template>
  <NuxtLink v-if="!disabled" :to="to"
    :class="['flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors', isActive ? 'bg-dark-700 text-white font-medium' : 'text-dark-400 hover:text-white hover:bg-dark-800']">
    <span class="text-base w-5 text-center">{{ icon }}</span><slot />
  </NuxtLink>
  <div v-else :title="disabledTooltip" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-dark-600 cursor-not-allowed opacity-50">
    <span class="text-base w-5 text-center">{{ icon }}</span><slot />
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{ to: string; icon: string; disabled?: boolean; disabledTooltip?: string }>()
const route = useRoute()
const isActive = computed(() => route.path === props.to || (props.to !== '/' && route.path.startsWith(props.to + '/')))
</script>
