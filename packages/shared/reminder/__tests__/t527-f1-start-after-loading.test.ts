/// <reference types="vite/client" />
import { describe, expect, it } from 'vite-plus/test'

/**
 * T527 · F1 冷启动顺序（结构断言）
 *
 * @description 提醒引擎必须**在加载态结束之后**启动：`<app-dialog-adapter>` 只在
 *              `isLoading === false` 时挂载，`TASK_REMINDER_DIALOG_KEY` 于其中注册；
 *              未注册时 `DialogManager.open` 是 warn + 丢弃（`use-dialog-manager.ts:61`），
 *              而引擎顺序是 claim → notify → consume ⇒ 弹窗被丢时该条「已落账 + 已消费」
 *              ⇒ **永久不再出现**。故锁住「isLoading=false → await nextTick() → start()」的顺序。
 *              该竞态无法在单测中稳定复现（依赖挂载时序）⇒ 用文件级顺序断言防回归。
 *              与 AC10 结构断言同型；源码经 `import.meta.glob(?raw)` 读取（同仓既有做法，
 *              避免测试依赖 node 类型）。
 */

const sources = import.meta.glob('/apps/web/src/views/index/index-view.ts', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>

const source = Object.values(sources)[0] ?? ''

describe('T527 · F1 提醒引擎冷启动顺序', () => {
    it('目标源可读（读不到即视为断言空转）', () => {
        expect(source.length).toBeGreaterThan(1000)
    })

    it('isLoading 置 false → await nextTick() → reminderEngine.start()（顺序严格）', () => {
        const loadingDone = source.indexOf('isLoading.value = false')
        const tick = source.indexOf('await nextTick()')
        const start = source.indexOf('reminderEngine.start()')

        expect(loadingDone).toBeGreaterThan(-1)
        expect(tick).toBeGreaterThan(loadingDone)
        expect(start).toBeGreaterThan(tick)
    })

    it('start 只调用一次（首轮扫描即冷启动补弹，不得重复启动）', () => {
        expect(source.match(/reminderEngine\.start\(\)/g) ?? []).toHaveLength(1)
    })

    it('顺序位于 async finally 内（错误路径同样在加载态结束后启动）', () => {
        expect(source).toContain('.finally(async () => {')
    })

    it('卸载时停止引擎，且延迟启动不越过卸载（stop + 启动守卫）', () => {
        expect(source).toContain('reminderEngine.stop()')
        expect(source).toContain('isViewUnmounted = true')
        expect(source).toContain('if (isViewUnmounted) return')
    })
})