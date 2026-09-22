<template>
  <div class="min-h-screen bg-dark-950 flex flex-col">
    <nav class="bg-dark-900 border-b border-dark-700 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
      <NuxtLink to="/" class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-mc-green flex items-center justify-center text-dark-950 font-bold">⛏</div>
        <span class="font-semibold text-white text-lg">MC Controller</span>
      </NuxtLink>
      <div class="flex items-center gap-4">
        <span class="text-dark-400 text-sm hidden sm:block">{{ auth.user?.username }}</span>
        <button @click="auth.logout()" class="text-dark-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-dark-700 transition-colors">
          ออกจากระบบ
        </button>
      </div>
    </nav>
    <main class="flex-1"><slot /></main>
  </div>
</template>
<script setup lang="ts">
const auth = useAuthStore()
</script>
