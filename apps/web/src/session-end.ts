/**
 * 会话结束执行单点（ADR D1 / D2 / D6）
 *
 * @description 一次「会话失效」事件的动作集合**只在此处定义**（清理矩阵）：
 * | 项                                          | 动作 |
 * | :------------------------------------------ | :--- |
 * | 会话凭证（JWT + store + 离线授权 + 轮换窗） | 清   |
 * | 内存 DEK                                    | 锁   |
 * | 本地业务数据（11 表）                       | 留   |
 * | 密钥包（meta）                              | 留   |
 * | 同步队列 / 游标 / 操作日志                  | 留（停发停写由同步层的会话门负责） |
 *
 * 三条硬约束（扫描用例 `auth-seam-scan.test.ts` 即其判据）：
 * 1. 请求层 / 同步层**只发布事件**（`fireAuthExpiry`），不得自己清理；
 * 2. 清理原语（`localSession.clear` / `cryptoService.lock` / `resetTokenRotation`）的调用文件
 *    只能是本模块与既有登出白名单（`use-settings-sign-out` / `sign-out-broadcast` /
 *    `unlock-gate` / 桌面 `binding`）；
 * 3. 本模块**不得**触碰业务数据与密钥包（`D2` 矩阵：留 11 表、留密钥包）。
 *
 * 路数：**3 路**发布方（axios 请求器 / 后台同步 / 常驻续期）+ **1 路**跨标签广播（收广播的标签
 * 只清认证、不回广播）均收敛到 `handleSessionEnd`。
 *
 * W3（`DEF-92` / ADR D5）：失效类别在**清凭据之前**按本地证据推断（JWT `exp`），落
 * `sessionStorage`（只存类别枚举），供共享登录页组件 `sign-in.vue` 渲染顶部横幅。
 *
 * @see docs/adr/2026-10-31-credential-coherence.md（D1 / D2 / D4 / D6）
 */
import { useRouter } from 'vue-router'
import { useUserStore } from '@nao-todo/presentation-identity'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { cryptoService } from '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service'
import {
    localSession,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { resetTokenRotation } from '@nao-todo/shared/requester/auth-rotation'
import { onAuthExpiry, type AuthExpiryReason } from '@nao-todo/shared/requester/auth-expiry'
import {
    inferSessionEndCategory,
    writeSessionEndCategory
} from '@nao-todo/shared/requester/session-end-reason'
import { safeReplace, type SafeNavigationRouter } from '@/safe-navigation'
import { revokeOfflineEntry } from '@/views/auth/offline-entry'
import { broadcastSignOut } from '@/views/auth/sign-out-broadcast'

/** 显式绑定的 router（装配面在入口处绑定；组件内兜底用 `useRouter`） */
let boundRouter: SafeNavigationRouter | undefined

/**
 * 绑定会话结束使用的 router
 * @description 失效回调常在请求拦截器里触发（无组件上下文）⇒ 必须显式绑定；
 *              桌面端与 web 端在各自入口绑**同一个** router 实例。
 */
export const bindSessionEndRouter = (router: SafeNavigationRouter | undefined): void => {
    boundRouter = router
}

/** 取导航 router（优先显式绑定；组件上下文兜底；都不可用返回 undefined） */
const resolveRouter = (): SafeNavigationRouter | undefined => {
    if (boundRouter) return boundRouter
    try {
        return useRouter() as unknown as SafeNavigationRouter
    } catch {
        return undefined
    }
}

/**
 * 清会话凭证（矩阵「清」列的四项 + 锁内存 DEK）
 * @description **不含导航、不碰业务数据**；登出路径（`AppRoot` 的显式登出）也复用它，
 *              以保持「清认证」只有一处实现。
 */
export const clearSessionCredentials = (): void => {
    revokeOfflineEntry()
    useUserStore().clearAuthData()
    localSession.clear()
    cryptoService.lock()
    resetTokenRotation()
}

/** 会话结束选项（跨标签复用同一单点时可指定 router 与导航标记） */
export type SessionEndOptions = {
    router?: SafeNavigationRouter
    /** 导航诊断标记（结构化日志/错误上报的归因） */
    navigationTag?: string
}

/**
 * 处理一次会话结束（推断类别 + 清矩阵 + 广播 + 回登录页）
 * @description **幂等**由事件单例的单闩保证（`fireAuthExpiry` 只投递一次）；
 *              直接调用本函数不做二次去重（测试与装配面需要可重复驱动）。
 *              顺序硬约束：**先推断类别（需要 token）→ 落 `sessionStorage` → 清凭据
 *              → 广播（其它标签据此显示同一横幅）→ 导航**；颠倒任一步都会让横幅丢类别。
 * @param reason 失效类别（发布方给的占位值；未知 ⇒ 通用兜底）
 * @param options router / 导航标记覆盖（跨标签接收方复用本单点）
 */
export const handleSessionEnd = async (
    reason?: AuthExpiryReason,
    options?: SessionEndOptions
): Promise<void> => {
    const router = options?.router ?? resolveRouter()
    const token =
        typeof localStorage === 'undefined' ? null : localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
    const category = inferSessionEndCategory(reason, token)
    writeSessionEndCategory(category)
    const userId = resolveUserIdFromStoredJwt()
    clearSessionCredentials()
    // W3/AC5：其它标签据此回登录页并显示**同一**类别（主动登出不走本函数 ⇒ 不给横幅）
    broadcastSignOut(userId ?? '', category)
    await safeReplace(router, '/auth/signin', options?.navigationTag ?? 'session-end:navigation')
}

/**
 * 安装会话结束处理者（装配面调用；单槽注册，两端重复调用无害）
 * @description 桌面端 `main.ts` 与 web `app.ts` 都注册**同一个**处理者 ⇒ D4「1 个有效处理者 + 1 个闩」。
 */
export const installSessionEnd = (router?: SafeNavigationRouter): void => {
    if (router) bindSessionEndRouter(router)
    onAuthExpiry((reason) => {
        void handleSessionEnd(reason)
    })
}