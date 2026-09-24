import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import {
    ARCHIVED_READONLY_ERROR,
    TASK_ARCHIVE_WRITE_METHODS,
    resetArchiveGateForTest,
    withArchivedReadOnlyGuard
} from '../../../archive-gate'
import { OFFLINE_READONLY_ERROR } from '../../../../offline/write-gate'
import { TaskHandler } from '../../../handlers'
import { useBatchExecutor } from '../use-batch-executor'

describe('useBatchExecutor - 批量执行', () => {
    it('单条失败不中断，汇总成功/失败数量', async () => {
        const updatePriorityMock = vi
            .fn<(id: string, priority: string) => Promise<null | string>>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('mock-error')

        const handler = {
            updateTaskPriority: updatePriorityMock,
            update: vi.fn().mockResolvedValue(null)
        } as unknown as TaskHandler

        const { isRunning, run } = useBatchExecutor({ handler, getTask: () => undefined })

        const result = await run({ kind: 'updatePriority', payload: 'high' }, ['t1', 't2'])

        expect(result.total).toBe(2)
        expect(result.succeeded).toBe(1)
        expect(result.failed).toBe(1)
        expect(result.errors[0]?.taskId).toBe('t2')
        expect(isRunning.value).toBe(false)
    })

    it('addTags 合并去重后写入全部选中任务', async () => {
        const updateMock = vi.fn().mockResolvedValue(null)
        const handler = { update: updateMock } as unknown as TaskHandler
        const task = { id: 't1', tags: ['tag-a'] } as TaskViewObject

        const { run } = useBatchExecutor({ handler, getTask: () => task })

        const result = await run({ kind: 'addTags', payload: ['tag-b', 'tag-a'] }, ['t1'])

        expect(result.failed).toBe(0)
        expect(updateMock).toHaveBeenCalledWith('t1', { tags: ['tag-a', 'tag-b'] })
    })

    it('removeTags 仅过滤目标标签', async () => {
        const updateMock = vi.fn().mockResolvedValue(null)
        const handler = { update: updateMock } as unknown as TaskHandler
        const task = { id: 't1', tags: ['tag-a', 'tag-b'] } as TaskViewObject

        const { run } = useBatchExecutor({ handler, getTask: () => task })

        const result = await run({ kind: 'removeTags', payload: ['tag-a'] }, ['t1'])

        expect(result.failed).toBe(0)
        expect(updateMock).toHaveBeenCalledWith('t1', { tags: ['tag-b'] })
    })
})

describe('T191 · 归档只读码在批量汇总静默为本地化提示（不改失败计数）', () => {
    afterEach(() => {
        resetArchiveGateForTest()
        vi.restoreAllMocks()
    })

    it('批量 updateState 命中归档守卫 → 仅守卫 warn 1 条；汇总用本地化提示、无原始错误码', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        resetArchiveGateForTest()
        const guarded = withArchivedReadOnlyGuard(
            { update: vi.fn(async () => null) } as unknown as object,
            TASK_ARCHIVE_WRITE_METHODS,
            { isArchivedTarget: async () => true }
        ) as unknown as TaskUseCase
        const handler = new TaskHandler(guarded, { emit: vi.fn() } as never)
        const { run } = useBatchExecutor({ handler, getTask: () => undefined })

        const result = await run({ kind: 'updateState', payload: 'done' }, ['t1'])

        expect(result.failed).toBe(1) // 失败计数不变
        expect(result.errors[0]?.message).toBe(t('archive.readOnlyHint')) // 本地化
        expect(result.errors[0]?.message).not.toContain(ARCHIVED_READONLY_ERROR)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(error).not.toHaveBeenCalled()
        expect(warn.mock.calls.length + error.mock.calls.length).toBe(1) // 恰好 1 条
    })

    it('其它错误码仍原样透出（防过度静默）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const guarded = withArchivedReadOnlyGuard(
            { update: vi.fn(async () => OFFLINE_READONLY_ERROR) } as unknown as object,
            TASK_ARCHIVE_WRITE_METHODS,
            { isArchivedTarget: async () => false }
        ) as unknown as TaskUseCase
        const handler = new TaskHandler(guarded, { emit: vi.fn() } as never)
        const { run } = useBatchExecutor({ handler, getTask: () => undefined })

        const result = await run({ kind: 'updateState', payload: 'done' }, ['t1'])

        expect(result.failed).toBe(1)
        expect(result.errors[0]?.message).toContain(OFFLINE_READONLY_ERROR)
        expect(error).toHaveBeenCalledTimes(1)
    })
})