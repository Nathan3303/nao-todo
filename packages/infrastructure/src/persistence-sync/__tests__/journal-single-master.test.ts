// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { localDatabase } from '../../persistence-local/db/local-database'
import { appendConflict, conflictJournalId, loadConflictJournal } from '../conflict-journal'

/**
 * T166b —— journal 专用锁（跨路径互斥，ADR §9.3）
 *
 * pull 的 remote-wins 与 push 的 stale/noop/... 均经 `appendConflict` **单一入口** ⇒
 * 用 `nao-todo:journal:<uid>` 包裹其 `meta` 单记录 RMW ⇒ **跨路径写入串行**（不丢条目）。
 *
 * 断言（确定性，非赌竞态）：
 * ① 并发「pull 写 remote-wins」+「push 写 stale」⇒ journal 有**两条**条目；
 * ② journal 锁被取 **两次**（锁名按 userId 隔离）；
 * ③ 每次 journal `meta.put` 落库瞬间**持 journal 锁**（RMW 在临界区内）；
 * ④ 两段 RMW **不交错**（串行化）。
 */

const USER_ID = 'journal-lock-user'
const JOURNAL_LOCK = `nao-todo:journal:${USER_ID}`

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

describe('T166b：journal 专用锁（跨路径互斥）', () => {
    beforeEach(async () => {
        await localDatabase.meta.clear()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('并发 pull(remote-wins) + push(stale) ⇒ 两条条目均在，且 RMW 在 journal 锁内串行', async () => {
        const lock = makeLockManager()
        vi.stubGlobal('navigator', { locks: { request: lock.request } })

        // 记录 journal `meta` RMW 的交错顺序 + put 落库瞬间是否持锁
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

        // ④ 两段 RMW 串行（无交错）；须在 `loadConflictJournal` 之前断言（其后会再触发一次 get）
        expect(lock.rmwOrder).toEqual([
            `acquire:${JOURNAL_LOCK}`,
            'get',
            'put',
            `release:${JOURNAL_LOCK}`,
            `acquire:${JOURNAL_LOCK}`,
            'get',
            'put',
            `release:${JOURNAL_LOCK}`
        ])

        // ② journal 锁被取两次（锁名按 userId 隔离）
        expect(lock.request.mock.calls.filter((call) => call[0] === JOURNAL_LOCK)).toHaveLength(2)

        // ③ 每次 journal put 均在持锁时发生
        expect(lock.journalPutUnderLock).toEqual([true, true])

        // ① 两条条目均在（不丢）
        const entries = await loadConflictJournal(USER_ID)
        expect(entries.map((entry) => entry.kind).sort()).toEqual(['remote-wins', 'stale'])
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