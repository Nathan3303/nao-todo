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

describe('useTasksLoader - DEF-STORE-06 方向 4（失效事件在飞不丢失）', () => {
    it('在飞中到达的刷新置 pending，完成后重跑一次且仅一次，终值为新', async () => {
        const firstResult = {
            taskIds: ['t1'],
            pagination: { total: 1, page: 1, limit: 20, maxPage: 1 }
        }
        const secondResult = {
            taskIds: ['t3', 't4'],
            pagination: { total: 2, page: 1, limit: 20, maxPage: 1 }
        }
        // 首次 list 悬而未决：构造“在飞”窗口（disabled=true 期间到达的刷新不得被静默丢弃）
        let resolveFirst!: (v: [typeof firstResult, null]) => void
        const firstGate = new Promise<[typeof firstResult, null]>((resolve) => {
            resolveFirst = resolve
        })
        const listMock = vi
            .fn<
                (options: GetTasksOptions) => Promise<[typeof firstResult, null] | [null, string]>
            >()
            .mockReturnValueOnce(firstGate)
            .mockResolvedValueOnce([secondResult, null])
        const taskUseCase = { list: listMock } as unknown as TaskUseCase
        const loader = useTasksLoader(taskUseCase)

        const firstRun = loader.loadAndReplace() // 在飞（list 悬而未决）
        expect(loader.states.disabled).toBe(true)
        // 在飞中到达刷新 ⇒ 置脏不丢弃（方向 4）
        await loader.loadAndReplace({ parentTaskId: 'p2' })
        expect(loader.states.pendingRefresh).toEqual({ requested: { parentTaskId: 'p2' } })

        resolveFirst([firstResult, null])
        await firstRun
        await waitDisabledReset() // 首次 finally 的 setTimeout（触发重跑）
        await waitDisabledReset() // 重跑自身的 finally setTimeout（收口）
        // 重跑一次且仅一次：list 共 2 次调用，第二次带 pending 参数
        expect(listMock).toHaveBeenCalledTimes(2)
        expect(listMock.mock.calls[1]![0]?.parentTaskId).toBe('p2')
        expect([...loader.states.taskIds]).toEqual(['t3', 't4'])
        expect(loader.states.disabled).toBe(false)
        expect(loader.states.pendingRefresh).toBeNull()
    })

    it('无在飞事件时 pending 不残留（正常路径不回退）', async () => {
        const result = {
            taskIds: ['t1', 't2'],
            pagination: { total: 2, page: 1, limit: 20, maxPage: 1 }
        }
        const listMock = vi
            .fn<(options: GetTasksOptions) => Promise<[typeof result, null] | [null, string]>>()
            .mockResolvedValue([result, null])
        const loader = useTasksLoader({ list: listMock } as unknown as TaskUseCase)

        await loader.loadAndReplace()
        await waitDisabledReset()
        expect(loader.states.pendingRefresh).toBeNull()
        expect(loader.states.disabled).toBe(false)
        expect(listMock).toHaveBeenCalledTimes(1)
        expect([...loader.states.taskIds]).toEqual(['t1', 't2'])
    })
})