import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { syncTracker } from '../sync-tracker'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { newLocalTaskCheckItemRepository } from '../../persistence-local/repos/task-check-item-repo-impl'
import { newLocalTaskCommentRepository } from '../../persistence-local/repos/task-comment-repo-impl'
import { newLocalPomodoroRepository } from '../../persistence-local/repos/pomodoro-repo-impl'
import { newLocalPomodoroRecordRepository } from '../../persistence-local/repos/pomodoro-record-repo-impl'
import {
    CreateTaskValueObject,
    CreateTaskCheckItemValueObject,
    CreateTaskCommentValueObject
} from '@nao-todo/domain-task'
import {
    CreatePomodoroValueObject,
    CreatePomodoroRecordValueObject
} from '@nao-todo/domain-pomodoro'

/**
 * 清空全部表并建立会话 + 密钥
 */
const setup = async (userId = 'test-user') => {
    await localDatabase.projects.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tags.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    await localDatabase.taskCheckItems.clear()
    await localDatabase.taskComments.clear()
    await localDatabase.pomodoros.clear()
    await localDatabase.pomodoroRecords.clear()
    await localDatabase.users.clear()
    await localDatabase.userConfigs.clear()
    await localDatabase.meta.clear()
    await localDatabase.deletionSchedules.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(userId)
    await cryptoService.setup(userId, 'test-password')
}

