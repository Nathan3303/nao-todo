// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { loadConflictJournal } from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * T641 / `A3`（`F-03`）用例先行（红基线）—— **`conflict` / `skipped` 也必须留败方内容**
 *
 * 契约真源：PRD AC3 / §五 R-B（「没有内容的记录 = 没做」）· `R-H` 实施约束
 *          （快照 = diff 子集 + **文本截断 ≤512 字符 + `truncated` 标记**，禁整行复制）
 *          · `T640` Q6（`conflict`/`skipped` 的 `loser` 非空；「重生成 ID」拆 `A3b`，本文件不覆盖）。
 *
 * 覆盖（现状**红**）：
 * ① push 回执 `conflict`（ID 碰撞）⇒ journal `loser` **非空**，含本地被拒内容（字段子集）；
 * ② push 回执 `skipped`（服务端忽略）⇒ 同上；
 * ③ 截断口径：>512 字符文本字段 ⇒ 存储值 ≤512 字符且**带截断标记**；短文本原样保留。
 *
 * 红基线原因（现状）：`sync-service` 的 `withSnapshot = outcome === 'noop' || outcome === 'stale'`
 * ⇒ `conflict` / `skipped` 的 `loser` 恒 `{}`（静默：看不出来自己改了什么）。
 *
 * ⚠️ 形状说明（**待实现确认**）：截断标记本用例兼容 `entry.truncated === true` 与
 *    `entry.truncatedFields: string[]` 两种候选（评审只规定「带 `truncated` 标记」，未定层级）。
 */

const USER_ID = 't641-a3-user'
const SERVER_NEWER = '2029-06-01T00:00:00.000Z'

type RawRecord = Record<string, unknown>

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

const mockRequester = (handler: (url: string, body: unknown) => unknown): Requester =>
    ({
        post: async (url: string, body: unknown) => ({ data: handler(url, body) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

const pullEnvelope = () => ({
    code: 90020,
    message: 'ok',
    data: { data: EMPTY_PULL_DATA, serverTime: String(Date.now()) }
})

const pushEnvelope = (results: unknown[]) => ({
    code: 90010,
    message: 'ok',
    data: { results, serverTime: String(Date.now()) }
})

const taskVO = (name: string, description = ''): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        name,
        description,
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
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t641-a3')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

const makeTask = async (name: string, description = ''): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, err] = await repo.create(taskVO(name, description))
    expect(err).toBeNull()
    return (task as { id: string }).id
}

/** 以指定 outcome 推一次，返回该实体的 journal 条目 */
const pushWithOutcome = async (id: string, outcome: 'conflict' | 'skipped') => {
    const service = new SyncService(
        mockRequester((url) =>
            url === '/sync/push'
                ? pushEnvelope([{ table: 'tasks', id, outcome, serverUpdatedAt: SERVER_NEWER }])
                : pullEnvelope()
        )
    )
    await service.pushAll()
    const entries = await loadConflictJournal(USER_ID)
    expect(entries).toHaveLength(1)
    return entries[0]!
}

/** 截断标记（候选形状兼容；**形状待实现确认**） */
const hasTruncationMarker = (entry: unknown): boolean => {
    const extended = entry as { truncated?: unknown; truncatedFields?: unknown }
    if (extended.truncated === true) return true
    return Array.isArray(extended.truncatedFields) && extended.truncatedFields.length > 0
}

describe.each(['conflict', 'skipped'] as const)('T641 / A3 %s 留败方内容', (outcome) => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it(`AC3 push ${outcome} ⇒ loser 非空且含本地被拒内容（字段子集，非整行）`, async () => {
        const id = await makeTask('被拒的任务名', '被拒的描述')

        const entry = await pushWithOutcome(id, outcome)

        // 现状红：loser = {}
        const loser = entry.loser as RawRecord
        expect(Object.keys(loser).length).toBeGreaterThan(0)
        expect(String(entry.kind)).toBe(outcome)
        expect(loser.id).toBe(id)
        expect(loser.name).toBe('被拒的任务名')
        expect(loser.description).toBe('被拒的描述')
        // 字段子集：不得把本地**记录层**字段（userId / base）整行复制进快照
        expect(Object.keys(loser)).not.toContain('userId')
        expect(Object.keys(loser)).not.toContain('syncedServerUpdatedAt')
        expect(Object.keys(loser)).not.toContain('revision')
        // 败方时间 / 胜方时间可见
        expect(entry.loserUpdatedAt).toBeTruthy()
        expect(entry.winnerUpdatedAt).toBe(SERVER_NEWER)
    })
})

describe('T641 / A3 截断口径（>512 字符）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC3 超长文本 ⇒ 存储值 ≤512 字符且带截断标记（内容保留前缀，不整段丢失）', async () => {
        const longDescription = '标'.repeat(600)
        const id = await makeTask('长描述任务', longDescription)

        const entry = await pushWithOutcome(id, 'conflict')

        const stored = (entry.loser as RawRecord).description
        expect(typeof stored).toBe('string')
        expect((stored as string).length).toBeGreaterThan(0)
        expect((stored as string).length).toBeLessThanOrEqual(512)
        // 截断不得改变内容前缀（用户仍能认出自己的修改）
        expect(longDescription.startsWith(stored as string)).toBe(true)
        // 必须**明确标注**已截断（R-H）
        expect(
            hasTruncationMarker(entry),
            'R-H 要求截断文本带 truncated 标记（形状待实现确认）'
        ).toBe(true)
    })

    it('AC3 ≤512 字符 ⇒ 原样保留，不标截断', async () => {
        const description = '短'.repeat(512)
        const id = await makeTask('短描述任务', description)

        const entry = await pushWithOutcome(id, 'skipped')

        expect((entry.loser as RawRecord).description).toBe(description)
        expect(hasTruncationMarker(entry)).toBe(false)
    })
})