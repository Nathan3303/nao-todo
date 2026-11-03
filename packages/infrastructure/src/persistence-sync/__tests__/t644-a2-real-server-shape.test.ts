// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { appendConflict, loadConflictJournal, resolveConflictKeepServer } from '../conflict-journal'

/**
 * T644 / `A2` 跨仓**真形状**回归（红基线）—— 「保留服务端」必须能吃服务端真实 `serverCurrent`
 *
 * 发现来源：`T644` 轮次 2 跨仓核（服务端 `feat/320-sync-delete-occ` @ `fe273fc`）。
 * 本文件的 `serverCurrent` 样例来自服务端 **真实 HTTP 响应**（`go run` 直接调用
 * `interfaces/controllers.SyncController.Push` 序列化输出），**不是** mock：
 * - upsert `stale`：`remindWeekdays: null`、`tags: []`、`remindAt/remindRepeat/remindTime/deletedAt: ""`
 * - 删除 `stale`：`remindWeekdays: null`、`tags: null`
 *
 * 缺陷（现状**红**）：`resolveConflictKeepServer` 把 `serverCurrent` **直接**喂给
 * `config.entityToRecord`（跳过 `config.resToEntity` 归一），而 `taskEntityToRecord` 对
 * `tags` / `remindWeekdays` 做 `[...]` 展开 ⇒ `null` 触发 `TypeError: not iterable`，
 * 且该调用**不在** try/catch 内 ⇒ 点「保留服务端」直接抛异常（服务端有该行时 100% 复现）。
 *
 * 期望（AC2 / R-E）：不抛错；本地行 = 服务端行（经与 pull 同一套 `resToEntity` 归一）；
 * base = `serverUpdatedAt`；journal 条目清除。
 */

const USER_ID = 't644-a2-real-shape'
type RawRecord = Record<string, unknown>

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
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t644-a2-real')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
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

const seedStaleEntry = async (id: string, serverCurrent: RawRecord): Promise<void> => {
    await appendConflict(USER_ID, {
        kind: 'stale',
        table: 'tasks',
        entityId: id,
        loser: { id, name: '本地被拒名' },
        winnerUpdatedAt: String(serverCurrent.updatedAt),
        loserUpdatedAt: '2026-11-03T09:00:00.000Z',
        serverCurrent
    } as never)
}

/** 服务端真实 upsert `stale` 回执的 `serverCurrent`（go run 实测；`remindWeekdays: null`） */
const REAL_UPSERT_STALE: RawRecord = {
    archivedAt: '',
    checkItemCount: 0,
    commentCount: 0,
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
    subtaskCount: 0,
    tags: [],
    updatedAt: '2026-11-03T10:00:00.123Z'
}

/** 服务端真实「删除 stale」回执的 `serverCurrent`（`tags: null` + `remindWeekdays: null`） */
const REAL_DELETE_STALE: RawRecord = {
    archivedAt: '',
    checkItemCount: 0,
    commentCount: 0,
    createdAt: '2026-11-03T09:00:00Z',
    deletedAt: '',
    description: '',
    endAt: '',
    givenUpAt: '',
    id: '9001',
    name: '还活着',
    parentTaskId: '',
    priority: '',
    projectId: '',
    remindAt: '',
    remindRepeat: '',
    remindTime: '',
    remindWeekdays: null,
    sortId: 0,
    starMarkAt: '',
    startAt: '',
    state: '',
    subtaskCount: 0,
    tags: null,
    updatedAt: '2026-11-03T10:00:00.456Z'
}

describe('T644 / A2 真服务端形状（serverCurrent 含 null 数组）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('upsert stale 真样例行 ⇒ 不抛错 + 写回云端内容 + base + 清条目（现状：TypeError）', async () => {
        const id = await makeTask('本地名')
        await seedStaleEntry(id, { ...REAL_UPSERT_STALE, id })

        // 现状红：throws TypeError: entity.remindWeekdays is not iterable
        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)
        expect(result.ok).toBe(true)

        const [entity, err] = await newLocalTaskRepository().get(id)
        expect(err).toBeNull()
        const task = entity as {
            name: string
            remindWeekdays: unknown
            remindRepeat: string
            remindAt: unknown
            deletedAt: unknown
            tags: unknown
        }
        expect(task.name).toBe('云端名称')
        // 与 pull 同一套 `resToEntity` 归一：null 数组 ⇒ []、空串提醒 ⇒ 'none'/''
        expect(Array.isArray(task.remindWeekdays)).toBe(true)
        expect(task.remindRepeat).toBe('none')
        expect(task.deletedAt).toBeNull()
        expect(Array.isArray(task.tags)).toBe(true)
        const raw = (await localDatabase.tasks.get(id)) as unknown as RawRecord
        expect(raw.syncedServerUpdatedAt).toBe('2026-11-03T10:00:00.123Z')
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })

    it('删除 stale 真样例行（tags: null）⇒ 不抛错 + 不复活墓碑 + 清条目（现状：TypeError）', async () => {
        const id = await makeTask('本地名')
        await seedStaleEntry(id, { ...REAL_DELETE_STALE, id })

        // 现状红：throws TypeError: entity.tags is not iterable
        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)
        expect(result.ok).toBe(true)

        const [entity, err] = await newLocalTaskRepository().get(id)
        expect(err).toBeNull()
        expect((entity as { name: string }).name).toBe('还活着')
        // 服务端该行未删除（deletedAt 空串）⇒ 本地不得落成墓碑
        expect((entity as { deletedAt: unknown }).deletedAt).toBeNull()
        const raw = (await localDatabase.tasks.get(id)) as unknown as RawRecord
        expect(raw.syncedServerUpdatedAt).toBe('2026-11-03T10:00:00.456Z')
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })
})