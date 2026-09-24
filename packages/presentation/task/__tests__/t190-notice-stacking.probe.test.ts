// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import type { GoError } from '@nao-todo/shared/types'
import type { TaskUseCase } from '@nao-todo/domain-task'
import type { ProjectUseCase } from '@nao-todo/domain-project'
import {
    ARCHIVED_READONLY_ERROR,
    PROJECT_ARCHIVE_WRITE_METHODS,
    TASK_ARCHIVE_WRITE_METHODS,
    resetArchiveGateForTest,
    withArchivedReadOnlyGuard
} from '../archive-gate'
import { OFFLINE_READONLY_ERROR } from '../../offline/write-gate'
import { TaskHandler } from '../handlers/task'
import { notifyTaskError } from '../utils/error-message'
import { ProjectHandler } from '../../project/handlers'

// `deleteProject` 先经 `NueConfirm` 二次确认；探针里固定为「未取消」以便走到同型错误分支
vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return { ...actual, NueConfirm: vi.fn(async () => [false]) }
})

/**
 * T190 · 行为探针：归档只读守卫 + 通知层是否**一次操作弹两条**
 *
 * 背景（`T184` §7 遗留观察）：守卫命中时 `withArchivedReadOnlyGuard` 自弹 `NueMessage.warn(readOnlyHint)`，
 * 而 `TaskHandler` 收到守卫返回的 `ARCHIVED_READONLY` 后走 `notifyError → translateTaskError → unwrapError`
 * 再弹一条 `NueMessage.error`。本探针用**极小行为级证据**判定这两条是否真的同时出现。
 *
 * 组合方式与生产一致：`useTaskUseCase` 先被 `binding.decorateUseCase(…, 'task')` 套上守卫，
 * `TaskHandler` 再接收该（已被守卫包裹的）任务用例（见 `apps/web/src/hooks/usecases/use-task-usecase.ts`
 * 与 `use-app-handlers.ts`）。项目域同型（`ProjectHandler`）。
 *
 * **T191 修订（PM 裁定 + ADR §15.3「提示唯一来源」规则）**：`T190` 原结论「一次操作弹两条」
 * （守卫本地化 `warn` + handler 原样透出错误码 `error`）被裁定**收敛为单条、本地化**
 * —— 归档只读码 `ARCHIVED_READONLY` 的**唯一用户可见提示来自守卫**，通知层命中该码**静默**
 * （不弹第二条、也不透出原始错误码）；**该码本身仍原样返回调用方**（只约束展示，不约束返回值）。
 * 本文件据此**收紧**期望（仍断言「恰好 1 条」且「不含原始错误码字符串」，强度不降）。
 */

/** 任务域：守卫包裹的 `TaskHandler`（与原探针同装配）；`updateResult` 供「非归档 + 其它码」负向用例 */
const makeGuardedHandler = (archived = true, updateResult: GoError = null) => {
    const update = vi.fn(async () => updateResult)
    const guarded = withArchivedReadOnlyGuard(
        { update } as unknown as object,
        TASK_ARCHIVE_WRITE_METHODS,
        { isArchivedTarget: async () => archived }
    ) as unknown as TaskUseCase
    const handler = new TaskHandler(guarded, { emit: vi.fn() } as never)
    return { handler, update }
}

/** 项目域：守卫包裹的 `ProjectHandler`（项目写方法均 `'error'` 形态，同生产） */
const makeGuardedProjectHandler = (archived = true, updateResult: GoError = null) => {
    const update = vi.fn(async () => updateResult)
    const methods = {
        update,
        delete: vi.fn(async () => updateResult),
        restore: vi.fn(async () => updateResult),
        unarchive: vi.fn(async () => updateResult)
    }
    const guarded = withArchivedReadOnlyGuard(
        methods as unknown as object,
        PROJECT_ARCHIVE_WRITE_METHODS,
        { isArchivedTarget: async () => archived }
    ) as unknown as ProjectUseCase
    const handler = new ProjectHandler(guarded, {} as never, { emit: vi.fn() } as never)
    return { handler, update }
}

beforeEach(() => {
    resetArchiveGateForTest()
})

afterEach(() => {
    resetArchiveGateForTest()
    vi.restoreAllMocks()
})

