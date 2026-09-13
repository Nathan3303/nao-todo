import { describe, expect, it, vi } from 'vite-plus/test'
import { TaskDomain, TaskEntity, TaskUseCase } from '@nao-todo/domain-task'
import type { TaskRepository, TaskStore, TaskViewObject } from '@nao-todo/domain-task'

/**
 * 子任务组内重排测试（ADR 2026-09-13-subtask-reorder §5/§10 U-C2/U-C3 + Q2/Q3/Q4）
 * @description 浮动间隔分支与组内重建分支；仅本组重建；>65 行 / 未取尽（allowRebuild=false）禁重建；
 *              位置未变 no-op；前插得 0 触发重建（与检查项先例有意偏离 `< 0` → `<= 0`）。
 */

const makeEntity = (id: string, parentTaskId = ''): TaskEntity =>
    new TaskEntity(
        id,
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z',
        null,
        parentTaskId,
        `任务-${id}`,
        '',
        'todo',
        'medium',
        '',
        '',
        '',
        [],
        null,
        null,
        null,
        '',
        'none',
        '',
        []
    )

const makeTask = (id: string, sortId: number, parentTaskId = 'parent-1'): TaskViewObject =>
    ({
        id,
        parentTaskId,
        sortId,
        name: `任务-${id}`,
        tags: []
    }) as unknown as TaskViewObject

/** 内存 store（真实更新语义，便于断言顺序与 sortId） */
class MemoryTaskStore implements TaskStore {
    tasks: TaskViewObject[] = []
    setTasks(tasks: TaskViewObject[]) {
        this.tasks = tasks
    }
    updateTask(id: string, update: Partial<TaskViewObject>) {
        const task = this.tasks.find((item) => item.id === id)
        if (task) Object.assign(task, update)
    }
    addTask(task: TaskViewObject) {
        this.tasks.push(task)
    }
    addTasks(tasks: TaskViewObject[]) {
        this.tasks.push(...tasks)
    }
    getTask(id: string) {
        return this.tasks.find((task) => task.id === id)
    }
    removeTask(id: string) {
        this.tasks = this.tasks.filter((task) => task.id !== id)
    }
}

class MockTaskRepository {
    update = vi.fn(async (..._args: unknown[]) => null as string | null)
    get = vi.fn(async (id: string) => [makeEntity(id), null] as [TaskEntity, null])
}

const setup = (tasks: TaskViewObject[]) => {
    const store = new MemoryTaskStore()
    store.tasks = [...tasks]
    const repo = new MockTaskRepository()
    const taskRepo = repo as unknown as TaskRepository
    const useCase = new TaskUseCase(new TaskDomain(taskRepo), taskRepo, store)
    return { useCase, store, repo }
}

const sortIdsOf = (store: MemoryTaskStore, parentTaskId = 'parent-1') =>
    store.tasks
        .filter((task) => task.parentTaskId === parentTaskId)
        .sort((a, b) => a.sortId - b.sortId)
        .map((task) => `${task.id}:${task.sortId}`)

describe('TaskUseCase.resort - 浮动间隔分支（U-C2）', () => {
    it('插入中间：取相邻均值，仅更新被拖拽项', async () => {
        const { useCase, store, repo } = setup([
            makeTask('a', 1000),
            makeTask('b', 3000),
            makeTask('c', 4000)
        ])
        // c 拖到 b 之前 ⇒ 新位置在 a(1000) 与 b(3000) 之间
        const err = await useCase.resort('c', 'b', true)
        expect(err).toBeNull()
        expect(repo.update).toHaveBeenCalledTimes(1)
        expect(repo.update).toHaveBeenCalledWith('c', expect.objectContaining({ sortId: 2000 }))
        expect(sortIdsOf(store)).toEqual(['a:1000', 'c:2000', 'b:3000'])
    })

    it('插入组首：next - 1000（有效值时单条赋值）', async () => {
        const { useCase, store, repo } = setup([
            makeTask('a', 2000),
            makeTask('b', 3000),
            makeTask('c', 4000)
        ])
        const err = await useCase.resort('c', 'a', true)
        expect(err).toBeNull()
        expect(repo.update).toHaveBeenCalledWith('c', expect.objectContaining({ sortId: 1000 }))
        expect(sortIdsOf(store)).toEqual(['c:1000', 'a:2000', 'b:3000'])
    })

    it('插入组末：prev + 1000', async () => {
        const { useCase, store, repo } = setup([
            makeTask('a', 1000),
            makeTask('b', 2000),
            makeTask('c', 3000)
        ])
        const err = await useCase.resort('a', 'c', false)
        expect(err).toBeNull()
        expect(repo.update).toHaveBeenCalledWith('a', expect.objectContaining({ sortId: 4000 }))
        expect(sortIdsOf(store)).toEqual(['b:2000', 'c:3000', 'a:4000'])
    })
})

