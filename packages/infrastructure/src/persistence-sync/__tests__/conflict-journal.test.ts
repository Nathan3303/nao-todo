// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import {
    CONFLICT_JOURNAL_LIMIT,
    appendConflict,
    clearConflictJournal,
    conflictJournalId,
    countConflicts,
    loadConflictJournal
} from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'
import { syncTracker } from '../sync-tracker'

/**
 * T144 / PS-14 / DP-1 —— 冲突记账（含败方快照、有界）
 *
 * **验收**：① 落 `meta` 单记录 `${userId}:conflict-journal`（非索引字段，不 bump Dexie version）；
 * ② 记录**败方（被覆盖方）快照**；③ **有界**（超上限环形淘汰最旧）；④ pull 远端胜分支自动记账；
 * ⑤ 计数落定到状态面且不计入业务 `pendingCount`/`failedCount`。
 */

const USER_ID = 'conflict-user'
const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

const mockRequester = (handler: (url: string, body: unknown) => unknown): Requester =>
    ({
        post: async (url: string, body: unknown) => ({ data: handler(url, body) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

const setup = async (): Promise<void> => {
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
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

describe('T144 / PS-14 冲突记账 - 存储与有界', () => {
    beforeEach(async () => {
        await setup()
    })

    it('appendConflict 落 meta 单记录并保留败方快照', async () => {
        const count = await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'tasks',
            entityId: 't-1',
            loser: { id: 't-1', name: '本地被覆盖名' },
            winnerUpdatedAt: '2026-01-02T00:00:00.000Z',
            loserUpdatedAt: '2026-01-01T00:00:00.000Z'
        })
        expect(count).toBe(1)
        const record = await localDatabase.meta.get(conflictJournalId(USER_ID))
        expect(record?.conflictJournal).toHaveLength(1)
        const entries = await loadConflictJournal(USER_ID)
        expect(entries[0]).toMatchObject({
            kind: 'remote-wins',
            table: 'tasks',
            entityId: 't-1',
            loser: { id: 't-1', name: '本地被覆盖名' },
            winnerUpdatedAt: '2026-01-02T00:00:00.000Z',
            loserUpdatedAt: '2026-01-01T00:00:00.000Z'
        })
        expect(typeof entries[0]!.at).toBe('string')
    })

    it('有界：超过上限环形淘汰最旧（保留最新 N 条）', async () => {
        const total = CONFLICT_JOURNAL_LIMIT + 5
        for (let i = 0; i < total; i += 1) {
            await appendConflict(USER_ID, {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: `t-${i}`,
                loser: { id: `t-${i}` }
            })
        }
        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(CONFLICT_JOURNAL_LIMIT)
        expect(entries[0]!.entityId).toBe(`t-${total - CONFLICT_JOURNAL_LIMIT}`)
        expect(entries.at(-1)!.entityId).toBe(`t-${total - 1}`)
        expect(await countConflicts(USER_ID)).toBe(CONFLICT_JOURNAL_LIMIT)
    })

    it('空 userId 硬失败（C-55）：不写记录', async () => {
        expect(
            await appendConflict('', {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: 't',
                loser: {}
            })
        ).toBe(0)
        expect(await loadConflictJournal('')).toEqual([])
        expect(await countConflicts('')).toBe(0)
    })

    it('clearConflictJournal 清空记录', async () => {
        await appendConflict(USER_ID, {
            kind: 'push-noop',
            table: 'tasks',
            entityId: 't',
            loser: {}
        })
        await clearConflictJournal(USER_ID)
        expect(await loadConflictJournal(USER_ID)).toEqual([])
    })

    it('记账不写业务 syncQueue（不 markDirty）', async () => {
        await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'tasks',
            entityId: 't',
            loser: {}
        })
        expect(await localDatabase.syncQueue.count()).toBe(0)
    })
})

describe('T144 / PS-14 pull 远端胜 ⇒ 自动记账败方快照', () => {
    beforeEach(async () => {
        await setup()
    })

    it('远端较新覆盖本地未推修改：journal 记本地（败方）内容 + 队列出队 + 状态面计数', async () => {
        const repo = newLocalTaskRepository()
        const [task, taskErr] = await repo.create(
            new CreateTaskValueObject(
                null,
                null,
                '本地名',
                '',
                'todo',
                'medium',
                null,
                null,
                'p-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(taskErr).toBeNull()
        const taskId = (task as { id: string }).id
        await syncTracker.markDirty('tasks', taskId, 'upsert', '2025-01-01T00:00:00Z')

        const remoteTask = {
            id: taskId,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z', // 远端较新 ⇒ 远端胜
            deletedAt: null,
            parentTaskId: '',
            name: '远程名',
            description: '',
            state: 'todo',
            priority: 'medium',
            startAt: '',
            endAt: '',
            tags: [],
            projectId: 'p-1',
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
                                projects: EMPTY_TABLE,
                                tags: EMPTY_TABLE,
                                taskCheckItems: EMPTY_TABLE,
                                taskComments: EMPTY_TABLE,
                                pomodoros: EMPTY_TABLE,
                                pomodoroRecords: EMPTY_TABLE
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: { results: [] }, serverTime: Date.now() }
            })
        )
        await service.pullAll()

        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({
            kind: 'remote-wins',
            table: 'tasks',
            entityId: taskId,
            loserUpdatedAt: '2025-01-01T00:00:00Z',
            winnerUpdatedAt: '2026-01-02T00:00:00.000Z'
        })
        // 败方快照 = 被覆盖的本地内容（明文）
        expect((entries[0]!.loser as { name: string }).name).toBe('本地名')
        // 队列已出队 + 状态面计数可见且不计入业务计数
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        expect(syncStatus.get().conflictCount).toBe(1)
        expect(syncStatus.get().pendingCount).toBe(0)
    })

    it('restoreConflictCount：冷启动从磁盘恢复计数', async () => {
        await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'tasks',
            entityId: 't',
            loser: {}
        })
        syncStatus.setConflictCount(0)
        await new SyncService(mockRequester(() => ({ data: {} }))).restoreConflictCount()
        expect(syncStatus.get().conflictCount).toBe(1)
    })

    it('push 服务端 no-op（T143 outcome=noop）：journal 记本地（败方）内容 + 出队 + 计数', async () => {
        const repo = newLocalTaskRepository()
        const [task, taskErr] = await repo.create(
            new CreateTaskValueObject(
                null,
                null,
                '本地被拒名',
                '',
                'todo',
                'medium',
                null,
                null,
                'p-1',
                [],
                null,
                'none',
                null,
                []
            )
        )
        expect(taskErr).toBeNull()
        const taskId = (task as { id: string }).id
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/push') {
                    return {
                        data: {
                            results: [
                                {
                                    table: 'tasks',
                                    id: taskId,
                                    serverUpdatedAt: '2026-01-02T00:00:00.000Z',
                                    outcome: 'noop'
                                }
                            ]
                        },
                        serverTime: Date.now()
                    }
                }
                return { data: {} }
            })
        )
        await service.pushAll()

        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({
            kind: 'push-noop',
            table: 'tasks',
            entityId: taskId,
            winnerUpdatedAt: '2026-01-02T00:00:00.000Z'
        })
        expect((entries[0]!.loser as { name: string }).name).toBe('本地被拒名')
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        expect(syncStatus.get().conflictCount).toBe(1)
    })

    it('push outcome=applied / skipped ⇒ 不记 journal（仅 noop 记，不自判谁赢）', async () => {
        for (const outcome of ['applied', 'skipped']) {
            await setup()
            const repo = newLocalTaskRepository()
            const [task, taskErr] = await repo.create(
                new CreateTaskValueObject(
                    null,
                    null,
                    '本地名',
                    '',
                    'todo',
                    'medium',
                    null,
                    null,
                    'p-1',
                    [],
                    null,
                    'none',
                    null,
                    []
                )
            )
            expect(taskErr).toBeNull()
            const taskId = (task as { id: string }).id
            const service = new SyncService(
                mockRequester((url) => {
                    if (url === '/sync/push') {
                        return {
                            data: {
                                results: [
                                    {
                                        table: 'tasks',
                                        id: taskId,
                                        serverUpdatedAt: '2026-01-02T00:00:00.000Z',
                                        outcome
                                    }
                                ]
                            },
                            serverTime: Date.now()
                        }
                    }
                    return { data: {} }
                })
            )
            await service.pushAll()
            expect(await loadConflictJournal(USER_ID)).toEqual([])
            expect(syncStatus.get().conflictCount).toBe(0)
            expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        }
    })
})