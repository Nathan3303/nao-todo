import { describe, expect, it, vi } from 'vite-plus/test'
import { TaskDomain } from '../task'
import { UpdateTaskValueObject } from '../../valueobjects'
import type { TaskRepository } from '../../repositories'

/**
 * 构造部分 mock 的仓储实例
 * @param updateImpl update 方法实现（返回 Go<void>：null 表示成功，字符串表示失败）
 */
const makeRepo = (updateImpl: (id: string) => Promise<string | null>) => {
    const update = vi.fn(updateImpl)
    return { repo: { update } as unknown as TaskRepository, update }
}

describe('TaskDomain.batchUpdate', () => {
    it('逐个调用 repo.update 并返回成功计数', async () => {
        const { repo, update } = makeRepo(async () => null)
        const domain = new TaskDomain(repo)
        const vos = [
            new UpdateTaskValueObject('task-1'),
            new UpdateTaskValueObject('task-2'),
            new UpdateTaskValueObject('task-3')
        ]
        const [succeeded, err] = await domain.batchUpdate(vos)
        expect(err).toBeNull()
        expect(succeeded).toBe(3)
        expect(update).toHaveBeenCalledTimes(3)
        expect(update).toHaveBeenNthCalledWith(1, 'task-1', vos[0])
        expect(update).toHaveBeenNthCalledWith(3, 'task-3', vos[2])
    })

    it('单条失败不中断，返回成功计数', async () => {
        const { repo, update } = makeRepo(async (id) => (id === 'task-2' ? '更新失败' : null))
        const domain = new TaskDomain(repo)
        const [succeeded, err] = await domain.batchUpdate([
            new UpdateTaskValueObject('task-1'),
            new UpdateTaskValueObject('task-2'),
            new UpdateTaskValueObject('task-3')
        ])
        expect(err).toBeNull()
        expect(succeeded).toBe(2)
        expect(update).toHaveBeenCalledTimes(3)
    })

    it('空数组直接返回 0 且不调用仓储', async () => {
        const { repo, update } = makeRepo(async () => null)
        const domain = new TaskDomain(repo)
        const [succeeded, err] = await domain.batchUpdate([])
        expect(err).toBeNull()
        expect(succeeded).toBe(0)
        expect(update).not.toHaveBeenCalled()
    })
})