describe('TaskUseCase.resort - 组内重建（U-C2/U-C4/Q4）', () => {
    it('相邻差 < 2 ⇒ 重建为 1000, 2000, …（仅本组）', async () => {
        const { useCase, store, repo } = setup([
            makeTask('a', 1000),
            makeTask('b', 1001),
            makeTask('c', 5000)
        ])
        const err = await useCase.resort('c', 'b', true)
        expect(err).toBeNull()
        // 重建走 batchUpdate ⇒ 逐条 get + update（3 条本组）
        expect(repo.get).toHaveBeenCalledTimes(3)
        expect(sortIdsOf(store)).toEqual(['a:1000', 'c:2000', 'b:3000'])
    })

    it('Q4：前插得 0（先例 < 0，本单 <= 0）⇒ 重建而非产出 0', async () => {
        const { useCase, store, repo } = setup([
            makeTask('a', 1000),
            makeTask('b', 2000),
            makeTask('c', 3000)
        ])
        const err = await useCase.resort('c', 'a', true)
        expect(err).toBeNull()
        expect(repo.get).toHaveBeenCalledTimes(3)
        expect(sortIdsOf(store)).toEqual(['c:1000', 'a:2000', 'b:3000'])
    })
})

describe('TaskUseCase.resort - 守卫（U-C3/Q2/Q3）', () => {
    it('Q3：目标位置与当前位置相同 ⇒ 不发起请求、不改 store', async () => {
        const { useCase, store, repo } = setup([
            makeTask('a', 1000),
            makeTask('b', 2000),
            makeTask('c', 3000)
        ])
        const err = await useCase.resort('a', 'b', true) // a 本就在 b 之上（相邻）
        expect(err).toBeNull()
        expect(repo.update).not.toHaveBeenCalled()
        expect(repo.get).not.toHaveBeenCalled()
        expect(sortIdsOf(store)).toEqual(['a:1000', 'b:2000', 'c:3000'])
    })

    it('重建仅本组：另一组 sortId 与更新调用均不受影响', async () => {
        const other = [makeTask('x', 1000, 'parent-2'), makeTask('y', 2000, 'parent-2')]
        const { useCase, store, repo } = setup([
            makeTask('a', 1000),
            makeTask('b', 1001),
            makeTask('c', 5000),
            ...other
        ])
        const err = await useCase.resort('c', 'b', true)
        expect(err).toBeNull()
        // 仅本组 3 条被更新；parent-2 两条不动
        const updatedIds = repo.update.mock.calls.map((call) => call[0])
        expect(updatedIds.every((id) => !['x', 'y'].includes(String(id)))).toBe(true)
        expect(sortIdsOf(store, 'parent-2')).toEqual(['x:1000', 'y:2000'])
    })

    it('组 > 65 行 ⇒ 禁用重建（落在单条浮动不可行时 no-op）', async () => {
        const tasks = Array.from({ length: 66 }, (_, index) =>
            makeTask(`t${index}`, (index + 1) * 1000)
        )
        const { useCase, store, repo } = setup(tasks)
        const before = sortIdsOf(store)
        // 拖组末到组首：newSortId = 1000 - 1000 = 0（不可行）⇒ 不重建、不更新
        const err = await useCase.resort('t65', 't0', true)
        expect(err).toBeNull()
        expect(repo.get).not.toHaveBeenCalled()
        expect(repo.update).not.toHaveBeenCalled()
        expect(sortIdsOf(store)).toEqual(before)
    })

    it('allowRebuild=false（未取尽）⇒ 需重建时退化为单条浮动赋值', async () => {
        const { useCase, repo } = setup([
            makeTask('a', 1000),
            makeTask('b', 1001),
            makeTask('c', 5000)
        ])
        const err = await useCase.resort('c', 'b', true, { allowRebuild: false })
        expect(err).toBeNull()
        expect(repo.get).not.toHaveBeenCalled() // 未走重建
        expect(repo.update).toHaveBeenCalledTimes(1)
        expect(repo.update).toHaveBeenCalledWith('c', expect.objectContaining({ sortId: 1001 }))
    })

    it('Q4：单条更新失败 ⇒ 本组重建后重试一次', async () => {
        const { useCase, store, repo } = setup([
            makeTask('a', 2000),
            makeTask('b', 3000),
            makeTask('c', 4000)
        ])
        repo.update.mockResolvedValueOnce('SORT_ID_OVERFLOW')
        // c 拖到 a 之前 ⇒ 单条 1000；首次失败 ⇒ 回退 + 重建
        const err = await useCase.resort('c', 'a', true)
        expect(err).toBeNull()
        expect(repo.get).toHaveBeenCalledTimes(3)
        expect(sortIdsOf(store)).toEqual(['c:1000', 'a:2000', 'b:3000'])
    })
})