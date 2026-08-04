<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import App from '@/App.vue'
import UnlockGate from './components/unlock-gate.vue'
import { useLocalReminder } from './hooks/use-local-reminder'

defineOptions({ name: 'AppRoot' })

// 本地数据解锁门：解锁完成后才渲染主应用（webapp 复用）
const unlocked = ref(false)

// 本地提醒扫描器：解锁后启动，卸载时停止
const { start: startReminder, stop: stopReminder } = useLocalReminder()
watch(unlocked, (value) => {
    if (value) startReminder()
})
onUnmounted(() => stopReminder())
</script>

<template>
    <UnlockGate v-if="!unlocked" @unlocked="unlocked = true" />
    <App v-else />
</template>