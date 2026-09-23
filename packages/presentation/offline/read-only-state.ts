import { computed, ref } from 'vue'

/**
 * 阶段一离线只读状态（C-59 / AC10 单一真源）
 * @description 阶段一「只读离线镜像」的**唯一开关**：写入口统一经 `write-gate` 读取本模块判定，
 *              不得逐个改仓储、不得逐个 UI 入口各写一套判定。
 *
 *              判定口径（离线 ⇒ 只读）：
 *              ① `navigator.onLine === false`（浏览器网络状态，`online`/`offline` 事件同步）；
 *              ② **会话级离线进入 flag**（web 用户显式选择「离线进入」，见 `offline-entry`）。
 *              两者取或；在线写照常（web 走远端、desktop 走本地 + push）。
 *
 *              注意：本模块**只读**，不产生任何 `markDirty`（C-59）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59 / C-60 / C-66）
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