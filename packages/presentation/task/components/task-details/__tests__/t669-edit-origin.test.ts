import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../stores'
import useTaskViewObject from '../use-task-view-object'

/**
 * T669 / `DEF-146` —— 编辑器向用例透传「编辑基准」（`persistedText` 即 `O`）
 *
 * 契约（PRD §三 ⑤ / `R-1`）：详情面板保存时，**只**为本次载荷涉及的文本字段传基准，
 * 且基准必须是「用户开始编辑时的已持久化值」（⛔ 不是 store 合并后的最新值 —— `DEF-145` 教训）。
 * 非文本载荷（如 `state`）⇒ 不传（第三参 `undefined`），零行为变化。
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

describe('T669 编辑器透传编辑基准（persistedText = O）', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('保存 name ⇒ 第三参 = 编辑起点的已持久化值', async () => {
        const { useCase, update } = makeUseCase(makeTask())
        useTasksStore().addTask(makeTask())
        const { task, getTaskDetails, updateTaskDetails } = useTaskViewObject(
            useCase,
            () => undefined,
            () => ''
        )
        await getTaskDetails('t1')
        await flush()

        // 模拟输入框编辑（v-model 直写本地，尚未保存）
        task.value!.name = '我的新名字'
        expect(await updateTaskDetails('t1', { name: '我的新名字' })).toBeNull()

        expect(update).toHaveBeenLastCalledWith('t1', { name: '我的新名字' }, { name: '任务A' })
    })

    it('保存 description ⇒ 只带 description 基准（不夹带未涉及的字段）', async () => {
        const { useCase, update } = makeUseCase(makeTask())
        useTasksStore().addTask(makeTask())
        const { task, getTaskDetails, updateTaskDetails } = useTaskViewObject(
            useCase,
            () => undefined,
            () => ''
        )
        await getTaskDetails('t1')
        await flush()

        task.value!.description = '我的新描述'
        expect(await updateTaskDetails('t1', { description: '我的新描述' })).toBeNull()

        expect(update).toHaveBeenLastCalledWith(
            't1',
            { description: '我的新描述' },
            { description: '描述A' }
        )
    })

    it('成功后基准推进到本次提交值（第二次保存的 O = 上次提交值）', async () => {
        const { useCase, update } = makeUseCase(makeTask())
        useTasksStore().addTask(makeTask())
        const { task, getTaskDetails, updateTaskDetails } = useTaskViewObject(
            useCase,
            () => undefined,
            () => ''
        )
        await getTaskDetails('t1')
        await flush()

        task.value!.name = 'v1'
        await updateTaskDetails('t1', { name: 'v1' })
        task.value!.name = 'v2'
        await updateTaskDetails('t1', { name: 'v2' })

        expect(update).toHaveBeenLastCalledWith('t1', { name: 'v2' }, { name: 'v1' })
    })

    it('非文本载荷（state）⇒ 不传编辑基准（零行为变化）', async () => {
        const { useCase, update } = makeUseCase(makeTask())
        useTasksStore().addTask(makeTask())
        const { getTaskDetails, updateTaskDetails } = useTaskViewObject(
            useCase,
            () => undefined,
            () => ''
        )
        await getTaskDetails('t1')
        await flush()

        expect(await updateTaskDetails('t1', { state: 'done' })).toBeNull()
        expect(update).toHaveBeenLastCalledWith('t1', { state: 'done' }, undefined)
    })
})