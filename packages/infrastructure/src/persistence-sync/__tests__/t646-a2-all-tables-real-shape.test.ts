// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { taskCommentEntityToRecord } from '../../persistence-local/converters/task'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { appendConflict, loadConflictJournal, resolveConflictKeepServer } from '../conflict-journal'

/**
 * T646 / `DEF-132` 终验 —— **7 表逐一**用服务端**真 JSON** 驱动「保留服务端」写回
 *
 * 样例来源：服务端 `feat/320-sync-delete-occ` @ `fe273fc`，`go run` 直接调
 * `controllers.SyncController.Push`（7 表各返一条 `outcome=stale` + `serverCurrent`）序列化输出。
 * 覆盖三种真实空值形态：`remindWeekdays/tags/attachments: null` · `''` 空串哨兵 · 空数组 `[]`。
 *
 * 目的：锁定「写回必须走 pull 同一套 `resToEntity` 归一链」（DEF-132 回归），并逐表证明不抛错、
 * 落库内容正确、base 写回、条目清除。
 */

const USER_ID = 't646-all-tables'
const UPDATED_AT = '2026-11-03T10:00:00.123Z'

type RawRecord = Record<string, unknown>

const resetLocalState = async (): Promise<void> => {
    for (const table of [
        localDatabase.projects,
        localDatabase.projectPreferences,
        localDatabase.tags,
        localDatabase.tagPreferences,
        localDatabase.tasks,
        localDatabase.taskCheckItems,
        localDatabase.taskComments,
        localDatabase.pomodoros,
        localDatabase.pomodoroRecords,
        localDatabase.users,
        localDatabase.userConfigs,
        localDatabase.meta,
        localDatabase.deletionSchedules,
        localDatabase.syncQueue,
        localDatabase.syncCursor
    ]) {
        await table.clear()
    }
    localStorage.clear()
    cryptoService.lock()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t646-all')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

interface Fixture {
    table: string
    id: string
    rawTable: { get: (id: string) => Promise<RawRecord | undefined> }
    serverCurrent: RawRecord
    checks: (record: RawRecord) => void
}

/** 真 JSON（服务端 2026-11-03 实测；见文件头） */
const FIXTURES: Fixture[] = [
    {
        table: 'tasks',
        id: '9001',
        rawTable: localDatabase.tasks as never,
        serverCurrent: {
            archivedAt: '',
            checkItemCount: 2,
            commentCount: 1,
            createdAt: '2026-11-03T09:00:00Z',
            deletedAt: '',
            description: 'd',
            endAt: '',
            givenUpAt: '',
            id: '9001',
            name: '云端名称',
            parentTaskId: '',
            priority: 'medium',
            projectId: '',
            remindAt: '',
            remindRepeat: '',
            remindTime: '',
            remindWeekdays: null,
            sortId: 256,
            starMarkAt: '',
            startAt: '',
            state: 'pending',
            subtaskCount: 3,
            tags: ['t1'],
            updatedAt: UPDATED_AT
        },
        checks: (record) => {
            expect(record.name).not.toBeUndefined()
            expect(record.remindWeekdays).toEqual([])
            expect(record.tags).toEqual(['t1'])
            // 与 pull 落库同口径：服务端空串哨兵原样存库，读边界（recordToEntity）归一为 null
            expect(record.deletedAt).toBe('')
        }
    },
    {
        table: 'taskCheckItems',
        id: '9002',
        rawTable: localDatabase.taskCheckItems as never,
        serverCurrent: {
            createdAt: '2026-11-03T09:00:00Z',
            deletedAt: '',
            description: '',
            id: '9002',
            isDone: true,
            name: '检查项',
            sortId: 1,
            taskId: '9001',
            updatedAt: UPDATED_AT
        },
        checks: (record) => {
            expect(record.isDone).toBe(true)
            expect(record.taskId).toBe('9001')
        }
    },
    {
        table: 'taskComments',
        id: '9003',
        rawTable: localDatabase.taskComments as never,
        serverCurrent: {
            attachments: null,
            avatar: 'a',
            content: '云端评论',
            createdAt: '2026-11-03T09:00:00Z',
            deletedAt: '',
            id: '9003',
            isTopUp: false,
            nickname: 'n',
            taskId: '9001',
            updatedAt: UPDATED_AT
        },
        checks: (record) => {
            expect(record.attachments).toEqual([])
            expect(record.taskId).toBe('9001')
        }
    },
    {
        table: 'projects',
        id: '9004',
        rawTable: localDatabase.projects as never,
        serverCurrent: {
            archivedAt: '',
            createdAt: '2026-11-03T09:00:00Z',
            deactivedAt: '',
            deletedAt: '',
            description: '',
            id: '9004',
            name: '云端清单',
            sortId: 2,
            taskCount: 5,
            updatedAt: UPDATED_AT
        },
        checks: (record) => {
            expect(record.sortId).toBe(2)
            expect(record.taskCount).toBe(5)
            expect(record.icon).not.toBeUndefined()
        }
    },
    {
        table: 'tags',
        id: '9005',
        rawTable: localDatabase.tags as never,
        serverCurrent: {
            color: '#123456',
            createdAt: '2026-11-03T09:00:00Z',
            deletedAt: '',
            description: '',
            id: '9005',
            name: '云端标签',
            sortId: 3,
            updatedAt: UPDATED_AT
        },
        checks: (record) => {
            expect(record.color).toBe('#123456')
            expect(record.sortId).toBe(3)
            expect(record.icon).not.toBeUndefined()
        }
    },
    {
        table: 'pomodoros',
        id: '9006',
        rawTable: localDatabase.pomodoros as never,
        serverCurrent: {
            archivedAt: '',
            createdAt: '2026-11-03T09:00:00Z',
            deletedAt: '',
            description: '',
            duration: 1500,
            id: '9006',
            name: '云端专注',
            totalDuration: 9000,
            type: 0,
            updatedAt: UPDATED_AT
        },
        checks: (record) => {
            expect(record.totalDuration).toBe(9000)
            expect(record.duration).toBe(1500)
        }
    },
    {
        table: 'pomodoroRecords',
        id: '9007',
        rawTable: localDatabase.pomodoroRecords as never,
        serverCurrent: {
            createdAt: '2026-11-03T09:00:00Z',
            deletedAt: '',
            description: '',
            duration: 1500,
            endAt: '',
            id: '9007',
            note: 'n',
            pomodoroId: '9006',
            sessionId: 's1',
            startAt: '',
            taskId: '',
            taskName: '',
            type: 1,
            updatedAt: UPDATED_AT
        },
        checks: (record) => {
            expect(record.sessionId).toBe('s1')
            expect(record.duration).toBe(1500)
        }
    }
]

describe('T646 / A2 7 表逐一用服务端真 JSON 写回', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it.each(FIXTURES.map((fixture) => [fixture.table, fixture] as const))(
        '%s：不抛错 + 落库 + base 写回 + 条目清除',
        async (_table, fixture) => {
            const { table, id, serverCurrent } = fixture
            await appendConflict(USER_ID, {
                kind: 'stale',
                table,
                entityId: id,
                loser: { id },
                winnerUpdatedAt: UPDATED_AT,
                loserUpdatedAt: '2026-11-03T09:00:00.000Z',
                serverCurrent
            } as never)

            const result = await resolveConflictKeepServer(USER_ID, table, id)
            expect(result.ok).toBe(true)

            const record = (await fixture.rawTable.get(id)) as RawRecord | undefined
            expect(record).toBeTruthy()
            expect(record?.syncedServerUpdatedAt).toBe(UPDATED_AT)
            fixture.checks(record!)
            expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
        }
    )

    it('转换器边界：attachments 为 null 也不抛错（防其它入口直喂实体快照）', async () => {
        const record = await taskCommentEntityToRecord(
            {
                id: 'c-null',
                taskId: 't-1',
                content: 'x',
                attachments: null,
                isTopUp: false,
                avatar: '',
                nickname: '',
                createdAt: '2026-11-03T09:00:00Z',
                updatedAt: UPDATED_AT,
                deletedAt: null
            } as never,
            USER_ID
        )
        expect(record.attachments).toEqual([])
    })
})