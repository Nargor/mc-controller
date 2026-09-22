<template>
  <div v-if="server" class="max-w-4xl mx-auto p-5 sm:p-8">
    <h1 class="text-2xl font-bold text-white">Resources</h1>
    <p class="text-dark-400 text-sm mt-1">กำหนดทรัพยากร Java และ runtime ค่าใหม่จะใช้เมื่อเริ่มเซิร์ฟเวอร์ครั้งถัดไป</p>

    <form class="mt-6 space-y-5" @submit.prevent="save">
      <fieldset :disabled="!editable" class="space-y-5 disabled:opacity-50">
        <section class="panel">
          <h2>JVM resources</h2>
          <div class="grid sm:grid-cols-2 gap-4 mt-4">
            <label class="field">Initial memory (JVM)<input v-model.number="form.initial_memory_mb" type="number" min="256" required /><small>MB, ต้องไม่เกิน Maximum memory</small></label>
            <label class="field">Maximum memory (JVM)<input v-model.number="form.memory_mb" type="number" min="256" required /><small>MB</small></label>
            <label class="field">CPU limit<input v-model.number="form.cpu_limit" type="number" min="0" step="0.1" /><small>จำนวน CPU สูงสุด, 0 = ไม่จำกัด (Docker)</small></label>
            <label class="field">CPU reservation<input v-model.number="form.cpu_reservation" type="number" min="0" step="0.1" /><small>สัดส่วน CPU ที่จองไว้ (Docker)</small></label>
          </div>
        </section>

        <section class="panel">
          <h2>Java & JVM options</h2>
          <div class="grid sm:grid-cols-2 gap-4 mt-4">
            <label class="check"><input v-model="form.aikar_flags" type="checkbox" /> Use Aikar's flags</label>
            <label class="check"><input v-model="form.jmx_enabled" type="checkbox" /> Enable JMX</label>
            <label class="field sm:col-span-2">JVM options<textarea v-model="form.jvm_options" placeholder="เช่น -Dfile.encoding=UTF-8 หรือ 1 option ต่อบรรทัด" /></label>
            <label class="field sm:col-span-2">JVM XX options<textarea v-model="form.jvm_xx_options" placeholder="เช่น -XX:+UseStringDeduplication" /></label>
            <label class="field sm:col-span-2">System Properties (-D)<textarea v-model="form.system_properties" placeholder="เช่น file.encoding=UTF-8&#10;log4j2.formatMsgNoLookups=true" /></label>
            <label class="field sm:col-span-2">Additional arguments<textarea v-model="form.additional_arguments" placeholder="อาร์กิวเมนต์หลัง nogui (1 บรรทัดหรือคั่นด้วยช่องว่าง)" /></label>
            <label class="field sm:col-span-2">Timezone<input v-model.trim="form.timezone" placeholder="Asia/Bangkok" required /><small>ใช้รูปแบบ IANA เช่น Asia/Bangkok หรือ UTC</small></label>
          </div>
        </section>

        <section class="panel">
          <h2>Automatic idle behavior</h2>
          <p class="hint">ใช้สำหรับ itzg/minecraft-server เมื่อรันด้วย Docker; runtime ในเครื่องจะเก็บค่าไว้แต่ยังไม่ pause/stop อัตโนมัติ</p>
          <div class="grid sm:grid-cols-2 gap-4 mt-4">
            <label class="check"><input v-model="form.auto_stop_enabled" type="checkbox" /> Auto stop enable</label>
            <label class="check"><input v-model="form.auto_pause_enabled" type="checkbox" /> Auto pause enable</label>
            <label class="field">Initial timeout (seconds)<input v-model.number="form.initial_timeout_seconds" type="number" min="0" /><small>ตั้งแต่เริ่มเซิร์ฟเวอร์และยังไม่มีผู้เล่น</small></label>
            <label class="field">Established timeout (seconds)<input v-model.number="form.established_timeout_seconds" type="number" min="0" /><small>หลังผู้เล่นคนสุดท้ายออกจากเซิร์ฟเวอร์</small></label>
          </div>
        </section>

        <section v-if="isDocker" class="panel">
          <h2>Docker / Dokploy</h2>
          <div class="grid sm:grid-cols-2 gap-4 mt-4">
            <label class="field">Memory reservation (Docker)<input v-model.number="form.memory_reservation_mb" type="number" min="0" /><small>MB, 0 = ไม่จอง</small></label>
            <label class="field">Reconnect interface<input v-model.trim="form.reconnect_interface" placeholder="eth0" required /><small>ใช้สำหรับ auto pause, ค่าเริ่มต้น eth0</small></label>
            <label class="field">Linux user (UID)<input v-model.number="form.linux_uid" type="number" min="0" required /><small>ค่าเริ่มต้น 1000</small></label>
            <label class="field">Linux group (GID)<input v-model.number="form.linux_gid" type="number" min="0" required /><small>ค่าเริ่มต้น 1000</small></label>
          </div>
        </section>

        <section class="panel">
          <h2>Logs</h2>
          <div class="flex flex-col gap-3 mt-4">
            <label class="check"><input v-model="form.rolling_logs" type="checkbox" /> Rolling logs enable <span class="hint">(Docker)</span></label>
            <label class="check"><input v-model="form.show_log_timestamps" type="checkbox" /> Show time in logs enable</label>
          </div>
        </section>
      </fieldset>

      <p v-if="error" class="text-red-300 text-sm">{{ error }}</p>
      <button v-if="editable" class="button primary" :disabled="saving">{{ saving ? 'กำลังบันทึก…' : 'บันทึก Resources' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'server' })

const route = useRoute()
const store = useServersStore()
const id = route.params.id as string
const server = computed(() => store.servers.find(item => item.id === id))
const isDocker = computed(() => useRuntimeConfig().public.mcRuntime === 'docker')
const form = reactive<any>({})
const saving = ref(false)
const error = ref('')
const editable = computed(() => server.value?.status === 'stopped')

function assign() {
  if (!server.value) return
  Object.assign(form, server.value, {
    aikar_flags: Boolean(server.value.aikar_flags),
    jmx_enabled: Boolean(server.value.jmx_enabled),
    auto_stop_enabled: Boolean(server.value.auto_stop_enabled),
    auto_pause_enabled: Boolean(server.value.auto_pause_enabled),
    rolling_logs: Boolean(server.value.rolling_logs),
    show_log_timestamps: Boolean(server.value.show_log_timestamps),
  })
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await store.updateServer(id, form)
    assign()
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'บันทึกไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await store.fetchServer(id)
  assign()
})
</script>

<style scoped>
.panel { @apply rounded-2xl bg-dark-900 border border-dark-700 p-5 }
.panel h2 { @apply text-white font-semibold }
.field { @apply flex flex-col gap-1.5 text-sm text-dark-300 }
.field input, .field textarea { @apply rounded-lg bg-dark-800 border border-dark-600 px-3 py-2.5 text-white outline-none focus:border-mc-green }
.field textarea { @apply min-h-24 font-mono text-xs resize-y }
.field small, .hint { @apply text-xs text-dark-500 }
.check { @apply flex gap-2 items-center text-sm text-dark-300 }
.check input { @apply accent-green-400 }
.button { @apply rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 }
.primary { @apply bg-mc-green hover:bg-green-300 text-dark-950 }
</style>
