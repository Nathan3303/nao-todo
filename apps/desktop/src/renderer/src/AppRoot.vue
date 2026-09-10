<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import App from '@/App.vue'
import UnlockGate from './components/unlock-gate.vue'
import InitialSyncGate from './components/initial-sync-gate.vue'
import SyncStatusBar from './components/sync-status-bar.vue'
import { useLocalReminder } from './hooks/use-local-reminder'
import { useTaskReminder } from './hooks/usecases/use-task-reminder'
import { grantOfflineEntry, revokeOfflineEntry } from '@/views/auth/offline-entry'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import { useUserStore } from '@nao-todo/presentation-identity'
import { TaskReminderDialog } from '@nao-todo/presentation/task'
import { useDialogManager } from '@nao-todo/shared'
import { cryptoService, localSession, syncService, syncTracker } from '@nao-todo/infrastructure'

defineOptions({ name: 'AppRoot' })

const router = useRouter()
const userStore = useUserStore()

// 本地数据解锁门：解锁完成后才渲染主应用（webapp 复用）
const unlocked = ref(false)
// 初始同步门：**门已通过**（同步成功或用户选择「离线进入」）后才渲染主界面；失败由 InitialSyncGate 引导
// （SHELL-03 D-3：语义是“门已通过”，非“同步成功”，故更名 gatePassed 避免误导后人）
const gatePassed = ref(false)

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
    revokeOfflineEntry() // C-25：会话失效必须清离线进入授权
    userStore.clearAuthData() // localStorage.clear() → 删除 USER_JWT
    localSession.clear()
    cryptoService.lock()
    void router.replace('/auth/signin')
})

/** 初始同步成功（门通过）：路由由来路决定，无需跳转 */
const onSynced = (): void => {
    revokeOfflineEntry() // C-25：在线成功 ⇒ 离线授权无意义，清掉
    gatePassed.value = true
}

/**
 * 离线进入（B-1：**跳转唯一点 = AppRoot**）
 * @description 顺序硬要求：授权 → **await replace 完成** → 才置 `gatePassed` 挂 `<App/>`；
 *              否则会短暂挂载 checkin 并触发其失败分支（把用户拖回登录页）。
 *              目标路由与 `index-view.ts` 检入成功路径一致（`router.afterEach` 不会写 `/auth/*`）。
 */
const onOffline = async (): Promise<void> => {
    grantOfflineEntry()
    await router.replace(localStorage.getItem(LAST_VISITED_ROUTE_KEY) || '/tasks')
    gatePassed.value = true
}

/** 登出/重新登录（B-1 同源修正：显式跳转，不依赖 checkin 失败“顺带”跳转） */
const onSignOut = async (): Promise<void> => {
    revokeOfflineEntry() // C-25：登出必须清离线进入授权
    await router.replace('/auth/signin')
    gatePassed.value = true
}

watch(unlocked, (value) => {
    if (value) {
        startReminder()
    }
})
onUnmounted(() => stopReminder())
</script>

<template>
    <UnlockGate v-if="!unlocked" @unlocked="unlocked = true" />
    <InitialSyncGate
        v-else-if="!gatePassed"
        @synced="onSynced"
        @offline="onOffline"
        @sign-out="onSignOut"
    />
    <App v-else />
    <SyncStatusBar v-if="unlocked && gatePassed" />
    <TaskReminderDialog
        :dialog-manager="reminderDialogManager"
        :task-use-case="reminderTaskUseCase"
    />
</template>