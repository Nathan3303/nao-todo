import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared/requester/types'
import { setAuthToken } from '../auth-token-core'
import { TaskStoreCore } from '../task-store-core'
import { composeTaskUseCase } from '../compose-task-usecase'

// Node 测试环境无 localStorage：注册 token provider（与 Lynx 运行时同机制）
beforeEach(() => setAuthToken('test-token'))

/**
 * 构造 mock Requester：按 method+url 返回预置响应（仿后端 code 约定）
 * @param routes 路由表（get/post/put/delete → 响应 data）
 */
const makeRequester = (
    routes: Record<string, Record<string, { code: number; message?: string; data?: unknown }>>
): Requester => {
    const request = (method: string, url: string) => {
        const handler = routes[method]?.[url] ?? routes[method]?.['*']
        if (!handler)
            return Promise.resolve({
                data: { code: -1, message: `未 mock: ${method} ${url}`, data: null }
            })
        const { code, message, data: resData } = handler
        return Promise.resolve({ data: { code, message: message ?? '', data: resData ?? null } })
    }
    return {
        _instance: null,
        name: 'MockRequester',
        baseURL: '',
        get: vi.fn((url) => request('get', url)),
        post: vi.fn((url) => request('post', url)),
        put: vi.fn((url) => request('put', url)),
        delete: vi.fn((url) => request('delete', url))
    } as unknown as Requester
}

// 任务响应（TaskRes 核心字段）
const makeTaskRes = (overrides: Record<string, unknown> = {}) => ({
    id: 't1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: '',
    parentTaskId: '',
    name: '任务A',
    description: '描述',
    state: 'todo',
    priority: 'low',
    startAt: '',
    endAt: '',
    projectId: '',
    tags: ['tag-1'],
    archivedAt: '',
    starMarkAt: '',
    givenUpAt: '',
    remindAt: '',
    remindRepeat: 'none',
    remindTime: '',
    remindWeekdays: [],
    ...overrides
})

