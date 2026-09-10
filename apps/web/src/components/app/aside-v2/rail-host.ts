import { shallowRef } from 'vue'

/**
 * SHELL-02 侧栏 70px 轨道底部注入点（桌面端同步状态组件经 Teleport 消费）
 * @description 与 components/settings/dialog/state.ts 的 hostReady 模式同构：宿主元素挂载/卸载时
 *              置位与清空。消费侧用「元素目标 + v-if 门控」而非字符串选择器，规避 Vue Teleport
 *              字符串目标仅在挂载时解析一次、失败即 warn 且不渲染的失效模式。
 * @see docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md（D-1/D-2、C1/C4/C5）
 */

/** 轨道底部注入点元素（宿主不在屏时为 null） */
export const railBottomHost = shallowRef<HTMLElement | null>(null)

/** 宿主元素挂载时调用 */
export const bindRailBottomHost = (el: HTMLElement): void => {
    railBottomHost.value = el
}

/** 宿主元素卸载时调用（防残留指向脱文档旧元素） */
export const unbindRailBottomHost = (): void => {
    railBottomHost.value = null
}