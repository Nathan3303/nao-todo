<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import App from '@/App.vue'
import UnlockGate from './components/unlock-gate.vue'
import InitialSyncGate from './components/initial-sync-gate.vue'
import SyncStatusBar from './components/sync-status-bar.vue'
import { useLocalReminder } from './hooks/use-local-reminder'
import { useTaskReminder } from './hooks/usecases/use-task-reminder'
import { useUserStore } from '@nao-todo/presentation-identity'
import { TaskReminderDialog } from '@nao-todo/presentation/task'
import { useDialogManager } from '@nao-todo/shared'
import { cryptoService, localSession, syncService, syncTracker } from '@nao-todo/infrastructure'

defineOptions({ name: 'AppRoot' })

const router = useRouter()
const userStore = useUserStore()

// 本地数据解锁门：解锁完成后才渲染主应用（webapp 复用）
const unlocked = ref(false)
// 初始同步门：同步完成（成功）后才渲染主界面；失败由 InitialSyncGate 展示重试
const initialSynced = ref(false)

// 任务提醒对话框（desktop 独立 dialogManager 实例，与 webapp 内部互不干扰）
const reminderDialogManager = useDialogManager()
const reminderTaskUseCase = useTaskReminder()

// 本地提醒扫描器：解锁后启动，卸载时停止（精确调度 + Web 同款提醒 UI）
const {
    start: startReminder,
    stop: stopReminder,
    rescan: rescanReminder
} = useLocalReminder(reminderDialogManager)

// 变更后防抖推送接线（仓储写 → markDirty → 2s 合并推送，见 data-sync-plan.md §4.2）
// 同时触发提醒重扫：Snooze/改 remindAt 后立即重算精确调度（无需等兜底轮询）
syncTracker.setDirtyListener(() => {
    syncService.schedulePush()
    rescanReminder()
})

// 会话失效（10041 用户凭证验证失败）：仅删除 USER_JWT 并回登录页，不删除本地业务数据
syncService.setSessionExpiredListener(() => {
    userStore.clearAuthData() // localStorage.clear() → 删除 USER_JWT
    localSession.clear()
    cryptoService.lock()
    void router.replace('/auth/signin')
})

watch(unlocked, (value) => {
    if (value) {
        startReminder()
    }
})
onUnmounted(() => stopReminder())
</script>

<template>
    <UnlockGate v-if="!unlocked" @unlocked="unlocked = true" />
    <InitialSyncGate v-else-if="!initialSynced" @synced="initialSynced = true" />
    <App v-else />
    <SyncStatusBar v-if="unlocked && initialSynced" />
    <TaskReminderDialog
        :dialog-manager="reminderDialogManager"
        :task-use-case="reminderTaskUseCase"
    />
</template>