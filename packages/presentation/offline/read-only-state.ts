import { computed, ref } from 'vue'

/**
 * 离线状态（C-59 / AC10；阶段二 2A M6 后作用面收敛至身份域）
 * @description 端离线状态的**单一真源**：离线判定集中在此，消费方经 `write-gate`（写拦截）
 *              或本模块（离线 UI 角标 / C-60 freshness）读取，不得各处自写一套判定。
 *
 *              判定口径（离线）：
 *              ① `navigator.onLine === false`（浏览器网络状态，`online`/`offline` 事件同步）；
 *              ② **会话级离线进入 flag**（web 用户显式选择「离线进入」，见 `offline-entry`）。
 *              两者取或。
 *
 *              **消费面（阶段二 2A M6 收敛后）**：业务 7 域已切本地优先 ⇒ 离线**可写**（经
 *              `syncQueue` 回传），本模块**不再**约束业务写；现行作用面 = ① 身份域 `user` 离线写
 *              拦截（`write-gate` / `WRITE_METHODS_BY_KIND`）② 离线 UI 角标与 C-60 镜像新鲜度
 *              判定 ③ `offlineEntry` flag 生命周期（`offline-read-only.ts`）。
 *              （阶段一「离线 ⇒ 业务只读」口径已随 C-59 退场，见下方 ADR；本模块为保留项。）
 *
 *              注意：本模块只做状态判定，不产生任何 `markDirty`。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59 r10 / C-60 / C-66）
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md（§2.4 步骤 5 / §2.6 W5）
 */

/** 网络离线（由 `online`/`offline` 事件维护；冷启动时由 `startReadOnlyWatch` 同步） */
const offline = ref(false)

/** 会话级离线进入授权（web 显式选择；不落盘、刷新即失效） */
const offlineEntry = ref(false)

/** 是否处于只读（离线 / 离线进入） */
export const isReadOnly = (): boolean => {
    if (offlineEntry.value || offline.value) return true
    return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** 设置网络离线态（事件驱动；仅测试或监听器调用） */
export const setOffline = (value: boolean): void => {
    offline.value = value
}

/** 设置会话级离线进入态（web「离线进入」授予/撤销时调用） */
export const setOfflineEntryActive = (value: boolean): void => {
    offlineEntry.value = value
}

/** 响应式只读状态（供 UI 订阅；写入口用同步函数 `isReadOnly`） */
export const useReadOnlyState = () => ({
    offline,
    offlineEntry,
    isReadOnly: computed(() => offlineEntry.value || offline.value)
})

let watching = false

/**
 * 启动网络状态监听（幂等；应用启动时调用一次）
 * @description 无 `window`（测试/非浏览器环境）时 no-op；`isReadOnly` 仍会实时读 `navigator.onLine` 兜底。
 */
export const startReadOnlyWatch = (): void => {
    if (watching || typeof window === 'undefined') return
    watching = true
    const sync = (): void => setOffline(navigator.onLine === false)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
}

/** 重置模块状态（**仅测试**：避免跨用例状态泄漏） */
export const resetReadOnlyForTest = (): void => {
    offline.value = false
    offlineEntry.value = false
    watching = false
}