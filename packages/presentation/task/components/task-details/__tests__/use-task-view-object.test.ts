import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../stores'
import useTaskViewObject from '../use-task-view-object'

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

const makeUseCase = (task: TaskViewObject) =>
    ({
        get: vi.fn().mockResolvedValue([task, null]),
        update: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(null),
        restore: vi.fn().mockResolvedValue(null)
    }) as unknown as TaskUseCase

const flushWatchers = async () => {
    await nextTick()
    await nextTick()
    await Promise.resolve()
}

describe('useTaskViewObject - store 联动保护未保存输入', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('编辑中的 name/description 被保留，其余字段随 store 同步', async () => {
        const taskUseCase = makeUseCase(makeTask())
        const tasksStore = useTasksStore()
        tasksStore.addTask(makeTask()) // 模拟真实 TaskUseCase.get 内部的 addTask
        const { task, getTaskDetails } = useTaskViewObject(
            taskUseCase,
            () => undefined,
            () => ''
        )

        await getTaskDetails('t1')
        await flushWatchers()

        // 模拟 textarea v-model 编辑中（未 @change 提交）
        task.value!.name = '编辑中的名字'
        task.value!.description = '编辑中的描述'

        // 列表侧更新（store 整体替换）
        tasksStore.updateTask('t1', { name: '列表侧新名', state: 'done' })
        await flushWatchers()

        expect(task.value!.name).toBe('编辑中的名字') // 未保存输入被保护
        expect(task.value!.description).toBe('编辑中的描述') // 未保存输入被保护
        expect(task.value!.state).toBe('done') // 其余字段随 store 同步
        expect(task.value!.isDone).toBe(true) // 派生字段同步
    })

    it('未编辑时 store 更新正常覆盖 name/description', async () => {
        const taskUseCase = makeUseCase(makeTask())
        const tasksStore = useTasksStore()
        tasksStore.addTask(makeTask())
        const { task, getTaskDetails } = useTaskViewObject(
            taskUseCase,
            () => undefined,
            () => ''
        )

        await getTaskDetails('t1')
        await flushWatchers()

        tasksStore.updateTask('t1', { name: '新名', description: '新描述', priority: 'high' })
        await flushWatchers()

        expect(task.value!.name).toBe('新名')
        expect(task.value!.description).toBe('新描述')
        expect(task.value!.priority).toBe('high')
    })

    it('提交后（updateTaskDetails 同步 store）不误判为编辑中', async () => {
        const taskUseCase = makeUseCase(makeTask())
        const tasksStore = useTasksStore()
        tasksStore.addTask(makeTask())
        const { task, getTaskDetails, updateTaskDetails } = useTaskViewObject(
            taskUseCase,
            () => undefined,
            () => ''
        )

        await getTaskDetails('t1')
        await flushWatchers()

        // 详情面板内提交 name（乐观合并 + usecase.update 同步 store）
        await updateTaskDetails('t1', { name: '提交后的名字' })
        await flushWatchers()

        expect(task.value!.name).toBe('提交后的名字')

        // 列表侧再次更新其他字段，name 不应被误保留为旧值
        tasksStore.updateTask('t1', { priority: 'urgent' })
        await flushWatchers()

        expect(task.value!.name).toBe('提交后的名字')
        expect(task.value!.priority).toBe('urgent')
    })
})