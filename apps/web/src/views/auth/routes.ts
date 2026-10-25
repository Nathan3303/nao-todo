import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@nao-todo/presentation-identity'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import {
    localSession,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { syncService } from '@nao-todo/infrastructure/src/persistence-sync/sync-service'
import { isOfflineEntryGranted } from './offline-entry'
import { evaluateOfflinePrerequisites, hasLocalMirror } from './offline-prerequisites'
import { bootstrapLocalData } from './bootstrap-local-data'

// @typedef AuthViewRoutes 身份验证视图路由
const routes: RouteRecordRaw = {
    path: '/auth',
    name: 'auth',
    props: true,
    component: () => import('./entry.vue'),
    children: [
        {
            path: 'signin',
            name: 'auth-signin',
            component: () => import('@/components/auth/sign-in-page.vue')
        },
        {
            path: 'signup',
            name: 'auth-signup',
            component: () => import('@/components/auth/sign-up-page.vue')
        },
        {
            path: 'checkin',
            name: 'auth-checkin',
            component: () => import('@/components/auth/check-in-page.vue')
        }
    ]
}

/**
 * 中转目标查询串（DEF-59 / PRD R3）
 * @description 只有**显式目标**才携带 `redirect`；`/` = 默认入口 ⇒ **不捕获**（回落语义仍归
 *              `LAST_VISITED_ROUTE`）。⛔ 本函数**不写** `LAST_VISITED_ROUTE`：写回由 `router.ts`
 *              的 `afterEach` 在**最终路由**上完成（否则中转地址会自我强化、顶掉深链）。
 */
const redirectQueryOf = (to?: { fullPath?: string }): { redirect: string } | undefined => {
    const fullPath = to?.fullPath
    if (!fullPath || fullPath === '/') return undefined
    return { redirect: fullPath }
}

/** 携带（可选的）深链目标返回 auth 中转路由 */
const redirectTo = (name: 'auth-checkin' | 'auth-signin', to?: { fullPath?: string }) => {
    const query = redirectQueryOf(to)
    return query ? { name, query } : { name }
}

// @typedef AuthViewRoutesBeforeEnter 身份验证视图路由守卫
const beforeEnter = async (to?: { fullPath?: string }) => {
    // SHELL-03 附录 B-2 / C-62：离线进入放行（**全为本地事实**；任一不满足 ⇒ 落回下方既有三分支）
    // ① 用户本会话显式授予（会话级内存 flag，不落盘）
    // ② JWT 存在且可解析出 userId  ③ 内存会话与 JWT 同一用户
    // ④ 本地镜像存在（原「本地保险库已解锁」= DEF-16 恒假 ⇒ 已替换，原因码 mirror-missing）
    // 禁用项：不得用 navigator.onLine（网通但服务端不可达时不可靠）、不得用昵称缓存（C-19 明文禁参与守卫）
    if (isOfflineEntryGranted()) {
        const jwtUserId = resolveUserIdFromStoredJwt()
        const sessionUserId = localSession.getCurrentUserId()
        const hasMirror = jwtUserId !== null ? await hasLocalMirror(jwtUserId) : false
        const prerequisites = evaluateOfflinePrerequisites({
            jwtUserId,
            sessionUserId,
            hasLocalMirror: hasMirror
        })
        if (prerequisites.ok) {
            // C-61②：门 B 通过、挂载 App 前的启动收敛点（必须早于 syncService.start()）
            await bootstrapLocalData(jwtUserId)
            // T108 补充 / AC8 首帧：从 `meta` 恢复镜像新鲜度（T107b 已持久化）⇒ 离线冷启动
            // 首帧即「数据截至 X」，不先闪「尚未同步完成」。必须紧跟 `bootstrapLocalData()`
            // （后者重建 `localSession`，`restoreMirrorStatus` 依赖当前 userId）。
            await syncService.restoreMirrorStatus()
            return true
        }
    }
    // 获取 LocalStorage 中的 JWT 令牌
    const jwt = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
    // 若有 JWT 令牌且未登录，跳转到检入页
    const userStore = useUserStore()
    if (jwt !== null && !userStore.getIsAuthenticated()) return redirectTo('auth-checkin', to)
    // 若没有 JWT 令牌且未登录，跳转到登录页
    else if (jwt === null && !userStore.getIsAuthenticated()) return redirectTo('auth-signin', to)
    // 若有 JWT 令牌且已登录，放行
    else if (jwt !== null && userStore.getIsAuthenticated()) {
        // C-61②：web 无 AppRoot ⇒ 门 B 通过、挂载 App 前的等价收敛点
        await bootstrapLocalData()
        // T108 补充 / AC8 首帧：同上，先恢复镜像新鲜度再放行
        await syncService.restoreMirrorStatus()
        return true
    }
    // 若没有 JWT 令牌且已登录，则跳转到检入页
    else return redirectTo('auth-checkin', to)
}

export default routes
export { beforeEnter }