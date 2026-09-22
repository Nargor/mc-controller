<template>
  <div class="min-h-screen bg-dark-950 text-dark-100">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
* { box-sizing: border-box; }
html { color-scheme: dark; }
body { margin: 0; background: #0a0a0a; color: #e8e8e8; font-family: 'Inter', system-ui, sans-serif; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #141414; }
::-webkit-scrollbar-thumb { background: #383838; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #505050; }
</style>
