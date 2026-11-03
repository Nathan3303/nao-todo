// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { loadConflictJournal } from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T644 / `F-09`（`D7` 已批同批）用例先行（**红基线**）——
 * **伪 `stale` 不得污染冲突日志**：回执 `serverCurrent` 与本次推送载荷逐字段相等 ⇒ 判 `applied`
 *
 * 契约真源：`T640` **Q2**（伪 stale 消噪：`stale/noop` 回执带服务端当前行，逐字段相等 ⇒ `applied`，
 *          写回 base、不落账）· PRD §五 R-B（不得静默）/ NFR 可观测（不得用噪声挤占真冲突）。
 *
 * 覆盖（现状**红**）：
 * ① **伪 stale**：服务端回 `stale` + `serverCurrent`，但业务字段与本次推送**完全相同**
 *    （仅服务端哨兵差异：`deletedAt/remindAt/remindTime/remindRepeat: ''`、`remindWeekdays: null`、
 *    `updatedAt` 前进）⇒ 应按已生效处理：**写回 base、出队、不落账**，冲突计数不增；
 * ② **真 stale**（现绿护栏）：`serverCurrent` 与载荷不等 ⇒ 仍落账（kind=stale、loser 含本地内容）。
 *
 * 哨兵来源：服务端真实 `serverCurrent` JSON（`feat/320-sync-delete-occ` @ `fe273fc`，go run 实测）。
 *
 * 现状红原因：push 回执分支只按 `outcome` 走（`stale` 一律 `appendConflict`），**无判等**。
 */

const USER_ID = 't644-f09-user'
const NEWER = '2029-06-01T00:00:00.000Z'

type RawRecord = Record<string, unknown>

const EMPTY_PULL_DATA = {
    tasks: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    projects: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    tags: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    taskCheckItems: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    taskComments: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    pomodoros: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    pomodoroRecords: { items: [], total: 0, nextCursor: '', nextCursorId: '' }
}

const pullEnvelope = () => ({
    code: 90020,
    message: 'ok',
    data: { data: EMPTY_PULL_DATA, serverTime: String(Date.now()) }
})

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
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t644-f09')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

const makeTask = async (name: string): Promise<string> => {
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
            'p-1',
            [],
            null,
            'none',
            null,
            []
        )
    )
    expect(err).toBeNull()
    return (task as { id: string }).id
}

const rawTaskOf = async (id: string): Promise<RawRecord | undefined> =>
    (await localDatabase.tasks.get(id)) as unknown as RawRecord | undefined

/**
 * 由本次推送载荷造「服务端当前行」（sync 条目形状）：
 * 业务字段与载荷**逐字段相同**，只把客户端载荷的 `null`/`none` 换成服务端真实哨兵。
 */
const serverCurrentFromPayload = (payload: RawRecord, over: Partial<RawRecord> = {}): RawRecord => {
    const { baseUpdatedAt: _base, ...rest } = payload
    return {
        ...rest,
        // 服务端真实哨兵（见文件头：go run 实测）
        deletedAt: rest.deletedAt == null ? '' : rest.deletedAt,
        remindAt: rest.remindAt == null ? '' : rest.remindAt,
        remindTime: rest.remindTime == null ? '' : rest.remindTime,
        remindRepeat: rest.remindRepeat === 'none' ? '' : rest.remindRepeat,
        remindWeekdays: rest.remindWeekdays == null ? null : rest.remindWeekdays,
        updatedAt: NEWER,
        ...over
    }
}

/** 推一次；`serverCurrent` 由回执时的**实际载荷**派生（伪 stale 判等的真实场景） */
const pushOnce = async (
    id: string,
    build: (payload: RawRecord) => { serverCurrent: RawRecord; outcome: string }
): Promise<RawRecord> => {
    const post = vi.fn(async (url: string, body: unknown) => {
        if (url !== '/sync/push') return { data: pullEnvelope() }
        const payload = ((body as { tasks?: RawRecord[] }).tasks ?? [])[0]!
        const { serverCurrent, outcome } = build(payload)
        return {
            data: {
                code: 90010,
                message: 'ok',
                data: {
                    results: [
                        { table: 'tasks', id, outcome, serverUpdatedAt: NEWER, serverCurrent }
                    ],
                    serverTime: String(Date.now())
                }
            }
        }
    })
    await new SyncService({
        post,
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester).pushAll()
    return post.mock.calls.find((call) => call[0] === '/sync/push')?.[1] as RawRecord
}

describe('T644 / F-09 伪 stale 判等', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('伪 stale（serverCurrent 与载荷业务字段相等）⇒ 判 applied：写回 base + 出队 + 不落账', async () => {
        const id = await makeTask('内容没变的本地任务')

        await pushOnce(id, (payload) => ({
            outcome: 'stale',
            serverCurrent: serverCurrentFromPayload(payload)
        }))

        // 现状红：一律落账（1 条 stale）
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
        expect(syncStatus.get().conflictCount).toBe(0)
        // 判 applied 的副作用与真 applied 一致：base 写回 + 出队
        expect((await rawTaskOf(id))?.syncedServerUpdatedAt).toBe(NEWER)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
    })

    it('真 stale（serverCurrent 与载荷不等）⇒ 仍落账，loser 含本地内容 —— 现绿护栏', async () => {
        const id = await makeTask('本地被覆盖名')

        await pushOnce(id, (payload) => ({
            outcome: 'stale',
            serverCurrent: serverCurrentFromPayload(payload, { name: '云端另一个名字' })
        }))

        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(1)
        expect(String(entries[0]!.kind)).toBe('stale')
        expect((entries[0]!.loser as RawRecord).name).toBe('本地被覆盖名')
        expect(entries[0]!.winnerUpdatedAt).toBe(NEWER)
        expect(syncStatus.get().conflictCount).toBe(1)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
    })
})