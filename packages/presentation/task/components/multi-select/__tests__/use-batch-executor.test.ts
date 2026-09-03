import { describe, expect, it, vi } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { TaskHandler } from '../../../handlers'
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