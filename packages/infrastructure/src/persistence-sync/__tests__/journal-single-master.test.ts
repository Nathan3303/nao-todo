// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import {
    appendConflict,
    conflictJournalId,
    loadConflictJournal,
    resolveConflictKeepServer,
    resolveConflictRetryLocal
} from '../conflict-journal'

/**
 * T166b / T166c —— journal 专用锁（跨路径互斥，ADR §9.3）
 *
 * pull 的 remote-wins、push 的 stale/noop/...、以及**恢复动作 A/B** 均对同一 `meta` 单记录做 RMW ⇒
 * 全部经 `nao-todo:journal:<uid>` 串行（锁序 `pull/push 锁 → journal 锁`，journal 恒最内层）。
 *
 * 断言（确定性，非赌竞态）：
 * ① 并发 pull(remote-wins) + push(stale) ⇒ journal **两条**条目均在；RMW **无交错**；每次 put 持锁；
 * ② 并发 resolve 动作 A/B + appendConflict ⇒ **不丢条目**；RMW **无交错**；每次 put 持锁；
 * ③ 无 `navigator.locks` ⇒ 降级直接执行（退化为现状，不失败）。
 */

const USER_ID = 'journal-lock-user'
const JOURNAL_LOCK = `nao-todo:journal:${USER_ID}`
const SERVER_BASE = '2026-01-05T00:00:00.000Z'

/** 串行锁管理器：模拟 `navigator.locks.request` 的**等待**语义（非 `ifAvailable`） */
const makeLockManager = () => {
    const tails = new Map<string, Promise<unknown>>()
    const held = new Set<string>()
    const journalPutUnderLock: boolean[] = []
    const rmwOrder: string[] = []
    const request = vi.fn(async (name: string, a: unknown, b?: unknown): Promise<unknown> => {
        const callback = (typeof a === 'function' ? a : b) as (lock: unknown) => Promise<unknown>
        const prev = tails.get(name) ?? Promise.resolve()
        let release!: () => void
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        tails.set(
            name,
            prev.then(() => gate)
        )
        await prev
        held.add(name)
        rmwOrder.push(`acquire:${name}`)
        try {
            return await callback({ name })
        } finally {
            rmwOrder.push(`release:${name}`)
            held.delete(name)
            release()
        }
    })
    return { request, held, journalPutUnderLock, rmwOrder }
}

/** 记录 journal `meta` RMW 的交错顺序 + put 落库瞬间是否持锁 */
const spyJournalMeta = (lock: ReturnType<typeof makeLockManager>): void => {
    const originalGet = localDatabase.meta.get.bind(localDatabase.meta)
    const originalPut = localDatabase.meta.put.bind(localDatabase.meta)
    vi.spyOn(localDatabase.meta, 'get').mockImplementation((async (key: unknown) => {
        if (key === conflictJournalId(USER_ID)) lock.rmwOrder.push('get')
        return originalGet(key as never)
    }) as never)
    vi.spyOn(localDatabase.meta, 'put').mockImplementation((async (
        record: unknown,
        ...rest: unknown[]
    ) => {
        if ((record as { conflictJournal?: unknown }).conflictJournal !== undefined) {
            lock.journalPutUnderLock.push(lock.held.has(JOURNAL_LOCK))
            lock.rmwOrder.push('put')
        }
        return originalPut(record as never, ...(rest as never[]))
    }) as never)
}

/** 清空一次「受控 RMW」记录（预置数据用完后调用） */
const resetRmwRecord = (lock: ReturnType<typeof makeLockManager>): void => {
    lock.rmwOrder.length = 0
    lock.journalPutUnderLock.length = 0
    lock.request.mockClear()
}

const SERIAL_RMW_ORDER = [
    `acquire:${JOURNAL_LOCK}`,
    'get',
    'put',
    `release:${JOURNAL_LOCK}`,
    `acquire:${JOURNAL_LOCK}`,
    'get',
    'put',
    `release:${JOURNAL_LOCK}`
]

