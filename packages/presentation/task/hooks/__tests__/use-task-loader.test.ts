import { describe, expect, it, vi } from 'vite-plus/test'
import type { TaskUseCase } from '@nao-todo/domain-task'
import type { GetTasksOptions } from '@nao-todo/shared'
import { useTasksLoader } from '../use-task-loader'

const waitDisabledReset = () => new Promise((resolve) => setTimeout(resolve, 0))

const successResult = {
    taskIds: ['t1', 't2'],
    pagination: { total: 2, page: 1, limit: 20, maxPage: 1 }
}

describe('useTasksLoader - 加载失败后可重试', () => {
    it('loadAndReplace 失败后 disabled 重置，重试不再被拦截', async () => {
        const listMock = vi
            .fn<
                (options: GetTasksOptions) => Promise<[typeof successResult, null] | [null, string]>
            >()
            .mockResolvedValueOnce([null, 'mock-error'])
            .mockResolvedValueOnce([successResult, null])

        const taskUseCase = { list: listMock } as unknown as TaskUseCase
        const loader = useTasksLoader(taskUseCase)

        // 首次加载失败：error 被记录，disabled 应重置（否则重试会被 if (states.disabled) 拦截）
        await loader.loadAndReplace()
        expect(loader.states.error).toBe('mock-error')
        await waitDisabledReset()
        expect(loader.states.disabled).toBe(false)

        // 重试成功：任务 ID 更新，disabled 再次重置
        await loader.loadAndReplace()
        expect(loader.states.error).toBe('')
        expect([...loader.states.taskIds]).toEqual(['t1', 't2'])
        await waitDisabledReset()
        expect(loader.states.disabled).toBe(false)
        expect(listMock).toHaveBeenCalledTimes(2)
    })

    it('loadAndPush 失败后 disabled 重置，重试可继续追加', async () => {
        const listMock = vi
            .fn<
                (options: GetTasksOptions) => Promise<[typeof successResult, null] | [null, string]>
            >()
            .mockResolvedValueOnce([null, 'mock-error'])
            .mockResolvedValueOnce([successResult, null])

        const taskUseCase = { list: listMock } as unknown as TaskUseCase
        const loader = useTasksLoader(taskUseCase)

        await loader.loadAndPush()
        expect(loader.states.error).toBe('mock-error')
        await waitDisabledReset()
        expect(loader.states.disabled).toBe(false)

        await loader.loadAndPush()
        expect(loader.states.error).toBe('')
        expect([...loader.states.taskIds]).toEqual(['t1', 't2'])
        await waitDisabledReset()
        expect(loader.states.disabled).toBe(false)
        expect(listMock).toHaveBeenCalledTimes(2)
    })
})