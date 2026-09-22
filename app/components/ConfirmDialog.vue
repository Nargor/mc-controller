<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('update:modelValue', false)" />
      <div class="relative bg-dark-800 border border-dark-600 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 class="text-lg font-semibold text-white mb-2">{{ title }}</h3>
        <p class="text-dark-300 text-sm leading-relaxed mb-6">{{ message }}</p>
        <div class="flex gap-3 justify-end">
          <button @click="$emit('update:modelValue', false)" class="px-4 py-2 rounded-lg bg-dark-700 text-dark-200 hover:bg-dark-600 text-sm transition-colors">ยกเลิก</button>
          <button @click="$emit('confirm'); $emit('update:modelValue', false)"
            :class="['px-4 py-2 rounded-lg font-medium text-sm transition-colors', danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-mc-green hover:bg-green-300 text-dark-950']">
            {{ confirmText || 'ยืนยัน' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
defineProps<{ modelValue: boolean; title: string; message: string; confirmText?: string; danger?: boolean }>()
defineEmits(['update:modelValue', 'confirm'])
</script>
