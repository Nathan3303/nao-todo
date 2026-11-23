// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import type { Subscriber } from '@nao-todo/shared'
import { TaskErrorCode, type TaskUseCase } from '@nao-todo/domain-task'
import { TaskHandler } from '../handlers/task'

/**
 * `T768` 归档入口接线（handler + footer 源码接线）
 *
 *  1. `TaskHandler.archiveTask` 成功后**沿用既有全量刷新事件** `RefreshData`
 *     （列表查询默认排除已归档 ⇒ 重新查询即把该任务移出当前视图，不自造事件）；
 *  2. 失败时的可读错误提示（清单已归档 / 子任务）；
 *  3. footer「更多」菜单的 `execute-id` 与 handler 分支一致。
 */

const makeUseCase = (
    archiveResult: string | null
): { useCase: TaskUseCase; archive: ReturnType<typeof vi.fn> } => {
    const archive = vi.fn(async () => archiveResult)
    return { useCase: { archive } as unknown as TaskUseCase, archive }
}

const makeHandler = (useCase: TaskUseCase, emit = vi.fn()) =>
    new TaskHandler(useCase, { emit } as unknown as Subscriber)

afterEach(() => {
    vi.restoreAllMocks()
})

describe('T768 · TaskHandler.archiveTask', () => {
    it('归档成功 ⇒ 触发 RefreshData（视图移除）+ 成功提示', async () => {
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})
        const emit = vi.fn()
        const { useCase, archive } = makeUseCase(null)
        const handler = makeHandler(useCase, emit)

        await expect(handler.archiveTask('t-1')).resolves.toBeNull()

        expect(archive).toHaveBeenCalledWith('t-1')
        expect(emit).toHaveBeenCalledWith('RefreshData')
        expect(success).toHaveBeenCalledTimes(1)
    })

    it('清单已归档 ⇒ 错误提示可读（i18n 文案，不含内部错误码）+ 不刷新视图', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const emit = vi.fn()
        const { useCase } = makeUseCase(TaskErrorCode.ARCHIVE_PROJECT_ARCHIVED)
        const handler = makeHandler(useCase, emit)

        await expect(handler.archiveTask('t-1')).resolves.toBe(
            TaskErrorCode.ARCHIVE_PROJECT_ARCHIVED
        )

        expect(emit).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledTimes(1)
        const message = String(error.mock.calls[0]?.[0] ?? '')
        expect(message).toContain(t('task.error.archiveProjectArchived'))
        expect(message).not.toContain(TaskErrorCode.ARCHIVE_PROJECT_ARCHIVED)
    })

    it('子任务归档被拒 ⇒ 错误提示可读（i18n 文案）+ 不刷新视图', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const emit = vi.fn()
        const { useCase } = makeUseCase(TaskErrorCode.ARCHIVE_SUBTASK_FORBIDDEN)
        const handler = makeHandler(useCase, emit)

        await handler.archiveTask('t-1')

        expect(emit).not.toHaveBeenCalled()
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(
            t('task.error.archiveSubtaskForbidden')
        )
    })

    it('silent=true ⇒ 不发提示，但归档与刷新仍发生', async () => {
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})
        const emit = vi.fn()
        const { useCase, archive } = makeUseCase(null)
        const handler = makeHandler(useCase, emit)
        handler.silent = true

        await handler.archiveTask('t-1')

        expect(archive).toHaveBeenCalledWith('t-1')
        expect(emit).toHaveBeenCalledWith('RefreshData')
        expect(success).not.toHaveBeenCalled()
    })
})

describe('T768 · footer「更多」菜单源码接线（execute-id 与 handler 分支一致）', () => {
    const FOOTER = '/packages/presentation/task/components/task-details/footer/index.vue'
    const footerSource =
        (
            import.meta.glob(
                '/packages/presentation/task/components/task-details/footer/index.vue',
                { query: '?raw', import: 'default', eager: true }
            ) as Record<string, string>
        )[FOOTER] ?? ''

    it('菜单项 `execute-id="archive-todo"` 存在且由 `taskHandler.archiveTask` 承接', () => {
        expect(footerSource).toContain('execute-id="archive-todo"')
        expect(footerSource).toContain("case 'archive-todo'")
        expect(footerSource).toContain('taskHandler.archiveTask(')
    })
})