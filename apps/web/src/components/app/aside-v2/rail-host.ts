import { shallowRef } from 'vue'

/**
 * SHELL-02 侧栏底部注入点（同步状态组件经 Teleport 消费）
 * @description 与 components/settings/dialog/state.ts 的 hostReady 模式同构：宿主元素挂载/卸载时
 *              置位与清空。消费侧用「元素目标 + v-if 门控」而非字符串选择器，规避 Vue Teleport
 *              字符串目标仅在挂载时解析一次、失败即 warn 且不渲染的失效模式。
 *              T521：注入点支持两种变体（桌面 rail / 移动抽屉），**同一时刻仅一个宿主**——
 *              两变体共用同一个 ref（单一来源），变体切换时改绑；`unbind` 带元素令牌，
 *              迟到的旧宿主解绑不会抢走新宿主（Vue 新旧子树卸载/挂载次序不定）。
 * @see docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md（D-1/D-2、C1/C4/C5）
 * @see docs/prds/2026-10-22-aside-drawer-sync-and-settings.md（不变量 2：单一宿主）
 */

/** 注入点所在变体（rail = 桌面占位侧栏；drawer = 移动端抽屉） */
export type AsideBottomHostVariant = 'rail' | 'drawer'

/** 注入点元素（宿主不在屏时为 null） */
export const railBottomHost = shallowRef<HTMLElement | null>(null)

/** 当前宿主所属变体（无宿主时为 null） */
export const railBottomHostVariant = shallowRef<AsideBottomHostVariant | null>(null)

/** 宿主元素挂载时调用（变体切换即改绑到新宿主） */
export const bindRailBottomHost = (
    el: HTMLElement,
    variant: AsideBottomHostVariant = 'rail'
): void => {
    railBottomHost.value = el
    railBottomHostVariant.value = variant
}

/**
 * 宿主元素卸载时调用（防残留指向脱文档旧元素）
 * @param el 传入时仅在「仍是当前宿主」时清空 —— 切变体时旧宿主迟到的解绑不得清掉新宿主
 */
export const unbindRailBottomHost = (el?: HTMLElement | null): void => {
    if (el && railBottomHost.value !== el) return
    railBottomHost.value = null
    railBottomHostVariant.value = null
}