const resetState = async (): Promise<void> => {
    await localDatabase.meta.clear()
    await localDatabase.tasks.clear()
    await localDatabase.syncQueue.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

/** 建一条本地任务（胜方/当前行），返回其 id */
const createLocalTask = async (name: string): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(
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

/** 读本地任务明文名（经仓储解密） */
const localTaskName = async (taskId: string): Promise<string | null> => {
    const [task] = await newLocalTaskRepository().get(taskId)
    return task === null ? null : (task as { name: string }).name
}

describe('T166b：journal 专用锁（跨路径互斥）', () => {
    beforeEach(async () => {
        await resetState()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('并发 pull(remote-wins) + push(stale) ⇒ 两条条目均在，且 RMW 在 journal 锁内串行', async () => {
        const lock = makeLockManager()
        vi.stubGlobal('navigator', { locks: { request: lock.request } })
        spyJournalMeta(lock)

        await Promise.all([
            appendConflict(USER_ID, {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: 'task-pull',
                loser: { id: 'task-pull', name: 'pull 败方' }
            }),
            appendConflict(USER_ID, {
                kind: 'stale',
                table: 'tasks',
                entityId: 'task-push',
                loser: { id: 'task-push', name: 'push 败方' }
            })
        ])

        // 两段 RMW 串行（无交错）；须在 `loadConflictJournal` 之前断言（其后会再触发一次 get）
        expect(lock.rmwOrder).toEqual(SERIAL_RMW_ORDER)
        expect(lock.request.mock.calls.filter((call) => call[0] === JOURNAL_LOCK)).toHaveLength(2)
        expect(lock.journalPutUnderLock).toEqual([true, true])
        const entries = await loadConflictJournal(USER_ID)
        expect(entries.map((entry) => entry.kind).sort()).toEqual(['remote-wins', 'stale'])
    })

    it('T166c 并发 resolve(动作 A 保留服务端) + appendConflict ⇒ 不丢条目，且 RMW 串行', async () => {
        const lock = makeLockManager()
        vi.stubGlobal('navigator', { locks: { request: lock.request } })
        spyJournalMeta(lock)

        await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'tasks',
            entityId: 'task-1',
            loser: { id: 'task-1' }
        })
        resetRmwRecord(lock)

        await Promise.all([
            appendConflict(USER_ID, {
                kind: 'stale',
                table: 'tasks',
                entityId: 'task-2',
                loser: { id: 'task-2' }
            }),
            resolveConflictKeepServer(USER_ID, 'tasks', 'task-1')
        ])

        expect(lock.rmwOrder).toEqual(SERIAL_RMW_ORDER)
        expect(lock.request.mock.calls.filter((call) => call[0] === JOURNAL_LOCK)).toHaveLength(2)
        expect(lock.journalPutUnderLock).toEqual([true, true])
        // 不丢：动作 A 删 task-1、append 加 task-2 ⇒ 最终仅 task-2
        const entries = await loadConflictJournal(USER_ID)
        expect(entries.map((entry) => entry.entityId)).toEqual(['task-2'])
    })

    it('T166c 并发 resolve(动作 B 重试) + appendConflict ⇒ 不丢条目，且 RMW 串行', async () => {
        const lock = makeLockManager()
        vi.stubGlobal('navigator', { locks: { request: lock.request } })
        spyJournalMeta(lock)

        const taskId = await createLocalTask('胜方名')
        const [task] = await newLocalTaskRepository().get(taskId)
        const current = { ...(task as unknown as Record<string, unknown>) }
        await localDatabase.tasks.update(taskId, { syncedServerUpdatedAt: SERVER_BASE })
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: taskId,
            loser: { ...current, name: '败方名' },
            winnerUpdatedAt: SERVER_BASE
        })
        resetRmwRecord(lock)

        await Promise.all([
            appendConflict(USER_ID, {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: 'task-2',
                loser: { id: 'task-2' }
            }),
            resolveConflictRetryLocal(USER_ID, 'tasks', taskId)
        ])

        expect(lock.rmwOrder).toEqual(SERIAL_RMW_ORDER)
        expect(lock.request.mock.calls.filter((call) => call[0] === JOURNAL_LOCK)).toHaveLength(2)
        expect(lock.journalPutUnderLock).toEqual([true, true])
        // 不丢：动作 B 删 taskId 条目、append 加 task-2 ⇒ 最终仅 task-2
        const entries = await loadConflictJournal(USER_ID)
        expect(entries.map((entry) => entry.entityId)).toEqual(['task-2'])
        // 动作 B 生效：败方写回本地
        expect(await localTaskName(taskId)).toBe('败方名')
    })

    it('无 navigator.locks ⇒ 降级直接执行（退化为现状，不失败）', async () => {
        vi.stubGlobal('navigator', {})
        const count = await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: 'task-1',
            loser: { id: 'task-1' }
        })
        expect(count).toBe(1)
        expect((await loadConflictJournal(USER_ID)).map((entry) => entry.kind)).toEqual(['stale'])
    })
})