describe('composeTaskUseCase - 复用 domain-task 全链路（mock Requester）', () => {
    it('listTasks 拉取列表并写入 store', async () => {
        const store = new TaskStoreCore()
        const requester = makeRequester({
            get: { '/tasks/?isDeleted=false': { code: 40050, data: [makeTaskRes()] } }
        })
        const useCase = composeTaskUseCase(requester, store)

        const [result, err] = await useCase.listTasks({ isDeleted: false })
        expect(err).toBeNull()
        expect(result?.taskIds).toEqual(['t1'])
        // store 已写入（列表页可直接读 store 渲染）
        expect(store.getTask('t1')?.name).toBe('任务A')
        expect(store.tasks).toHaveLength(1)
    })

    it('createTask 创建成功并写入 store', async () => {
        const store = new TaskStoreCore()
        const requester = makeRequester({
            post: { '/tasks/': { code: 40010, data: makeTaskRes({ id: 't9', name: '新建' }) } }
        })
        const useCase = composeTaskUseCase(requester, store)

        const [task, err] = await useCase.createTask({
            projectId: '',
            name: '新建',
            description: '',
            state: 'todo',
            priority: 'low',
            startAt: null,
            endAt: null,
            tags: [],
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        })
        expect(err).toBeNull()
        expect(task?.id).toBe('t9')
        expect(store.getTask('t9')?.name).toBe('新建')
    })

    it('updateTask 空描述透传（回归：清空描述）', async () => {
        const store = new TaskStoreCore()
        const requester = makeRequester({
            put: { '/tasks/t1': { code: 40020 } }
        })
        const useCase = composeTaskUseCase(requester, store)

        const err = await useCase.updateTask('t1', { description: '' })
        expect(err).toBeNull()
        const putBody = (requester.put as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
        expect(putBody).toEqual({ description: '' })
    })

    it('updateTask 失败时返回错误信息（不写 store）', async () => {
        const store = new TaskStoreCore()
        const requester = makeRequester({
            put: { '/tasks/t1': { code: -1, message: '后端拒绝' } }
        })
        const useCase = composeTaskUseCase(requester, store)

        const err = await useCase.updateTask('t1', { name: 'x' })
        expect(err).toBe('后端拒绝')
    })

    it('检查事项：list/create/update/delete 全链路', async () => {
        const store = new TaskStoreCore()
        const requester = makeRequester({
            get: {
                '/events/?taskId=t1': {
                    code: 50040,
                    data: [
                        {
                            id: 'c1',
                            createdAt: '2026-01-01T00:00:00Z',
                            updatedAt: '2026-01-01T00:00:00Z',
                            deletedAt: '',
                            taskId: 't1',
                            name: '事项',
                            isDone: false,
                            sortId: 1
                        }
                    ]
                }
            },
            post: {
                '/events/': {
                    code: 50010,
                    data: {
                        id: 'c2',
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-01T00:00:00Z',
                        deletedAt: '',
                        taskId: 't1',
                        name: '新事项',
                        isDone: false,
                        sortId: 2
                    }
                }
            },
            put: { '/events/c1': { code: 50020 } },
            delete: { '/events/c2': { code: 50030, data: 'c2' } }
        })
        const useCase = composeTaskUseCase(requester, store)

        const [ids, listErr] = await useCase.listCheckItems('t1')
        expect(listErr).toBeNull()
        expect(ids).toEqual(['c1'])
        expect(store.checkItems.map((c) => c.id)).toEqual(['c1'])

        const createErr = await useCase.createCheckItem({ taskId: 't1', name: '新事项' })
        expect(createErr).toBeNull()
        expect(store.getCheckItem('c2')?.name).toBe('新事项')

        const updateErr = await useCase.updateCheckItem('c1', { isDone: true })
        expect(updateErr).toBeNull()
        expect(store.getCheckItem('c1')?.isDone).toBe(true)

        const deleteErr = await useCase.deleteCheckItem('c2')
        expect(deleteErr).toBeNull()
        expect(store.checkItems.map((c) => c.id)).toEqual(['c1'])
    })

    it('评论：list/create/update/delete 全链路', async () => {
        const store = new TaskStoreCore()
        const commentRes = (id: string, content: string) => ({
            id,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            deletedAt: '',
            taskId: 't1',
            content,
            attachments: [],
            isTopUp: false,
            nickname: '用户',
            avatar: ''
        })
        const requester = makeRequester({
            get: {
                '/comments/?taskId=t1': { code: 60040, data: [commentRes('m1', '评论1')] }
            },
            post: { '/comments/': { code: 60010, data: commentRes('m2', '评论2') } },
            put: { '/comments/m1': { code: 60020 } },
            delete: { '/comments/m2': { code: 60030, data: 'm2' } }
        })
        const useCase = composeTaskUseCase(requester, store)

        const [ids, listErr] = await useCase.listComments('t1')
        expect(listErr).toBeNull()
        expect(ids).toEqual(['m1'])

        const createErr = await useCase.createComment({ taskId: 't1', content: '评论2' })
        expect(createErr).toBeNull()
        expect(store.getComment('m2')?.content).toBe('评论2')

        const updateErr = await useCase.updateComment('m1', { content: '改后' })
        expect(updateErr).toBeNull()

        const deleteErr = await useCase.deleteComment('m2')
        expect(deleteErr).toBeNull()
        expect(store.comments.map((c) => c.id)).toEqual(['m1'])
    })

    it('子任务：list/create/状态切换/delete 全链路（独立隔离区）', async () => {
        const store = new TaskStoreCore()
        const requester = makeRequester({
            get: {
                // 父任务存在性校验（domain 守卫：父必须存在且为顶层；get 成功码为 40000）
                '/tasks/t1?isDeleted=true': { code: 40000, data: makeTaskRes() },
                '/tasks/?parentTaskId=t1&limit=20&isDeleted=false': {
                    code: 40050,
                    data: [makeTaskRes({ id: 's1', name: '子任务1', parentTaskId: 't1' })]
                }
            },
            post: {
                '/tasks/': {
                    code: 40010,
                    data: makeTaskRes({ id: 's2', name: '子任务2', parentTaskId: 't1' })
                }
            },
            put: { '/tasks/s1': { code: 40020 } },
            delete: { '/tasks/s2': { code: 40030 } }
        })
        const useCase = composeTaskUseCase(requester, store)

        // 列表：parentTaskId 参数入 URL，子任务写入隔离区
        const [ids, listErr] = await useCase.listSubTasks('t1')
        expect(listErr).toBeNull()
        expect(ids?.taskIds).toEqual(['s1'])
        expect(store.subTasks.map((t) => t.id)).toEqual(['s1'])
        // 主列表未被污染
        expect(store.tasks).toHaveLength(0)

        // 创建：带 parentTaskId，写入隔离区
        const [sub, createErr] = await useCase.createSubTask('t1', '子任务2')
        expect(createErr).toBeNull()
        expect(sub?.id).toBe('s2')
        const postBody = (requester.post as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
        expect(postBody.parentTaskId).toBe('t1')
        expect(store.subTasks.map((t) => t.id)).toEqual(['s1', 's2'])

        // 状态切换：更新隔离区而非主列表
        const stateErr = await useCase.updateSubTaskState('s1', 'done')
        expect(stateErr).toBeNull()
        expect(store.getSubTask('s1')?.state).toBe('done')
        expect(store.getTask('s1')).toBeUndefined()

        // 删除
        const deleteErr = await useCase.deleteSubTask('s2')
        expect(deleteErr).toBeNull()
        expect(store.subTasks.map((t) => t.id)).toEqual(['s1'])
    })
})