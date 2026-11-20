/**
 * 桌面端应用内自我更新（真实实现）
 *
 * @description 与 `apps/web/src/hooks/use-desktop-updater.ts`（Web 桩）**同名同形**，
 *              界面代码只看 `isDesktop` / `status` / `hintVisible`，无需端分支。
 *              全部通信经 preload 的窄封装（`window.desktopAPI.update`）转发主进程：
 *              单状态机 + 单订阅（`onStatus` 订阅时立即回放当前值）+ 三个 invoke 动作。
 *              **订阅与状态是模块级单例**：设置面板与侧栏齿轮共享同一份载荷（避免两处各订一次）；
 *              首个消费方调用时惰性订阅，之后常驻（应用生命周期内无需退订）。
 *              无桥 / 旧 preload / 测试桩 ⇒ `isDesktop:false`（面板回落到 Web 行），动作全部 no-op。
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC1–AC13 · 可测性前置 ④）
 * @see packages/shared/types/desktop-update.ts（载荷与通道契约）
 */
import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import type { DesktopUpdateBridge, DesktopUpdateStatus } from '@nao-todo/shared'
import {
    EMPTY_UPDATE_STATUS,
    formatUpdateBytes,
    readLastSeenUpdateVersion,
    resolveUpdateHintVisible,
    writeLastSeenUpdateVersion,
    type DesktopUpdater
} from '@nao-todo/webapp/src/hooks/use-desktop-updater'
import { getDesktopBridge } from '../desktop-bridge'

/** 旧 preload 无 `update` 命名空间 ⇒ 视作「无更新能力」（面板回落 Web 行，不出现死按钮） */

const status = ref<DesktopUpdateStatus>(EMPTY_UPDATE_STATUS)
const loaded = ref(false)
const lastSeenVersion = ref<string | null>(readLastSeenUpdateVersion())
let subscribed = false

const updateBridge = (): DesktopUpdateBridge | null => getDesktopBridge()?.update ?? null

/**
 * 惰性订阅（只订一次）
 * @description `onStatus` 契约：订阅时立即回放当前状态 ⇒ 不再额外 `getStatus()` 拉首帧
 *              （避免订阅与首拉双写造成一次无谓重渲染）
 */
const ensureSubscribed = (bridge: DesktopUpdateBridge): void => {
    if (subscribed) return
    subscribed = true
    try {
        bridge.onStatus((next) => {
            status.value = next
            loaded.value = true
        })
    } catch (error) {
        // 订阅失败（通道未注册 / 退出中）⇒ 保持 idle；上方设置页照常可用，不抛给界面
        subscribed = false
        console.error('[desktop] 订阅更新状态失败', error)
    }
}

/** 桌面端实现（状态由主进程推播；动作为显式调用，业务失败经 `state:'failed'` 回报） */
export const useDesktopUpdater = (): DesktopUpdater => {
    const bridge = updateBridge()
    if (bridge) ensureSubscribed(bridge)

    const apply = async (call: () => Promise<DesktopUpdateStatus>): Promise<void> => {
        try {
            status.value = await call()
            loaded.value = true
        } catch (error) {
            // transport 级失败（进程退出中 / 通道缺失）：保留上一份状态，不伪造 `failed`
            console.error('[desktop] 更新动作未完成', error)
        }
    }

    return {
        isDesktop: Boolean(bridge),
        status: readonly(status) as Readonly<Ref<DesktopUpdateStatus>>,
        loaded: readonly(loaded),
        hintVisible: computed(
            () => Boolean(bridge) && resolveUpdateHintVisible(status.value, lastSeenVersion.value)
        ) as ComputedRef<boolean>,
        check: () => (bridge ? apply(() => bridge.check()) : Promise.resolve()),
        download: () => (bridge ? apply(() => bridge.download()) : Promise.resolve()),
        restartToInstall: async (force?: boolean) => {
            if (!bridge) return
            try {
                await bridge.restartToInstall(force ? { force: true } : undefined)
            } catch (error) {
                console.error('[desktop] 重启安装未完成', error)
            }
        },
        openDownloadPage: () => {
            if (!bridge) return
            void bridge.openDownloadPage().catch((error: unknown) => {
                console.error('[desktop] 打开下载页失败', error)
            })
        },
        markSeen: () => {
            const version = status.value.latestVersion ?? null
            if (version === lastSeenVersion.value) return
            writeLastSeenUpdateVersion(version)
            lastSeenVersion.value = version
        }
    }
}

/** 体积格式化在 Web 模块单源（桌面实现仅转出，测试与文案口径一致） */
export { formatUpdateBytes }
export type { DesktopUpdater }