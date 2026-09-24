import { describe, expect, it, vi } from 'vite-plus/test'
import { TaskCheckItemEntity, TaskCheckItemUseCase } from '@nao-todo/domain-task'
import type {
    TaskCheckItemRepository,
    TaskCheckItemStore,
    TaskCheckItemViewObject
} from '@nao-todo/domain-task'

/**
 * 检查项只读取数（D1/A′）回归
 * @description 契约：`listByTask` 归一排序 `sortId ASC, id ASC` 且不写 store；
 *              既有 `list` 委托 `listByTask` 后写 store，返回契约不变。
 *              「无序返回 → 顺序稳定」为 PRD §9 行为变化回归断言
 *              （Go 仓储不排序 / Local 仓储按 sortId 排序，口径不一致）。
 */

const makeEntity = (id: string, sortId: number): TaskCheckItemEntity =>
    new TaskCheckItemEntity(
        id,
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z',
        null,
        'task-1',
        `项-${id}`,
        false,
        sortId
    )

class MemoryCheckItemStore implements TaskCheckItemStore {
    checkItems: TaskCheckItemViewObject[] = []
    checkItemIds: string[] = []
    setCheckItems = vi.fn((items: TaskCheckItemViewObject[]) => {
        this.checkItems = items
    })
    setCheckItemIds = vi.fn((ids: string[]) => {
        this.checkItemIds = ids
    })
    addCheckItem = vi.fn()
    getCheckItem = vi.fn()
    updateCheckItem = vi.fn()
    deleteCheckItem = vi.fn()
    updateCheckItems = vi.fn()
    addCheckItemId = vi.fn()
    removeCheckItemId = vi.fn()
}

const setup = (entities: TaskCheckItemEntity[]) => {
    const store = new MemoryCheckItemStore()
    const repo = {
        list: vi.fn(async () => [entities, null] as [TaskCheckItemEntity[], null])
    } as unknown as TaskCheckItemRepository
    const useCase = new TaskCheckItemUseCase(repo, store)
    return { useCase, store }
}

describe('TaskCheckItemUseCase.listByTask - 只读取数（C2 归一排序）', () => {
    it('仓储无序返回 ⇒ 按 sortId ASC 归一排序（Go 仓储不排序回归）', async () => {
        const { useCase } = setup([
            makeEntity('c', 2000),
            makeEntity('a', 1000),
            makeEntity('b', 3000)
        ])

        const [items, err] = await useCase.listByTask('task-1')

        expect(err).toBeNull()
        expect(items?.map((item) => item.id)).toEqual(['a', 'c', 'b'])
    })

    it('sortId 相同 ⇒ 按 id ASC 稳定 tiebreak', async () => {
        const { useCase } = setup([
            makeEntity('b', 1000),
            makeEntity('c', 1000),
            makeEntity('a', 1000)
        ])

        const [items, err] = await useCase.listByTask('task-1')

        expect(err).toBeNull()
        expect(items?.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    })

    it('只读：不写共享 store（checkItems / checkItemIds 不变）', async () => {
        const { useCase, store } = setup([makeEntity('a', 1000)])

        await useCase.listByTask('task-1')

        expect(store.checkItems).toEqual([])
        expect(store.checkItemIds).toEqual([])
        expect(store.setCheckItems).not.toHaveBeenCalled()
        expect(store.setCheckItemIds).not.toHaveBeenCalled()
    })
})

describe('TaskCheckItemUseCase.list - 委托只读原语（契约不变）', () => {
    it('返回已排序 ID 列表并写入 store', async () => {
        const { useCase, store } = setup([makeEntity('b', 3000), makeEntity('a', 1000)])

        const [ids, err] = await useCase.list('task-1')

        expect(err).toBeNull()
        expect(ids).toEqual(['a', 'b'])
        expect(store.checkItemIds).toEqual(['a', 'b'])
        expect(store.checkItems.map((item) => item.id)).toEqual(['a', 'b'])
    })
})