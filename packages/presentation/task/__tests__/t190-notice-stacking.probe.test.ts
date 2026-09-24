// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import {
    ARCHIVED_READONLY_ERROR,
    TASK_ARCHIVE_WRITE_METHODS,
    resetArchiveGateForTest,
    withArchivedReadOnlyGuard
} from '../archive-gate'
import type { TaskUseCase } from '@nao-todo/domain-task'
import { TaskHandler } from '../handlers/task'

/**
 * T190 · 行为探针：归档只读守卫 + `TaskHandler` 是否**一次操作弹两条**
 *
 * 背景（`T184` §7 遗留观察）：守卫命中时 `withArchivedReadOnlyGuard` 自弹 `NueMessage.warn(readOnlyHint)`，
 * 而 `TaskHandler` 收到守卫返回的 `ARCHIVED_READONLY` 后走 `notifyError → translateTaskError → unwrapError`
 * 再弹一条 `NueMessage.error`。本探针用**极小行为级证据**判定这两条是否真的同时出现。
 *
 * 组合方式与生产一致：`useTaskUseCase` 先被 `binding.decorateUseCase(…, 'task')` 套上守卫，
 * `TaskHandler` 再接收该（已被守卫包裹的）任务用例（见 `apps/web/src/hooks/usecases/use-task-usecase.ts`
 * 与 `use-app-handlers.ts`）。
 *
 * 结论（见报告）：**一次操作确实弹两条**（守卫 `warn` 1 条 + handler `error` 1 条）；
 * 守卫 `warn` 受 1200ms 节流，窗口内重复操作只余 `error` 一条。
 */

describe('T190 · 归档守卫 + TaskHandler 提示叠加探针', () => {
    beforeEach(() => {
        resetArchiveGateForTest()
    })
    afterEach(() => {
        resetArchiveGateForTest()
        vi.restoreAllMocks()
    })

    const makeGuardedHandler = (archived = true) => {
        const update = vi.fn(async () => 'SHOULD_NOT_BE_CALLED')
        const guarded = withArchivedReadOnlyGuard(
            { update } as unknown as object,
            TASK_ARCHIVE_WRITE_METHODS,
            { isArchivedTarget: async () => archived }
        ) as unknown as TaskUseCase
        const handler = new TaskHandler(guarded, { emit: vi.fn() } as never)
        return { handler, update }
    }

    it('归档任务 → 单次 update：守卫 warn 1 条 + handler error 1 条（合计 2 条提示）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler, update } = makeGuardedHandler(true)

        const result = await handler.update('t-archived', {})

        expect(result).toBe(ARCHIVED_READONLY_ERROR)
        expect(update).not.toHaveBeenCalled() // 守卫拦截 ⇒ 原方法零调用
        expect(warn).toHaveBeenCalledTimes(1) // 守卫提示
        expect(error).toHaveBeenCalledTimes(1) // handler 错误提示
        // 第二条（handler error）文案里直接把稳定错误码当用户文案透出（未落入领域码 → i18n 映射）
        const errorText = String(error.mock.calls[0]?.[0] ?? '')
        expect(errorText).toContain(ARCHIVED_READONLY_ERROR)
    })

    it('节流窗口内二次操作：守卫 warn 被节流（0 条），handler error 仍 1 条（合计 1 条）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler } = makeGuardedHandler(true)

        await handler.update('t-archived', {}) // 第 1 次：允许 warn
        warn.mockClear()
        error.mockClear()
        await handler.update('t-archived', {}) // 第 2 次：仍在 1200ms 窗口内

        expect(warn).toHaveBeenCalledTimes(0)
        expect(error).toHaveBeenCalledTimes(1)
    })

    it('非归档任务 → 不弹只读提示、原方法正常执行（不误伤）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const { handler, update } = makeGuardedHandler(false)

        await handler.update('t-active', {})

        expect(update).toHaveBeenCalledTimes(1)
        expect(warn).not.toHaveBeenCalled()
    })
})