const mockRequester = (handler: (url: string, body: unknown) => unknown): Requester =>
    ({
        post: async (url: string, body: unknown) => ({ data: handler(url, body) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

describe('SyncTracker', () => {
    beforeEach(async () => {
        await setup()
    })

    it('同实体重复 markDirty 合并为一条（updatedAt 更新、createdAt 保留）', async () => {
        await syncTracker.markDirty('tasks', 't-1', 'upsert', '2024-01-01T00:00:00Z')
        await syncTracker.markDirty('tasks', 't-1', 'upsert', '2024-01-02T00:00:00Z')
        const queue = await syncTracker.listDirty()
        expect(queue.length).toBe(1)
        const first = queue[0]
        expect(first).toBeDefined()
        expect(first!.localUpdatedAt).toBe('2024-01-02T00:00:00Z')
        expect(first!.createdAt).toBe(first!.createdAt)
    })

    it('无会话（未登录）不登记', async () => {
        localSession.clear()
        await syncTracker.markDirty('tasks', 't-1', 'upsert', '2024-01-01T00:00:00Z')
        expect(await syncTracker.countDirty()).toBe(0)
    })

    it('removeQueued 移除队列项；markFailed 自增 retryCount', async () => {
        await syncTracker.markDirty('tasks', 't-1', 'upsert', '2024-01-01T00:00:00Z')
        await syncTracker.markDirty('tasks', 't-2', 'upsert', '2024-01-01T00:00:00Z')
        const [item] = await syncTracker.listDirty()
        expect(item).toBeDefined()
        await syncTracker.markFailed(item!.id)
        const [failed] = await syncTracker.listDirty()
        expect(failed).toBeDefined()
        expect(failed!.retryCount).toBe(1)
        await syncTracker.removeQueued('tasks', 't-1')
        expect(await syncTracker.countDirty()).toBe(1)
    })
})

describe('级联删除（task remove → 子任务/检查项/评论）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('删除父任务连带软删子任务/检查项/评论并入队', async () => {
        const taskRepo = newLocalTaskRepository()
        const checkItemRepo = newLocalTaskCheckItemRepository()
        const commentRepo = newLocalTaskCommentRepository()
        const [parent, parentErr] = await taskRepo.create(
            new CreateTaskValueObject(
                null,
                null,
                '父任务',
                '',
                'todo',
                'medium',
                null,
                null,
                'project-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(parentErr).toBeNull()
        const parentId = (parent as { id: string }).id
        const [sub, subErr] = await taskRepo.create(
            new CreateTaskValueObject(
                null,
                parentId,
                '子任务',
                '',
                'todo',
                'medium',
                null,
                null,
                'project-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(subErr).toBeNull()
        const subId = (sub as { id: string }).id
        await checkItemRepo.create(
            new CreateTaskCheckItemValueObject(parentId, '检查项', false, false)
        )
        await commentRepo.create(new CreateTaskCommentValueObject(parentId, '评论内容', [], false))

        const removeErr = await taskRepo.remove(parentId)
        expect(removeErr).toBeNull()

        // 本地软删断言
        const subRecord = await localDatabase.tasks.get(subId)
        expect(subRecord?.deletedAt).not.toBeNull()
        const checkItems = await localDatabase.taskCheckItems.toArray()
        expect(checkItems.every((c) => c.deletedAt !== null)).toBe(true)
        const comments = await localDatabase.taskComments.toArray()
        expect(comments.every((c) => c.deletedAt !== null)).toBe(true)

        // 队列断言：父任务 + 子任务 + 检查项 + 评论 = 4 条 delete
        const queue = await syncTracker.listDirty()
        expect(queue.length).toBe(4)
        expect(queue.every((q) => q.action === 'delete')).toBe(true)
        const tables = queue.map((q) => q.table).sort()
        expect(tables).toEqual(['taskCheckItems', 'taskComments', 'tasks', 'tasks'])
    })
})

describe('SyncService', () => {
    beforeEach(async () => {
        await setup()
    })

    it('信任远程 totalDuration 字段（拉取 pomodoros 覆盖本地）', async () => {
        const pomodoroRepo = newLocalPomodoroRepository()
        const [pomodoro, pomodoroErr] = await pomodoroRepo.create(
            new CreatePomodoroValueObject(1, '专注', '', 25)
        )
        expect(pomodoroErr).toBeNull()
        const pomodoroId = (pomodoro as { id: string }).id
        const now = new Date().toISOString()
        const remotePomodoro = {
            id: pomodoroId,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            type: 1,
            name: '专注',
            description: '',
            duration: 25,
            archivedAt: null,
            totalDuration: 999 // 后端原子维护的权威值
        }
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return {
                        data: {
                            data: {
                                pomodoros: { items: [remotePomodoro], nextCursor: null },
                                projects: { items: [], nextCursor: null },
                                tags: { items: [], nextCursor: null },
                                tasks: { items: [], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        await service.pullAll()
        const updated = await localDatabase.pomodoros.get(pomodoroId)
        expect(updated?.totalDuration).toBe(999)
    })

    it('手动重算 totalDuration（兜底工具）：sum 未删除记录', async () => {
        const pomodoroRepo = newLocalPomodoroRepository()
        const recordRepo = newLocalPomodoroRecordRepository()
        const [pomodoro, pomodoroErr] = await pomodoroRepo.create(
            new CreatePomodoroValueObject(1, '专注', '', 25)
        )
        expect(pomodoroErr).toBeNull()
        const pomodoroId = (pomodoro as { id: string }).id
        const now = new Date().toISOString()
        await recordRepo.create(
            new CreatePomodoroRecordValueObject(
                'session-1',
                1,
                now,
                now,
                25,
                pomodoroId,
                '',
                '',
                '',
                ''
            )
        )
        await recordRepo.create(
            new CreatePomodoroRecordValueObject(
                'session-2',
                1,
                now,
                now,
                5,
                pomodoroId,
                '',
                '',
                '',
                ''
            )
        )
        const service = new SyncService(mockRequester(() => ({ data: {}, serverTime: Date.now() })))
        await service.recalculateTotalDurations([pomodoroId])
        const updated = await localDatabase.pomodoros.get(pomodoroId)
        expect(updated?.totalDuration).toBe(30)
    })

    it('LWW：本地未推送修改较新时，拉取不覆盖（保留队列项）', async () => {
        const taskRepo = newLocalTaskRepository()
        const [task, taskErr] = await taskRepo.create(
            new CreateTaskValueObject(
                null,
                null,
                '任务',
                '',
                'todo',
                'medium',
                null,
                null,
                'project-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(taskErr).toBeNull()
        const taskId = (task as { id: string }).id
        // 本地较新修改入队
        await syncTracker.markDirty('tasks', taskId, 'upsert', '2025-01-01T00:00:00Z')

        const now = new Date().toISOString()
        const remoteTask = {
            id: taskId,
            createdAt: now,
            updatedAt: '2024-01-01T00:00:00Z', // 远程更旧
            deletedAt: null,
            parentTaskId: '',
            name: '远程名',
            description: '',
            state: 'todo',
            priority: 'medium',
            startAt: '',
            endAt: '',
            tags: [],
            projectId: 'project-1',
            archivedAt: null,
            starMarkAt: null,
            givenUpAt: null,
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        }
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return {
                        data: {
                            data: {
                                tasks: { items: [remoteTask], nextCursor: null },
                                projects: { items: [], nextCursor: null },
                                tags: { items: [], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [], nextCursor: null },
                                pomodoros: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        await service.pullAll()
        // 本地未被覆盖（本地名保留）+ 队列项保留
        const record = await localDatabase.tasks.get(taskId)
        expect(record).not.toBeNull()
        const local = await taskRepo.get(taskId)
        expect((local[0] as { name: string } | null)?.name).toBe('任务')
        expect(await syncTracker.countDirty()).toBe(1)
    })

    it('拉取归一化网络错误（断网/超时）不显示同步成功', async () => {
        // requester 归一化网络错误响应：顶层携带字符串 code，data.data 为 null（axios.ts 拦截器产出）
        const service = new SyncService({
            post: async () => ({
                code: 'ERR_NETWORK',
                data: { data: null, message: '网络错误，请检查您的网络连接', code: 50300 }
            }),
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester)
        await service.pullAll()
        const state = syncStatus.get()
        expect(state.syncing).toBe(false)
        expect(state.lastError).toBe('拉取失败：网络错误')
    })

    it('拉取尾页后游标推进到本批最大 updatedAt（避免每轮重拉）', async () => {
        const now = new Date().toISOString()
        const remoteProject = (id: string, updatedAt: string) => ({
            id,
            createdAt: now,
            updatedAt,
            deletedAt: null,
            name: '项目',
            description: '',
            archivedAt: null,
            deactivedAt: null,
            sortId: 0
        })
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return {
                        data: {
                            data: {
                                projects: {
                                    items: [
                                        remoteProject('p-1', '2024-03-01T00:00:00Z'),
                                        remoteProject('p-2', '2024-03-05T00:00:00Z')
                                    ],
                                    nextCursor: null // 尾页：无下一页游标
                                },
                                tags: { items: [], nextCursor: null },
                                tasks: { items: [], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [], nextCursor: null },
                                pomodoros: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        await service.pullAll()
        const cursor = await localDatabase.syncCursor.get('test-user:projects')
        expect(cursor?.lastPullAt).toBe('2024-03-05T00:00:00Z')
    })

    it('推送确认时本地已有新修改则保留队列项（防本地修改丢失）', async () => {
        const taskRepo = newLocalTaskRepository()
        const [task, taskErr] = await taskRepo.create(
            new CreateTaskValueObject(
                null,
                null,
                '任务',
                '',
                'todo',
                'medium',
                null,
                null,
                'project-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(taskErr).toBeNull()
        const taskId = (task as { id: string }).id
        // 队列项为旧版本 A
        await syncTracker.markDirty('tasks', taskId, 'upsert', '2024-01-01T00:00:00Z')

        const service = new SyncService({
            post: async () => {
                // 模拟推送在途期间本地产生新修改（版本 B，覆盖同一队列项）
                await syncTracker.markDirty('tasks', taskId, 'upsert', '2025-01-01T00:00:00Z')
                return {
                    data: {
                        data: { results: [{ table: 'tasks', id: taskId }] },
                        serverTime: Date.now()
                    }
                }
            },
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester)
        await service.pushAll()
        // 队列项应保留（localUpdatedAt 已变为版本 B），下轮重推
        expect(await syncTracker.countDirty()).toBe(1)
        const [item] = await syncTracker.listDirty()
        expect(item).toBeDefined()
        expect(item!.localUpdatedAt).toBe('2025-01-01T00:00:00Z')
    })

    it('拉取返回业务码 10041（用户凭证验证失败）：触发会话失效回调并提示重新登录', async () => {
        const service = new SyncService(
            mockRequester(() => ({
                code: 10041,
                message: '用户凭证验证失败',
                data: null
            }))
        )
        let expiredCalled = false
        service.setSessionExpiredListener(() => {
            expiredCalled = true
        })
        await service.pullAll()
        expect(expiredCalled).toBe(true)
        const state = syncStatus.get()
        expect(state.lastError).toBe('登录已过期，请重新登录')
    })

    it('推送返回业务码 10041（用户凭证验证失败）：触发会话失效回调并提示重新登录', async () => {
        const taskRepo = newLocalTaskRepository()
        const [task, taskErr] = await taskRepo.create(
            new CreateTaskValueObject(
                null,
                null,
                '任务',
                '',
                'todo',
                'medium',
                null,
                null,
                'project-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(taskErr).toBeNull()
        const taskId = (task as { id: string }).id
        await syncTracker.markDirty('tasks', taskId, 'upsert', new Date().toISOString())

        const service = new SyncService(
            mockRequester(() => ({
                code: 10041,
                message: '用户凭证验证失败'
            }))
        )
        let expiredCalled = false
        service.setSessionExpiredListener(() => {
            expiredCalled = true
        })
        await service.pushAll()
        expect(expiredCalled).toBe(true)
        const state = syncStatus.get()
        expect(state.lastError).toBe('登录已过期，请重新登录')
        // 失败不累加 retryCount（凭证失效非网络错误，避免被 5 次上限永久暂停）
        const [item] = await syncTracker.listDirty()
        expect(item).toBeDefined()
        expect(item!.retryCount).toBe(0)
    })

    it('拉取有实际写入时触发数据变化回调（通知视图刷新）', async () => {
        const now = new Date().toISOString()
        const remoteProject = {
            id: 'p-remote',
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            name: '远程项目',
            description: '',
            archivedAt: null,
            deactivedAt: null,
            sortId: 0
        }
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return {
                        data: {
                            data: {
                                projects: { items: [remoteProject], nextCursor: null },
                                tags: { items: [], nextCursor: null },
                                tasks: { items: [], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [], nextCursor: null },
                                pomodoros: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        let dataChanged = false
        service.setDataChangedListener(() => {
            dataChanged = true
        })
        await service.pullAll()
        expect(dataChanged).toBe(true)
        // 拉取落库成功
        const record = await localDatabase.projects.get('p-remote')
        expect(record).toBeDefined()
    })

    it('拉取无实际写入（空数据）时不触发数据变化回调', async () => {
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return {
                        data: {
                            data: {
                                projects: { items: [], nextCursor: null },
                                tags: { items: [], nextCursor: null },
                                tasks: { items: [], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [], nextCursor: null },
                                pomodoros: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        let dataChanged = false
        service.setDataChangedListener(() => {
            dataChanged = true
        })
        await service.pullAll()
        expect(dataChanged).toBe(false)
    })

    it('远程任务 tags 为 null（后端 nil slice）：拉取不抛错且本地落库为空数组', async () => {
        const now = new Date().toISOString()
        const remoteTask = {
            id: 't-null-tags',
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            parentTaskId: '',
            name: '远程任务',
            description: '',
            state: 'todo',
            priority: 'medium',
            startAt: '',
            endAt: '',
            tags: null, // 后端 Go nil slice 序列化为 JSON null，与类型声明不符
            projectId: 'project-1',
            archivedAt: null,
            starMarkAt: null,
            givenUpAt: null,
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        }
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return {
                        data: {
                            data: {
                                projects: { items: [], nextCursor: null },
                                tags: { items: [], nextCursor: null },
                                tasks: { items: [remoteTask], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [], nextCursor: null },
                                pomodoros: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        // 修复前 taskEntityToRecord 的 [...entity.tags] 会抛 "entity.tags is not iterable"
        await service.pullAll()
        const record = await localDatabase.tasks.get('t-null-tags')
        expect(record).toBeDefined()
        expect(record!.tags).toEqual([])
    })

    it('远程评论 attachments 为 null：拉取不抛错且本地落库为空数组', async () => {
        const now = new Date().toISOString()
        const remoteComment = {
            id: 'c-null-attachments',
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            taskId: 't-null-tags',
            content: '远程评论',
            attachments: null, // 后端 nil slice 序列化为 JSON null
            isTopUp: false,
            avatar: '',
            nickname: '用户'
        }
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return {
                        data: {
                            data: {
                                projects: { items: [], nextCursor: null },
                                tags: { items: [], nextCursor: null },
                                tasks: { items: [], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [remoteComment], nextCursor: null },
                                pomodoros: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        // 修复前 taskCommentEntityToRecord 的 [...entity.attachments] 会抛 "entity.attachments is not iterable"
        await service.pullAll()
        const record = await localDatabase.taskComments.get('c-null-attachments')
        expect(record).toBeDefined()
        expect(record!.attachments).toEqual([])
    })
})

describe('SyncService 游标瞬时比较与回拉窗口（DEF-SYNC-05）', () => {
    beforeEach(async () => {
        await setup()
    })

    const remoteProject = (id: string, updatedAt: string) => ({
        id,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt,
        deletedAt: null,
        name: '项目',
        description: '',
        archivedAt: null,
        deactivedAt: null,
        sortId: 0
    })

    /** 服务端 keyset 语义（与 `query/sync.go:26-36` 同口径）：`updated_at > c OR (= c AND id > cid)`（严格 `>`） */
    const keysetFilter = (
        rows: { id: string; updatedAt: string }[],
        cursorAt: string,
        cursorId: string
    ) =>
        rows.filter(
            (row) => row.updatedAt > cursorAt || (row.updatedAt === cursorAt && row.id > cursorId)
        )

    /** 预置本地游标（模拟已推进到某位置） */
    const seedCursor = async (at: string, id = '') => {
        await localDatabase.syncCursor.put({
            id: 'test-user:projects',
            userId: 'test-user',
            table: 'projects',
            lastPullAt: at,
            lastPullId: id,
            updatedAt: new Date().toISOString()
        })
    }

    /** 仅返回 projects 表的拉取响应（其余表缺省 ⇒ 跳过，不影响游标） */
    const pullResponse = (items: Record<string, unknown>[], nextCursor: string | null = null) => ({
        data: { data: { projects: { items, nextCursor, nextCursorId: null } } },
        serverTime: Date.now()
    })

    it('缺陷1：混合 +08:00 / Z 时按瞬时取 max（字典序会把瞬时更早的值当成更晚）', async () => {
        // 瞬时：'2024-03-05T00:00:00+08:00' = 2024-03-04T16:00Z < '2024-03-04T20:00:00Z'
        // 字典序：'…03-**05**T…+08:00' > '…03-**04**T…Z' ⇒ 旧实现取到瞬时更早的那个
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/pull'
                    ? pullResponse([
                          remoteProject('p-offset', '2024-03-05T00:00:00+08:00'),
                          remoteProject('p-utc', '2024-03-04T20:00:00Z')
                      ])
                    : { data: { results: [] }, serverTime: Date.now() }
            )
        )
        await service.pullAll()
        const cursor = await localDatabase.syncCursor.get('test-user:projects')
        expect(cursor?.lastPullAt).toBe('2024-03-04T20:00:00Z')
    })

    it('游标只前进不后退：服务端游标瞬时早于本地游标时不回退', async () => {
        await seedCursor('2024-03-05T10:00:00Z')
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/pull'
                    ? pullResponse(
                          [remoteProject('p-old', '2024-03-05T09:00:00Z')],
                          '2024-03-05T09:00:00Z'
                      )
                    : { data: { results: [] }, serverTime: Date.now() }
            )
        )
        await service.pullAll()
        const cursor = await localDatabase.syncCursor.get('test-user:projects')
        expect(cursor?.lastPullAt).toBe('2024-03-05T10:00:00Z')
    })

    it('缺陷2（唯一硬判据）：游标 ≥ 变更行 updatedAt（ms 级）时，外部变更行仍被应用', async () => {
        // 外部设备直写在 12:00:00.400 落库；本地游标已被推进到 12:00:00.401（ms 级越过）
        const changedAt = '2024-03-05T12:00:00.400Z'
        const advanced = '2024-03-05T12:00:00.401Z'
        await seedCursor(advanced)
        const serverRows = [remoteProject('p-ext', changedAt)]
        const sentCursors: string[] = []
        const service = new SyncService(
            mockRequester((url, body) => {
                if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
                const sent = (body as { projects: { updatedAt: string; cursorId: string } })
                    .projects
                sentCursors.push(sent.updatedAt)
                return pullResponse(keysetFilter(serverRows, sent.updatedAt, sent.cursorId))
            })
        )
        await service.pullAll()
        // ① 请求游标按瞬时回拉（旧实现直接发 advanced，服务端严格 `>` 会跳过该行）
        expect(sentCursors).toHaveLength(1)
        expect(Date.parse(sentCursors[0]!)).toBeLessThan(Date.parse(advanced))
        // ② 外部变更行仍被应用
        const applied = await localDatabase.projects.get('p-ext')
        expect(applied).toBeDefined()
        expect(String(applied?.updatedAt)).toBe(changedAt)
        // ③ 游标只前进不后退
        const cursor = await localDatabase.syncCursor.get('test-user:projects')
        expect(Date.parse(String(cursor?.lastPullAt))).toBeGreaterThanOrEqual(Date.parse(advanced))
    })

    it('Δ 回拉窗口幂等：每轮只请求一次、重复拉取不重复建行、游标不滑退', async () => {
        const changedAt = '2024-03-05T12:00:00Z'
        const serverRows = [remoteProject('p-ext', changedAt)]
        const sentCursors: string[] = []
        const service = new SyncService(
            mockRequester((url, body) => {
                if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
                const sent = (body as { projects: { updatedAt: string; cursorId: string } })
                    .projects
                sentCursors.push(sent.updatedAt)
                return pullResponse(keysetFilter(serverRows, sent.updatedAt, sent.cursorId))
            })
        )
        await service.pullAll()
        const afterFirst = await localDatabase.syncCursor.get('test-user:projects')
        await service.pullAll()
        const afterSecond = await localDatabase.syncCursor.get('test-user:projects')
        // 每轮一次请求（无补偿轮/无拉取风暴）；重放幂等：仍只有一行
        expect(sentCursors).toHaveLength(2)
        expect(await localDatabase.projects.count()).toBe(1)
        // 游标稳定：第二轮请求 = 存储游标 − Δ，且二轮后游标不滑退
        expect(Date.parse(sentCursors[1]!)).toBe(Date.parse(String(afterFirst?.lastPullAt)) - 1000)
        expect(afterSecond?.lastPullAt).toBe(afterFirst?.lastPullAt)
    })
})

describe('SyncService 运行级语义（SHELL-03：DEF-SYNC-01/02/03、BC-3a/b/c、BC-6）', () => {
    beforeEach(async () => {
        await setup()
    })

    /** 造一条脏队列项（真实仓储写入 → markDirty），返回队列项 id */
    const seedDirtyTask = async (name: string): Promise<string> => {
        const repo = newLocalTaskRepository()
        const [task, err] = await repo.create(
            new CreateTaskValueObject(
                null,
                null,
                name,
                '',
                'todo',
                'medium',
                null,
                null,
                'project-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(err).toBeNull()
        const taskId = (task as { id: string }).id
        await syncTracker.markDirty('tasks', taskId, 'upsert', new Date().toISOString())
        const [item] = await syncTracker.listDirty()
        return item!.id
    }

    /** 断网（归一化网络错误）：pull 与 push 均失败（直连响应形状，同既有测试） */
    const networkFailRequester = (): Requester =>
        ({
            post: async (url: string) =>
                url === '/sync/pull'
                    ? { code: 'ERR_NETWORK', data: { data: null } }
                    : { code: 'ERR_NETWORK' },
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        }) as unknown as Requester

    it('BC-3a/DEF-SYNC-01：断网 + 脏队列为空 ⇒ 拉取错误不被末阶段清除（start 返回 ok=false）', async () => {
        const before = syncStatus.get().lastSyncAt
        const service = new SyncService(networkFailRequester())
        const result = await service.start()
        expect(result.ok).toBe(false)
        expect(result.lastError).toBe('拉取失败：网络错误')
        expect(result.phase).toBe('pull')
        const state = syncStatus.get()
        expect(state.syncing).toBe(false)
        expect(state.lastError).toBe('拉取失败：网络错误')
        // DEF-SYNC-03/C-11：失败运行不推进 lastSyncAt
        expect(state.lastSyncAt).toBe(before)
    })

    it('BC-3b：两阶段皆失败 ⇒ lastError 取首个（拉取）且 errorCount≥2', async () => {
        await seedDirtyTask('离线任务')
        const service = new SyncService(networkFailRequester())
        const result = await service.start()
        expect(result.ok).toBe(false)
        expect(result.lastError).toBe('拉取失败：网络错误')
        expect(result.phase).toBe('pull')
        expect(result.errors.length).toBe(2)
        const state = syncStatus.get()
        expect(state.errorCount).toBe(2)
        // 推送失败语义不变：未确认/失败项 markFailed 生效
        expect(state.failedCount).toBe(1)
    })

    it('BC-3c：仅推送失败 ⇒ lastError 为推送文案（现状语义不回退）', async () => {
        await seedDirtyTask('仅推送失败')
        const service = new SyncService({
            post: async (url: string) =>
                url === '/sync/pull'
                    ? { data: { data: { data: {} } }, serverTime: Date.now() }
                    : { code: 'ERR_NETWORK' },
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester)
        const result = await service.start()
        expect(result.ok).toBe(false)
        expect(result.lastError).toBe('推送失败：网络错误')
        expect(result.phase).toBe('push')
        expect(syncStatus.get().syncing).toBe(false)
    })

    it('BC-6/DEF-SYNC-02：全部队列项重试超限 ⇒ 运行必终结且 ok=false（不得假成功）', async () => {
        const queueId = await seedDirtyTask('超限任务')
        for (let i = 0; i < 5; i += 1) await syncTracker.markFailed(queueId)
        const service = new SyncService(
            mockRequester((url: string) =>
                url === '/sync/pull'
                    ? { data: { data: {} }, serverTime: Date.now() }
                    : { code: 'ERR_NETWORK' }
            )
        )
        const pushResult = await service.pushAll()
        expect(pushResult.ok).toBe(false)
        expect(pushResult.lastError).toBe('推送失败：重试次数已达上限')
        expect(syncStatus.get().syncing).toBe(false)
        expect(await syncTracker.countDirty()).toBe(1)
        // 冷启动路径（start）同样不得假成功
        const startResult = await service.start()
        expect(startResult.ok).toBe(false)
        expect(syncStatus.get().syncing).toBe(false)
    })

    it('Q3：推送响应未确认实体 ⇒ 运行失败且同阶段只上报一次（队列语义不变）', async () => {
        await seedDirtyTask('未确认A')
        await seedDirtyTask('未确认B')
        const service = new SyncService(
            mockRequester((url: string) =>
                url === '/sync/pull'
                    ? { data: { data: {} }, serverTime: Date.now() }
                    : { data: { results: [] }, serverTime: Date.now() }
            )
        )
        const result = await service.pushAll()
        expect(result.ok).toBe(false)
        expect(result.lastError).toBe('推送失败：部分数据未确认')
        expect(result.errors.length).toBe(1)
        expect(syncStatus.get().errorCount).toBe(1)
        // 未确认项仍保留在队列且 retryCount 自增（markFailed 语义不变）
        const dirty = await syncTracker.listDirty()
        expect(dirty.length).toBe(2)
        expect(dirty.every((item) => item.retryCount === 1)).toBe(true)
    })

    it('C-11：成功运行推进 lastSyncAt 且 counts 在运行结束时刷新', async () => {
        const service = new SyncService(
            mockRequester(() => ({ data: { data: {} }, serverTime: Date.now() }))
        )
        const before = syncStatus.get().lastSyncAt
        const result = await service.start()
        expect(result.ok).toBe(true)
        expect(result.lastError).toBeNull()
        expect(result.phase).toBeNull()
        const after = syncStatus.get().lastSyncAt
        expect(after).toBeTruthy()
        expect(after).not.toBe(before)
    })
})