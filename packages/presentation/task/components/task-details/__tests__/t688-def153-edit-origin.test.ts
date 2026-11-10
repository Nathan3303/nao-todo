import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../stores'
import useTaskViewObject from '../use-task-view-object'

/**
 * T688 / `DEF-153` —— **非文本字段的编辑基准（`O`）在交互起点冻结**
 *
 * 契约（PM 冻结口径）：
 * - 控件交互起点（下拉/日期面板打开、标签编辑态进入、开关点击前）调用 `beginEdit(field)` 冻结该字段的
 *   **已持久化值**；保存时只为**本次载荷涉及**的字段透传（判据仍是 `F = keys(载荷) ∩ keys(基准)`）；
 * - 幂等：同一字段已冻结 ⇒ 保留首次值（期间自动刷新推进 store **不得**影响 `O`，`DEF-145` 教训）；
 * - 成功提交后清除（下次交互重新冻结）；
 * - 未冻结的非文本字段 ⇒ 行为与 `DEF-146` 之前一致（第三参 `undefined`，零行为变化）。
 */

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        userId: 'u1',
        parentTaskId: null,
        name: '任务A',
        description: '描述A',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt: null,
        projectId: null,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        archivedAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
        ...overrides
    }) as TaskViewObject

const makeUseCase = (task: TaskViewObject) => {
    const update = vi.fn().mockResolvedValue(null)
    const useCase = {
        get: vi.fn().mockResolvedValue([task, null]),
        update,
        delete: vi.fn().mockResolvedValue(null),
        restore: vi.fn().mockResolvedValue(null)
    } as unknown as TaskUseCase
    return { useCase, update }
}

const flush = async (): Promise<void> => {
    await nextTick()
    await nextTick()
    await Promise.resolve()
}

const setup = async (task: TaskViewObject = makeTask()) => {
    const { useCase, update } = makeUseCase(task)
    useTasksStore().addTask(task)
    const api = useTaskViewObject(
        useCase,
        () => undefined,
        () => ''
    )
    await api.getTaskDetails('t1')
    await flush()
    return { ...api, update }
}

describe('T688 / DEF-153 非文本字段基准（交互起点冻结 ⇒ 保存透传）', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it.each([
        ['state', 'done'],
        ['priority', 'high'],
        ['starMarkAt', '2026-02-01T00:00:00.000Z'],
        ['tags', ['tag-1']],
        ['parentTaskId', 'p2'],
        ['startAt', '2026-03-01T00:00:00.000Z'],
        ['endAt', '2026-03-02T00:00:00.000Z']
    ])('字段 %s：beginEdit 后保存 ⇒ 第三参带该字段的旧值', async (field, newValue) => {
        const { updateTaskDetails, beginEdit, update } = await setup()

        beginEdit(field)
        expect(await updateTaskDetails('t1', { [field]: newValue })).toBeNull()

        const expectedOld = (makeTask() as unknown as Record<string, unknown>)[field]
        expect(update).toHaveBeenLastCalledWith(
            't1',
            { [field]: newValue },
            { [field]: expectedOld }
        )
    })

    it('只透传**本次载荷涉及**的字段（冻结了 priority 但保存 name ⇒ 不含 priority）', async () => {
        const { updateTaskDetails, beginEdit, update } = await setup()

        beginEdit('priority')
        await updateTaskDetails('t1', { name: '新名字' })

        expect(update).toHaveBeenLastCalledWith('t1', { name: '新名字' }, { name: '任务A' })
    })

    it('冻结后 store 被自动刷新推进 ⇒ 基准仍是交互起点值（不被推进）', async () => {
        const { updateTaskDetails, beginEdit, update, task } = await setup()

        beginEdit('priority')
        // 模拟自动刷新：store 里的任务被远端更新（priority 变 low），watch 合并进详情面板
        useTasksStore().updateTask('t1', { priority: 'low' })
        await flush()
        expect(task.value?.priority).toBe('low')

        await updateTaskDetails('t1', { priority: 'high' })

        // O 必须仍是打开下拉那一刻的值（medium），不是刷新后的 low
        expect(update).toHaveBeenLastCalledWith('t1', { priority: 'high' }, { priority: 'medium' })
    })

    it('重复 beginEdit 幂等（保留首次冻结值）', async () => {
        const { updateTaskDetails, beginEdit, update, task } = await setup()

        beginEdit('priority')
        task.value!.priority = 'low' // 本地后续变化（未保存）
        beginEdit('priority') // 再次打开下拉

        await updateTaskDetails('t1', { priority: 'high' })
        expect(update).toHaveBeenLastCalledWith('t1', { priority: 'high' }, { priority: 'medium' })
    })

    it('成功提交后清除基准（再次保存同一字段 ⇒ 第三参 undefined）', async () => {
        const { updateTaskDetails, beginEdit, update } = await setup()

        beginEdit('priority')
        await updateTaskDetails('t1', { priority: 'high' })
        await updateTaskDetails('t1', { priority: 'low' })

        expect(update).toHaveBeenLastCalledWith('t1', { priority: 'low' }, undefined)
    })

    it('未 beginEdit 的非文本字段 ⇒ 仍不传基准（DEF-146 之前行为不变）', async () => {
        const { updateTaskDetails, update } = await setup()

        await updateTaskDetails('t1', { state: 'done' })

        expect(update).toHaveBeenLastCalledWith('t1', { state: 'done' }, undefined)
    })
})