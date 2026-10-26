/**
 * 桌面端会话续期接线（AC6 / AC8 / AC11 / T3 / R4）
 *
 * @description 只在桌面端（有 preload 桥）启动：把「纯调度器」（`@nao-todo/shared/session-renewal`）
 *              接到真实的 checkin 与触发源上 ——
 *              - 触发补集：启动 / 定时 12h±10% / 联网（`online`）/ 回前台（`visibilitychange`）/
 *                系统唤醒（主进程 `powerMonitor.resume` 推送）；
 *              - 空闲门：同步在途时不续期（避免轮换与在途请求打架，评审 §五 5.3）；
 *              - 网络失败：不清凭证、退避重试（调度器内部）；
 *              - 凭证失败：停续期 + **一次**可见提示（隐藏态走系统通知，见 `onCredentialExpired`）。
 *              未登录（无 JWT）时**不启动**（否则会在登录页把「无凭证」当凭证失效误报）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC6 / AC8 / AC11）
 * @see docs/reports/T543-arch-review.md（§五 5.3 续期时序与失败分流）
 */
import { onUnmounted, watch } from 'vue'
import { isCredentialError } from '@nao-todo/domain-identity'
import {
    createRenewalScheduler,
    getLastCheckInAttemptAt,
    type RenewalCheckInResult
} from '@nao-todo/shared/session-renewal'
import { syncStatus } from '@nao-todo/infrastructure/src/persistence-sync/sync-status'
import { getDesktopBridge } from '../desktop-bridge'

export interface DesktopSessionRenewalOptions {
    /** 当前登录凭证（**响应式**取值：登录/登出即时启停续期） */
    authToken(): string
    /** 是否已认证（**响应式**；Issue #260 修复④：冷启动 JWT 在而未检入时不启动续期，
     *  避免与检入页双发 checkin ⇒ 轮换自伤）；登录/登出/切号即时启停 */
    isAuthenticated(): boolean
    /** 复用既有认证用例（内部已含 `DEF-5` 网络/凭证分流） */
    checkIn(token: string): Promise<string | null>
    /** 凭证失效（隐藏态先发系统通知；打开后走既有登录引导） */
    onCredentialExpired(): void
}

/**
 * 启动桌面端会话续期（Web / 未登录 ⇒ 不产生任何定时器与请求）
 * @param options 认证用例与凭证失效回调
 */
export const useDesktopSessionRenewal = (options: DesktopSessionRenewalOptions): void => {
    const bridge = getDesktopBridge()
    if (!bridge?.isDesktop) return

    const scheduler = createRenewalScheduler({
        checkIn: async (): Promise<RenewalCheckInResult> => {
            const token = options.authToken()
            // 无凭证（已登出）：按网络类处理（不停摆，等下次登录重排；凭证失效不在此路径）
            if (!token) return 'network-error'
            const error = await options.checkIn(token)
            if (error === null) return 'success'
            return isCredentialError(error) ? 'credential-error' : 'network-error'
        },
        now: () => Date.now(),
        lastCheckInAt: () => getLastCheckInAttemptAt(),
        timers: {
            set: (callback, delayMs) => window.setTimeout(callback, delayMs),
            clear: (handle) => window.clearTimeout(handle as number)
        },
        // 空闲门：同步在途时不续期（轮换窗口留给空闲期）
        isIdle: () => !syncStatus.get().syncing,
        onCredentialExpired: () => options.onCredentialExpired()
    })

    // 已认证且有凭证才启动（Issue #260 修复④：冷启动「JWT 在但未检入」不启动，
    // 避免调度器与检入页双发 checkin ⇒ 旧 token 轮换 ⇒ 10041 自伤；登出/切号即停）
    watch(
        () => [options.isAuthenticated(), options.authToken()] as const,
        ([authed, token]) => {
            if (authed && token) void scheduler.start()
            else scheduler.stop()
        },
        { immediate: true }
    )

    const handleOnline = (): void => {
        void scheduler.trigger('online')
    }
    const handleVisibility = (): void => {
        if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
        void scheduler.trigger('resume')
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
    const offPowerResume = bridge.onPowerResume(() => {
        void scheduler.trigger('resume')
    })

    onUnmounted(() => {
        scheduler.stop()
        window.removeEventListener('online', handleOnline)
        document.removeEventListener('visibilitychange', handleVisibility)
        offPowerResume()
    })
}