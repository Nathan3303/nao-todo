import type { Platform } from '@nao-todo/shared/commands'

/**
 * 平台判定（单一来源）
 * @description `$mod` 的展开与快捷键提示的键面都依赖同一判定：mac ⇒ meta / `⌘`，其余 ⇒ ctrl / `Ctrl`。
 *              键盘引擎（`use-keyboard-shortcuts`）与面板/帮助展示（`key-hint`）必须同源，禁各自探测。
 * @param nav 探测对象（默认取 `globalThis.navigator`；测试可注入假对象）
 */
export const detectPlatform = (
    nav: { platform?: string; userAgent?: string } | undefined = (
        globalThis as { navigator?: { platform?: string; userAgent?: string } }
    ).navigator
): Platform => {
    if (!nav) return 'win'
    if (/mac/i.test(nav.platform ?? '') || /mac/i.test(nav.userAgent ?? '')) return 'mac'
    return 'win'
}