// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { usePomodoroSessionStore, usePomodoroTimerStore } from '..'

/**
 * T456 ① 「结束专注」落库语义
 * @description 原 `reset`（结束专注按钮）不落库 ⇒ 侧栏/记录页无此记录；
 *              新增 `end()`（落库 + 回 idle，与正计时 `end()` 语义一致）；
 *              `reset()` 保留为「真取消 / 互斥安全网」（不落库）。
 */

let timer: ReturnType<typeof usePomodoroTimerStore>

beforeEach(() => {
    setActivePinia(createPinia())
    const session = usePomodoroSessionStore()
    session.setFocusDuration(1500)
    timer = usePomodoroTimerStore()
    timer.updateConfig()
})

afterEach(() => {
    timer.destroy()
})

const spyFn = () => vi.fn(async () => [null, null])

describe('T456 ① 番茄专注「结束专注」落库', () => {
    it('end() ⇒ 调用 createRecordFn 一次并回 idle', () => {
        const fn = spyFn()
        timer.setCreateRecordFn(fn as never)
        timer.start()
        timer.end()
        expect(fn).toHaveBeenCalledTimes(1)
        expect(timer.phase).toBe('idle')
    })

    it('自然完成路径（skip）仍落库（回归）', () => {
        const fn = spyFn()
        timer.setCreateRecordFn(fn as never)
        timer.start()
        timer.skip()
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('reset()（真取消 / 互斥安全网）不落库', () => {
        const fn = spyFn()
        timer.setCreateRecordFn(fn as never)
        timer.start()
        timer.reset()
        expect(fn).not.toHaveBeenCalled()
        expect(timer.phase).toBe('idle')
    })
})