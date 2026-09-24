// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import type { Subscriber } from '@nao-todo/shared'
import type { TaskUseCase } from '@nao-todo/domain-task'
import { TaskHandler } from '../handlers/task'

/**
 * T183 自带接线级单测（P3 / ADR `2026-09-24-project-archive.md` §15.1）
 *
 * 覆盖两处接线：
 *  1. `TaskHandler.unarchiveTask` 的 `movedToInbox` 分支与可见提醒（§15.1 presentation 行）；
 *  2. 任务详情 footer「取消归档」入口的源码接线（`execute-id=unarchive-todo` + handler 分支）。
 *
 * ⚠️ `T178b` 已裁定：该「接线级」项由实现单自带单测覆盖，不再单独派 qa 红基线（`T184` 终验复核）。
 */

const makeUseCase = (
    result: [{ movedToInbox: boolean } | null, string | null]
): { useCase: TaskUseCase; unarchive: ReturnType<typeof vi.fn> } => {
    const unarchive = vi.fn(async () => result)
    return { useCase: { unarchive } as unknown as TaskUseCase, unarchive }
}

const makeHandler = (useCase: TaskUseCase) =>
    new TaskHandler(useCase, { emit: vi.fn() } as unknown as Subscriber)

afterEach(() => {
    vi.restoreAllMocks()
})

describe('T183 · TaskHandler.unarchiveTask（§15.1 可见提醒接线）', () => {
    it('调用用例 `unarchive(id)` 并返回 null（成功）', async () => {
        const { useCase, unarchive } = makeUseCase([{ movedToInbox: false }, null])
        const handler = makeHandler(useCase)

        await expect(handler.unarchiveTask('t-1')).resolves.toBeNull()
        expect(unarchive).toHaveBeenCalledWith('t-1')
    })

    it('movedToInbox=true ⇒ 可见提醒同时含「已移入收集箱」与「原清单仍归档」文案', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const { useCase } = makeUseCase([{ movedToInbox: true }, null])
        const handler = makeHandler(useCase)

        await handler.unarchiveTask('t-1')

        expect(warn).toHaveBeenCalledTimes(1)
        const message = String(warn.mock.calls[0]?.[0] ?? '')
        expect(message).toContain(t('task.unarchivedToInbox'))
        expect(message).toContain(t('task.unarchivedToInboxHint'))
    })

    it('movedToInbox=false ⇒ 不弹移入收集箱提醒（回原清单）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const { useCase } = makeUseCase([{ movedToInbox: false }, null])
        const handler = makeHandler(useCase)

        await handler.unarchiveTask('t-1')

        expect(warn).not.toHaveBeenCalled()
    })

    it('仓储报错 ⇒ 错误提示 + 原样返回错误码', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { useCase } = makeUseCase([null, '当前环境不支持取消归档'])
        const handler = makeHandler(useCase)

        await expect(handler.unarchiveTask('t-1')).resolves.toBe('当前环境不支持取消归档')
        expect(error).toHaveBeenCalledTimes(1)
    })

    it('silent=true ⇒ 不发提醒，但调用仍发生', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const { useCase, unarchive } = makeUseCase([{ movedToInbox: true }, null])
        const handler = makeHandler(useCase)
        handler.silent = true

        await handler.unarchiveTask('t-1')

        expect(unarchive).toHaveBeenCalledWith('t-1')
        expect(warn).not.toHaveBeenCalled()
    })
})

describe('T183 · footer「取消归档」入口源码接线（execute-id 与 handler 分支一致）', () => {
    const FOOTER = '/packages/presentation/task/components/task-details/footer/index.vue'
    const footerSource =
        (
            import.meta.glob(
                '/packages/presentation/task/components/task-details/footer/index.vue',
                {
                    query: '?raw',
                    import: 'default',
                    eager: true
                }
            ) as Record<string, string>
        )[FOOTER] ?? ''

    it('菜单项 `execute-id="unarchive-todo"` 存在且由 `taskHandler.unarchiveTask` 承接', () => {
        expect(footerSource).toContain('execute-id="unarchive-todo"')
        expect(footerSource).toContain("case 'unarchive-todo'")
        expect(footerSource).toContain('taskHandler.unarchiveTask(')
    })
})