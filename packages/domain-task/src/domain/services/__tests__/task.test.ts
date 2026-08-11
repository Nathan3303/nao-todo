import { describe, expect, it, vi } from 'vite-plus/test'
import { TaskDomain } from '../task'
import { UpdateTaskValueObject } from '../../valueobjects'
import { TaskEntity } from '../../entities'
import type { TaskRepository } from '../../repositories'

/**
 * TaskEntity 构造函数参数顺序（20 个位置参数）：
 * id, createdAt, updatedAt, deletedAt, parentTaskId, name, description,
 * state, priority, startAt, endAt, projectId, tags, archivedAt, starMarkAt,
 * givenUpAt, remindAt, remindRepeat, remindTime, remindWeekdays
 */
const makeEntity = (overrides: Partial<Record<string, unknown>> = {}): TaskEntity => {
    const base = {
        id: 'task-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        deletedAt: null as string | null,
        parentTaskId: '',
        name: '测试任务',
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: '2024-01-01T00:00:00.000Z',
        endAt: '2024-01-03T00:00:00.000Z',
        projectId: 'project-1',
        tags: [] as string[],
        archivedAt: null as string | null,
        starMarkAt: null as string | null,
        givenUpAt: null as string | null,
        remindAt: '',
        remindRepeat: 'none',
        remindTime: '',
        remindWeekdays: [] as number[]
    }
    const v = { ...base, ...overrides }
    return new TaskEntity(
        v.id as string,
        v.createdAt as string,
        v.updatedAt as string,
        v.deletedAt as string | null,
        v.parentTaskId as string,
        v.name as string,
        v.description as string,
        v.state as string,
        v.priority as string,
        v.startAt as string,
        v.endAt as string,
        v.projectId as string,
        v.tags as string[],
        v.archivedAt as string | null,
        v.starMarkAt as string | null,
        v.givenUpAt as string | null,
        v.remindAt as string,
        v.remindRepeat as string,
        v.remindTime as string,
        v.remindWeekdays as number[]
    )
}

/**
 * 构造部分 mock 的仓储实例
 * @param entity get 返回的实体（null 表示任务不存在）
 * @param updateImpl update 方法实现（返回 Go<void>：null 表示成功，字符串表示失败）
 */
const makeRepo = (
    entity: TaskEntity | null,
    updateImpl: (id: string) => Promise<string | null> = async () => null
) => {
    const get = vi.fn(async () => [entity, null] as [TaskEntity | null, null])
    const update = vi.fn(updateImpl)
    return { repo: { get, update } as unknown as TaskRepository, get, update }
}

describe('TaskDomain.batchUpdate', () => {
    it('逐个调用实体规则与 repo.update 并返回成功计数', async () => {
        const { repo, get, update } = makeRepo(makeEntity())
        const domain = new TaskDomain(repo)
        const vos = [
            new UpdateTaskValueObject('task-1'),
            new UpdateTaskValueObject('task-2'),
            new UpdateTaskValueObject('task-3')
        ]
        const [result, err] = await domain.batchUpdate(vos)
        expect(err).toBeNull()
        expect(result).toEqual({ succeeded: 3, failedIds: [] })
        expect(get).toHaveBeenCalledTimes(3)
        expect(update).toHaveBeenCalledTimes(3)
        expect(update).toHaveBeenNthCalledWith(1, 'task-1', vos[0])
    })

    it('单条更新失败不中断，返回失败 ID 列表', async () => {
        const { repo, update } = makeRepo(makeEntity(), async (id) =>
            id === 'task-2' ? '更新失败' : null
        )
        const domain = new TaskDomain(repo)
        const [result, err] = await domain.batchUpdate([
            new UpdateTaskValueObject('task-1'),
            new UpdateTaskValueObject('task-2'),
            new UpdateTaskValueObject('task-3')
        ])
        expect(err).toBeNull()
        expect(result).toEqual({ succeeded: 2, failedIds: ['task-2'] })
        expect(update).toHaveBeenCalledTimes(3)
    })

    it('任务不存在记入失败列表且不调用 update', async () => {
        const { repo, update } = makeRepo(null)
        const domain = new TaskDomain(repo)
        const [result, err] = await domain.batchUpdate([new UpdateTaskValueObject('task-1')])
        expect(err).toBeNull()
        expect(result).toEqual({ succeeded: 0, failedIds: ['task-1'] })
        expect(update).not.toHaveBeenCalled()
    })

    it('实体规则拒绝（已删除任务修改时间）记入失败列表', async () => {
        const entity = makeEntity({ deletedAt: '2024-01-05T00:00:00.000Z' })
        const { repo, update } = makeRepo(entity)
        const domain = new TaskDomain(repo)
        const vo = new UpdateTaskValueObject('task-1')
        vo.endAt = '2024-06-01T00:00:00.000Z'
        const [result, err] = await domain.batchUpdate([vo])
        expect(err).toBeNull()
        expect(result).toEqual({ succeeded: 0, failedIds: ['task-1'] })
        expect(update).not.toHaveBeenCalled()
    })

    it('空数组返回 0 且不调用仓储', async () => {
        const { repo, get, update } = makeRepo(makeEntity())
        const domain = new TaskDomain(repo)
        const [result, err] = await domain.batchUpdate([])
        expect(err).toBeNull()
        expect(result).toEqual({ succeeded: 0, failedIds: [] })
        expect(get).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()
    })
})