describe('T190/T191 · 归档守卫 + TaskHandler 提示探针（任务域）', () => {
    it('归档任务 → 单次 update：仅守卫本地化 warn 1 条；通知层静默（恰好 1 条、无原始错误码）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler, update } = makeGuardedHandler(true)

        const result = await handler.update('t-archived', {})

        expect(result).toBe(ARCHIVED_READONLY_ERROR) // 返回值不变（机器判定/调用方分支用）
        expect(update).not.toHaveBeenCalled() // 守卫拦截 ⇒ 原方法零调用
        expect(warn).toHaveBeenCalledTimes(1) // 守卫本地化提示
        expect(warn).toHaveBeenCalledWith(t('archive.readOnlyHint'))
        expect(error).not.toHaveBeenCalled() // 通知层静默 ⇒ 不再弹第二条
        expect(warn.mock.calls.length + error.mock.calls.length).toBe(1) // 恰好 1 条
        // 唯一一条提示是本地化文案，**不含**原始错误码字符串
        const noticeText = warn.mock.calls.map((call) => String(call[0] ?? '')).join(' ')
        expect(noticeText).not.toContain(ARCHIVED_READONLY_ERROR)
    })

    it('节流窗口内二次操作：0 条（守卫节流 + 通知层静默；不再外泄错误码）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler } = makeGuardedHandler(true)

        await handler.update('t-archived', {}) // 第 1 次：允许 warn
        warn.mockClear()
        error.mockClear()
        await handler.update('t-archived', {}) // 第 2 次：仍在 1200ms 窗口内

        expect(warn).toHaveBeenCalledTimes(0)
        expect(error).not.toHaveBeenCalled()
        expect(warn.mock.calls.length + error.mock.calls.length).toBe(0)
    })

    it('非归档任务 → 不弹只读提示、原方法正常执行（不误伤）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler, update } = makeGuardedHandler(false)

        await handler.update('t-active', {})

        expect(update).toHaveBeenCalledTimes(1)
        expect(warn).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
    })

    it('其它错误码仍原样透出（防过度静默；`OFFLINE_READONLY` 行为不变）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler } = makeGuardedHandler(false, OFFLINE_READONLY_ERROR)

        const result = await handler.update('t-active', {})

        expect(result).toBe(OFFLINE_READONLY_ERROR)
        expect(warn).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
    })
})

describe('T191 · 归档守卫 + ProjectHandler 提示探针（项目域）', () => {
    const projectWriteCases: Array<[string, (handler: ProjectHandler) => Promise<unknown>]> = [
        ['deleteProject', (handler) => handler.deleteProject('p-archived')],
        ['restoreProject', (handler) => handler.restoreProject('p-archived')],
        ['updateProject', (handler) => handler.updateProject('p-archived', {})]
    ]

    it.each(projectWriteCases)(
        '归档清单 → %s：仅守卫本地化 warn 1 条；通知层静默（恰好 1 条、无原始错误码）',
        async (_method, invoke) => {
            const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
            const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
            const { handler, update } = makeGuardedProjectHandler(true)

            const result = await invoke(handler)

            expect(result).toBe(ARCHIVED_READONLY_ERROR) // 返回值不变
            expect(update).not.toHaveBeenCalled()
            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith(t('archive.readOnlyHint'))
            expect(error).not.toHaveBeenCalled()
            expect(warn.mock.calls.length + error.mock.calls.length).toBe(1)
            const noticeText = warn.mock.calls.map((call) => String(call[0] ?? '')).join(' ')
            expect(noticeText).not.toContain(ARCHIVED_READONLY_ERROR)
        }
    )

    it('非归档清单 → 不弹只读提示、原方法正常执行（不误伤）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler, update } = makeGuardedProjectHandler(false)

        await handler.updateProject('p-active', {})

        expect(update).toHaveBeenCalledTimes(1)
        expect(warn).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
    })

    it('其它错误码仍原样透出（防过度静默；`OFFLINE_READONLY` 行为不变）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { handler } = makeGuardedProjectHandler(false, OFFLINE_READONLY_ERROR)

        const result = await handler.updateProject('p-active', {})

        expect(result).toBe(OFFLINE_READONLY_ERROR)
        expect(warn).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
    })
})

describe('T191 · 通知层 helper（notifyTaskError）码级豁免', () => {
    it('归档只读码 → 静默（不弹；守卫已提示）', () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})

        notifyTaskError('task.deleteFailed', ARCHIVED_READONLY_ERROR)

        expect(error).not.toHaveBeenCalled()
    })

    it('其它错误码 → 原样透出（防过度静默）', () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})

        notifyTaskError('task.deleteFailed', OFFLINE_READONLY_ERROR)

        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
    })
})