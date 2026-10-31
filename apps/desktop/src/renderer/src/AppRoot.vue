<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import App from '@/App.vue'
import { reportRouterInjection, resolveRouter } from '@/router-access'
import UnlockGate from './components/unlock-gate.vue'
import InitialSyncGate from './components/initial-sync-gate.vue'
import SyncStatusBar from '@/components/sync/sync-status-bar.vue'
import { grantOfflineEntry, revokeOfflineEntry } from '@/views/auth/offline-entry'
import { bootstrapLocalData, withBootstrapRetry } from '@/views/auth/bootstrap-local-data'
import { wipeLocalDataOnSignOut } from '@/views/auth/sign-out-wipe'
import { clearSessionCredentials, installSessionEnd } from '@/session-end'
import { LAST_VISITED_ROUTE_KEY, SECTION_LAST_ROUTE_MAP } from '@/router'
import { safeReplace, safeReplaceDeepLink } from '@/safe-navigation'
import { useUserStore } from '@nao-todo/presentation-identity'
import { useStoreInvalidationHub } from '@nao-todo/presentation/task'
import { Loading as LoadingComp } from '@nao-todo/shared/components/loading'
import { t } from '@nao-todo/shared/locales'
import { sendNotification } from '@nao-todo/shared/utils/notification'
import { useAuthUseCase } from '@/hooks'
// 续期接线是**桌面专属**模块（引 preload 桥与会话调度器）⇒ 走相对路径，不经 `@/hooks` 桶
// （桶在 Web/测试环境解析到 webapp 版，不含桌面专属导出）
import { useDesktopSessionRenewal } from './hooks/use-desktop-session-renewal'
// 托盘 tooltip 同步同样是**桌面专属**模块（引 preload 桥）⇒ 同上走相对路径，不经 `@/hooks` 桶
import { useTrayTooltip } from './hooks/use-tray-tooltip'
import { fireAuthExpiry } from '@nao-todo/shared/requester/auth-expiry'
import { resolveUserIdFromStoredJwt } from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { registerBackfillTriggers } from '@nao-todo/infrastructure/src/persistence-sync/backfill-triggers'
import {
    flushPreferenceQueue,
    pullAndMergeUserConfig
} from '@nao-todo/infrastructure/src/persistence-sync/preference-sync'
import { syncService } from '@nao-todo/infrastructure/src/persistence-sync/sync-service'
import { syncTracker } from '@nao-todo/infrastructure/src/persistence-sync/sync-tracker'

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
    .then(() => {
        // TASK-26 / M6：启动先拉取 + LWW 合并设置面，再冲刷偏好队列（非阻塞；失败静默降级）
        void pullAndMergeUserConfig().then(() => flushPreferenceQueue())
    })
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

// 变更后防抖推送接线（仓储写 → markDirty → 2s 合并推送，见 data-sync-plan.md §4.2）
// 任务提醒由 webapp 壳内的共享引擎统一负责（T527：桌面自有扫描器已下线，避免双弹）
syncTracker.setDirtyListener(() => {
    syncService.schedulePush()
})

// 应用级失效中心接线（DEF-STORE-06 方向 1：落库后经 hub 派发 RefreshData；幂等注册，见 store-invalidation.ts）
useStoreInvalidationHub()

// 会话失效（10041 / 10042）：清矩阵 + 回登录页**只有一处**（`@/session-end`，ADR D1）
// 同步层 / 续期 / 跨标签 / 请求器四路共用；本组件只负责注册同一处理者
installSessionEnd(router)

syncService.setSessionExpiredListener(() => {
    // 同步层只发布事件（AC1「请求层 / 同步层零清理」）
    fireAuthExpiry('credential-invalid')
})

// 常驻会话续期（AC6/AC11）：桌面端专属（Web 无 preload 桥 ⇒ 零行为变化）
const authUseCase = useAuthUseCase(userStore)
useDesktopSessionRenewal({
    isAuthenticated: () => userStore.getIsAuthenticated(),
    authToken: () => userStore.userToken,
    checkIn: (token) => authUseCase.checkIn(token),
    onCredentialExpired: () => {
        // AC8：窗口隐藏时先发系统通知（不得静默不再提醒），打开后停在登录引导
        sendNotification(t('session.expired.title'), t('session.expired.body'), { silent: true })
        fireAuthExpiry('credential-invalid')
    }
})

// 番茄计时写入托盘 tooltip（T576 #2）：无 preload 桥 / 旧桥缺方法 ⇒ 静默 no-op
useTrayTooltip()

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
    // 清认证（原 InitialSyncGate.onSignOut 职责；移至此处保证护栏先于清库）
    clearSessionCredentials()
    try {
        await safeReplace(router, '/auth/signin', 'app-root:signout-navigation')
    } finally {
        gatePassed.value = true
    }
}

// SHELL-06 C-40/C-43：回传触发（online / 前台恢复）仅作触发，不作鉴权；卸载清理防重复注册
// C-61③：常驻跨 7 天 ⇒ 顺带重跑启动收敛点（不新增定时器）
// TASK-26 / M6：偏好队列**复用**同一触发源冲刷（不新增重试机制）
const backfillTarget = {
    handleOnline: () => {
        syncService.handleOnline()
        void flushPreferenceQueue()
    },
    handleVisibility: () => {
        syncService.handleVisibility()
        void flushPreferenceQueue()
    }
}
const unregisterBackfillTriggers = registerBackfillTriggers(withBootstrapRetry(backfillTarget))

onUnmounted(() => {
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
</template>