<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import App from '@/App.vue'
import UnlockGate from './components/unlock-gate.vue'
import SyncStatusBar from './components/sync-status-bar.vue'
import { useLocalReminder } from './hooks/use-local-reminder'
import { syncService, syncTracker } from '@nao-todo/infrastructure'

defineOptions({ name: 'AppRoot' })

// 本地数据解锁门：解锁完成后才渲染主应用（webapp 复用）
const unlocked = ref(false)

// 变更后防抖推送接线（仓储写 → markDirty → 2s 合并推送，见 data-sync-plan.md §4.2）
syncTracker.setDirtyListener(() => syncService.schedulePush())

// 本地提醒扫描器：解锁后启动，卸载时停止
const { start: startReminder, stop: stopReminder } = useLocalReminder()
watch(unlocked, (value) => {
    if (value) {
        startReminder()
        // 解锁后启动数据同步（先拉后推；注销反悔期内自动跳过）
        void syncService.start()
    }
})
onUnmounted(() => stopReminder())
</script>

<template>
    <UnlockGate v-if="!unlocked" @unlocked="unlocked = true" />
    <App v-else />
    <SyncStatusBar v-if="unlocked" />
</template>