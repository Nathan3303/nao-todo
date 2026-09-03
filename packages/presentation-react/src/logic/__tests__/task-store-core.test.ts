import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TaskStoreCore } from '../task-store-core'

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        userId: 'u1',
        parentTaskId: null,
        name: '任务A',
        description: '',
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

describe('TaskStoreCore - 任务/检查项/评论存储', () => {
    it('setTasks/addTask/updateTask/removeTask 全链路', () => {
        const store = new TaskStoreCore()
        store.setTasks([makeTask()])
        expect(store.tasks).toHaveLength(1)

        store.addTask(makeTask({ id: 't2', name: '任务B' }))
        expect(store.tasks).toHaveLength(2)

        store.updateTask('t1', { state: 'done' })
        expect(store.getTask('t1')?.state).toBe('done')

        store.removeTask('t2')
        expect(store.tasks.map((t) => t.id)).toEqual(['t1'])
    })

    it('updateTask 整体替换（不就地打洞，避免响应式代理深入）', () => {
        const store = new TaskStoreCore()
        store.setTasks([makeTask()])
        const before = store.getTask('t1')
        store.updateTask('t1', { name: '新名' })
        const after = store.getTask('t1')
        expect(after?.name).toBe('新名')
        // 引用已替换（旧对象未变）
        expect(before).not.toBe(after)
        expect(before?.name).toBe('任务A')
    })

    it('检查事项按 ID 列表保序，删除同步清理', () => {
        const store = new TaskStoreCore()
        store.setCheckItems([
            { id: 'c1', taskId: 't1', name: '一', isDone: false, sortId: 1 } as never,
            { id: 'c2', taskId: 't1', name: '二', isDone: false, sortId: 2 } as never
        ])
        expect(store.checkItems.map((c) => c.name)).toEqual(['一', '二'])
        store.updateCheckItem('c1', { isDone: true })
        expect(store.getCheckItem('c1')?.isDone).toBe(true)
        store.deleteCheckItem('c1')
        expect(store.checkItems.map((c) => c.id)).toEqual(['c2'])
    })

    it('评论增删改', () => {
        const store = new TaskStoreCore()
        store.setComments([{ id: 'm1', taskId: 't1', content: '评论1' } as never])
        store.addComment({ id: 'm2', taskId: 't1', content: '评论2' } as never)
        expect(store.comments).toHaveLength(2)
        store.updateComment('m1', { content: '改后' })
        expect(store.getComment('m1')?.content).toBe('改后')
        store.removeComment('m2')
        expect(store.comments.map((c) => c.id)).toEqual(['m1'])
    })

    it('订阅通知', () => {
        const store = new TaskStoreCore()
        let notified = 0
        const unsubscribe = store.subscribe(() => notified++)
        store.addTask(makeTask())
        expect(notified).toBe(1)
        unsubscribe()
        store.removeTask('t1')
        expect(notified).toBe(1)
    })

    it('子任务隔离区：与主列表互不污染', () => {
        const store = new TaskStoreCore()
        store.setTasks([makeTask()])
        store.setSubTasks([makeTask({ id: 's1', name: '子任务' })])

        expect(store.tasks.map((t) => t.id)).toEqual(['t1'])
        expect(store.subTasks.map((t) => t.id)).toEqual(['s1'])
        expect(store.getSubTask('t1')).toBeUndefined()
        expect(store.getTask('s1')).toBeUndefined()

        store.addSubTask(makeTask({ id: 's2', name: '子任务2' }))
        store.updateSubTask('s1', { state: 'done' })
        store.removeSubTask('s2')
        expect(store.subTasks.map((t) => t.id)).toEqual(['s1'])
        expect(store.subTasks[0]?.state).toBe('done')
        // 主列表不受影响
        expect(store.tasks.map((t) => t.id)).toEqual(['t1'])
        // 快照独立
        expect(store.getTasksSnapshot().map((t) => t.id)).toEqual(['t1'])
        expect(store.getSubTasksSnapshot().map((t) => t.id)).toEqual(['s1'])
    })
})