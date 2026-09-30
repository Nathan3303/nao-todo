// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalProjectRepository } from '../../persistence-local/repos/project-repo-impl'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import {
    clearStructuredLog,
    readStructuredLog,
    STRUCTURED_LOG_EVENTS
} from '../../observability/structured-log'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T471 / DEF-44：`/sync/push` 回执 `droppedFields` 的**客户端消费**（出口 i + ii）。
 *
 * 覆盖（对齐裁定）：① 非白名单字段 ⇒ 有诊断且**仍正常出队**；② 仅白名单字段 ⇒ 零告警；
 * ③ 旧服务端（无该字段）⇒ 零告警不假红；④ 既有出队/冲突路径零回归。
 */

const USER_ID = 't471-user'
const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }
const EMPTY_PULL_DATA = {
    tasks: EMPTY_TABLE,
    projects: EMPTY_TABLE,
    tags: EMPTY_TABLE,
    taskCheckItems: EMPTY_TABLE,
    taskComments: EMPTY_TABLE,
    pomodoros: EMPTY_TABLE,
    pomodoroRecords: EMPTY_TABLE
}
type RawRecord = Record<string, unknown>

/** 真实服务端 pull 响应体 */
const pullEnvelope = (tables: Record<string, unknown> = {}, serverTime = Date.now()) => ({
    code: 90020,
    message: 'ok',
    data: { data: { ...EMPTY_PULL_DATA, ...tables }, serverTime: String(serverTime) }
})

/** 真实服务端 push 响应体 */
const pushEnvelope = (results: unknown[], serverTime = Date.now()) => ({
    code: 90010,
    message: 'ok',
    data: { results, serverTime: String(serverTime) }
})

/** 仅响应 `/sync/push`（其余走空 pull） */
const requesterForPush = (results: unknown[]): Requester =>
    ({
        post: async (url: string) =>
            url === '/sync/push' ? { data: pushEnvelope(results) } : { data: pullEnvelope() },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

const taskVO = (name: string): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        name,
        '',
        'todo',
        'medium',
        null,
        null,
        '',
        [],
        null,
        'none',
        null,
        []
    )

/** 本次运行产生的 dropped-fields 诊断日志 */
const droppedFieldLogs = () =>
    readStructuredLog().filter((e) => e.event === STRUCTURED_LOG_EVENTS.SYNC_PUSH_DROPPED_FIELDS)

const resetLocalState = async (): Promise<void> => {
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
    localStorage.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setDroppedFieldCount(0)
    clearStructuredLog()
}

/** 创建一条脏任务并返回其 id */
const seedDirtyTask = async (): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(taskVO('漂移用例任务'))
    expect(err).toBeNull()
    return (task as { id: string }).id
}

describe('T471 droppedFields 消费', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('① 非白名单字段 ⇒ 有诊断日志，且该条仍正常出队', async () => {
        const id = await seedDirtyTask()
        const service = new SyncService(
            requesterForPush([
                {
                    table: 'tasks',
                    id,
                    outcome: 'applied',
                    serverUpdatedAt: '2031-01-01T00:00:00.000Z',
                    droppedFields: ['someNewField']
                }
            ])
        )

        await service.pushAll()

        // 诊断（i）：事件级 + 字段级可见
        const logs = droppedFieldLogs()
        expect(logs).toHaveLength(1)
        expect(logs[0]!.level).toBe('warn')
        expect(logs[0]!.fields.fields).toEqual(['someNewField'])
        expect(logs[0]!.fields.rows).toBe(1)
        // 面板信息条目（ii）：聚合计数
        expect(syncStatus.get().droppedFieldCount).toBe(1)
        // ⛔ 不阻塞出队：仍正常出队
        expect(await syncTracker.countDirty()).toBe(0)
    })

    it('② 仅白名单字段（projects.icon / sortId）⇒ 零告警、计数归 0、正常出队', async () => {
        const [project, err] = await newLocalProjectRepository().create(
            new CreateProjectValueObject('白名单用例清单', 'more2', '')
        )
        expect(err).toBeNull()
        const id = (project as { id: string }).id
        const service = new SyncService(
            requesterForPush([
                {
                    table: 'projects',
                    id,
                    outcome: 'applied',
                    serverUpdatedAt: '2031-01-01T00:00:00.000Z',
                    droppedFields: ['icon', 'sortId']
                }
            ])
        )

        await service.pushAll()

        expect(droppedFieldLogs()).toHaveLength(0)
        expect(syncStatus.get().droppedFieldCount).toBe(0)
        expect(await syncTracker.countDirty()).toBe(0)
    })

    it('③ 旧服务端（回执不含 droppedFields）⇒ 零告警、不假红', async () => {
        const id = await seedDirtyTask()
        const service = new SyncService(
            requesterForPush([
                {
                    table: 'tasks',
                    id,
                    outcome: 'applied',
                    serverUpdatedAt: '2031-01-01T00:00:00.000Z'
                } as RawRecord
            ])
        )

        await service.pushAll()

        expect(droppedFieldLogs()).toHaveLength(0)
        expect(syncStatus.get().droppedFieldCount).toBe(0)
        expect(await syncTracker.countDirty()).toBe(0)
    })

    it('④ 回归：普通 applied（无 droppedFields）⇒ 出队且计数归 0', async () => {
        const id = await seedDirtyTask()
        const service = new SyncService(
            requesterForPush([
                {
                    table: 'tasks',
                    id,
                    outcome: 'applied',
                    serverUpdatedAt: '2031-01-01T00:00:00.000Z'
                } as RawRecord
            ])
        )

        await service.pushAll()

        expect(await syncTracker.countDirty()).toBe(0)
        expect(syncStatus.get().droppedFieldCount).toBe(0)
        expect(droppedFieldLogs()).toHaveLength(0)
    })

    it('⑤ 上一次有漂移、下一次无 ⇒ 覆盖式归 0（面板条目自行清除）', async () => {
        const id = await seedDirtyTask()
        await new SyncService(
            requesterForPush([
                {
                    table: 'tasks',
                    id,
                    outcome: 'applied',
                    serverUpdatedAt: '2031-01-01T00:00:00.000Z',
                    droppedFields: ['someNewField']
                } as RawRecord
            ])
        ).pushAll()
        expect(syncStatus.get().droppedFieldCount).toBe(1)

        const id2 = await seedDirtyTask()
        await new SyncService(
            requesterForPush([
                {
                    table: 'tasks',
                    id: id2,
                    outcome: 'applied',
                    serverUpdatedAt: '2031-01-02T00:00:00.000Z'
                } as RawRecord
            ])
        ).pushAll()
        expect(syncStatus.get().droppedFieldCount).toBe(0)
    })
})