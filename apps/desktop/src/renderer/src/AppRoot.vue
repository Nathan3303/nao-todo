<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import App from '@/App.vue'
import { reportRouterInjection, resolveRouter } from '@/router-access'
import UnlockGate from './components/unlock-gate.vue'
import InitialSyncGate from './components/initial-sync-gate.vue'
import SyncStatusBar from './components/sync-status-bar.vue'
import { useLocalReminder } from './hooks/use-local-reminder'
import { useTaskReminder } from './hooks/usecases/use-task-reminder'
import { grantOfflineEntry, revokeOfflineEntry } from '@/views/auth/offline-entry'
import { bootstrapLocalData, withBootstrapRetry } from '@/views/auth/bootstrap-local-data'
import { wipeLocalDataOnSignOut } from '@/views/auth/sign-out-wipe'
import { LAST_VISITED_ROUTE_KEY, SECTION_LAST_ROUTE_MAP } from '@/router'
import { safeReplace, safeReplaceDeepLink } from '@/safe-navigation'
import { useUserStore } from '@nao-todo/presentation-identity'
import { TaskReminderDialog, useStoreInvalidationHub } from '@nao-todo/presentation/task'
import { Loading as LoadingComp, useDialogManager } from '@nao-todo/shared'
import {
    cryptoService,
    localSession,
    registerBackfillTriggers,
    resolveUserIdFromStoredJwt,
    syncService,
    syncTracker
} from '@nao-todo/infrastructure'

defineOptions({ name: 'AppRoot' })

// SHELL-05 T1/C-37：实例无关的 router 访问（useRouter 优先，$router 降级）+ 启动自检
const routerResolution = resolveRouter()
reportRouterInjection(routerResolution)
const router = routerResolution.router

const userStore = useUserStore()

// C-61①：本地数据启动收敛点 —— 渲染**任一门前** await（含早于 InitialSyncGate.start()）
// 失败不卡门：记录后仍推进 bootstrapped（后续解锁门自身有 error 终态）
const bootstrapped = ref(false)
void bootstrapLocalData()
    .catch((err) => {
        console.error('[desktop] 启动本地数据收敛失败', err)
    })
    .finally(() => {
        bootstrapped.value = true
    })

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

// 应用级失效中心接线（DEF-STORE-06 方向 1：落库后经 hub 派发 RefreshData；幂等注册，见 store-invalidation.ts）
useStoreInvalidationHub()

// 会话失效（10041 用户凭证验证失败）：仅删除 USER_JWT 并回登录页，不删除本地业务数据
syncService.setSessionExpiredListener(() => {
    revokeOfflineEntry() // C-25：会话失效必须清离线进入授权
    userStore.clearAuthData() // localStorage.clear() → 删除 USER_JWT
    localSession.clear()
    cryptoService.lock()
    // C-35：统一导航封装（失败结构化记录，不抛错）
    void safeReplace(router, '/auth/signin', 'app-root:session-expired-navigation')
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
    try {
        // C-28/C-35：回退链 LAST_VISITED → SECTION_LAST(tasks) → '/tasks'，逐项 resolve 校验 + 失效键清理
        const tasksRouteKey = SECTION_LAST_ROUTE_MAP.tasks!
        await safeReplaceDeepLink(
            router,
            [
                {
                    key: LAST_VISITED_ROUTE_KEY,
                    value: localStorage.getItem(LAST_VISITED_ROUTE_KEY)
                },
                { key: tasksRouteKey, value: localStorage.getItem(tasksRouteKey) }
            ],
            '/tasks',
            'app-root:offline-navigation',
            localStorage
        )
    } finally {
        // 终态推进必须在 finally：任何异常/失败仍进入壳（永不卡门）
        gatePassed.value = true
    }
}

/**
 * 登出/重新登录（B-1 同源修正：显式跳转，不依赖 checkin 失败“顺带”跳转）
 * @description C-54/C-52 编排：**先脏队列护栏、再清库、最后清认证 + 跳转**。
 *              护栏取消 ⇒ 立即中止（保留会话与本地数据，不清库、不跳转）。
 *              10041 会话失效不在此路径（见上方 listener，K4：只清身份键、不清库）。
 */
const onSignOut = async (): Promise<void> => {
    // C-54：脏队列阻塞确认（先于清库/清认证；取消则中止）
    const userId = resolveUserIdFromStoredJwt()
    if (userId && !(await wipeLocalDataOnSignOut(userId))) return
    revokeOfflineEntry() // C-25：登出必须清离线进入授权
    // 清认证（原 InitialSyncGate.onSignOut 职责；移至此处保证护栏先于清库）
    userStore.clearAuthData()
    localSession.clear()
    cryptoService.lock()
    try {
        await safeReplace(router, '/auth/signin', 'app-root:signout-navigation')
    } finally {
        gatePassed.value = true
    }
}

// SHELL-06 C-40/C-43：回传触发（online / 前台恢复）仅作触发，不作鉴权；卸载清理防重复注册
// C-61③：常驻跨 7 天 ⇒ 顺带重跑启动收敛点（不新增定时器）
const unregisterBackfillTriggers = registerBackfillTriggers(withBootstrapRetry(syncService))

watch(unlocked, (value) => {
    if (value) {
        startReminder()
    }
})
onUnmounted(() => {
    stopReminder()
    unregisterBackfillTriggers()
})
</script>

<template>
    <LoadingComp v-if="!bootstrapped" placeholder="正在检查本地数据 ..." />
    <UnlockGate v-else-if="!unlocked" @unlocked="unlocked = true" />
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