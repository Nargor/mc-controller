<template>
  <span :class="['inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', cfg.cls]">
    <span :class="['w-1.5 h-1.5 rounded-full', cfg.dot]" />{{ cfg.label }}
  </span>
</template>
<script setup lang="ts">
const props = defineProps<{ status?: string }>()
const MAP: Record<string,any> = {
  running:  { label:'กำลังทำงาน', cls:'bg-green-900/50 text-green-300',   dot:'bg-green-400 animate-pulse' },
  starting: { label:'กำลังเริ่ม', cls:'bg-yellow-900/50 text-yellow-300', dot:'bg-yellow-400 animate-pulse' },
  stopping: { label:'กำลังหยุด', cls:'bg-orange-900/50 text-orange-300', dot:'bg-orange-400 animate-pulse' },
  stopped:  { label:'หยุดอยู่',  cls:'bg-dark-700 text-dark-400',         dot:'bg-dark-500' },
  error:    { label:'ข้อผิดพลาด',cls:'bg-red-900/50 text-red-300',        dot:'bg-red-400' },
}
const cfg = computed(() => MAP[props.status||''] || MAP.stopped)
</script>
