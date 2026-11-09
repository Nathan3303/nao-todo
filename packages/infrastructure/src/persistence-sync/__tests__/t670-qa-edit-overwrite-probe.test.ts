import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import type { TaskUpdateOrigin } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { makeTaskVO, setup } from '../../persistence-local/__tests__/local-repos-test-helpers'
import {
    STRUCTURED_LOG_EVENTS,
    clearStructuredLog,
    readStructuredLog
} from '../../observability/structured-log'
import {
    appendConflict,
    conflictJournalId,
    loadConflictJournal,
    valuesEqual
} from '../conflict-journal'
import { pickChangedFields, pickOverwrittenFields } from '../edit-overwrite'
import { SYNC_COMPARE_IGNORED_FIELDS } from '../sync-normalize'

/**
 * T670 · QA 独立探针（DEF-146）—— **不复用 RD 用例的独立判据**
 *
 * 只读源码契约（PRD R-1…R-8 / AC1–AC9），从「三值判定的边界」重新推导：
 *   ① 部分载荷 / origin 缺键 / origin 缺省（undefined、null、{}）/ 载荷显式 undefined；
 *   ② 空哨兵归一口径（`''`/`null`/`undefined`/`[]`；**并实测 `'none'` 的边界事实**）；
 *   ③ 六类零误报 + AC1b；④ DEF-153 边界（非文本字段不记账且不误报）；
 *   ⑤ 记账时机（读库时保存已落盘）与失败语义（error 级日志 / 无业务值 / 无回滚）；
 *   ⑥ 共享 helper 与 A1 旧内联实现的等价面（含忽略集单一来源事实）。
 */

const USER_ID = 't670-qa-user'

const repo = () => newLocalTaskRepository()

const seed = async (name: string, description = ''): Promise<string> => {
    const [task, err] = await repo().create(makeTaskVO({ name, description }))
    expect(err).toBeNull()
    await localDatabase.syncQueue.clear()
    return task!.id
}

/** 模拟「远端修改已由自动刷新落库」（走本地写路径、清队列，不模拟 A1 记账） */
const remoteLanding = async (id: string, patch: Record<string, unknown>): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    Object.assign(vo, patch)
    const err = await repo().update(id, vo)
    expect(err).toBeNull()
    await localDatabase.syncQueue.clear()
}

const save = async (id: string, patch: Record<string, unknown>, origin?: TaskUpdateOrigin) => {
    const vo = new UpdateTaskValueObject(id)
    Object.assign(vo, patch)
    return repo().update(id, vo, origin)
}

const journal = () => loadConflictJournal(USER_ID)

const rowName = async (id: string): Promise<string> => {
    const record = await localDatabase.tasks.get(id)
    return cryptoService.decrypt(record!.name)
}

describe('T670 探针 A：三值判定边界（纯函数，独立推导）', () => {
    it('A1 部分载荷（只带 name）⇒ 只判 name，origin 里的 description 不参与', () => {
        // 云端 name 与 description 都被远端改过；本次只提交 name
        const cloud = { name: 'R-name', description: 'R-desc' }
        const payload = { name: 'L-name' }
        const origin = { name: 'O-name', description: 'O-desc' }
        expect(pickOverwrittenFields(cloud, payload, origin)).toEqual(['name'])
    })

    it('A2 origin 缺该键 ⇒ 不记（F = 载荷 ∩ 基准）', () => {
        const cloud = { name: 'R', description: 'R-d' }
        expect(pickOverwrittenFields(cloud, { name: 'L' }, { description: 'O-d' })).toEqual([])
    })

    it('A3 origin 缺省三态（undefined / null / 空对象）⇒ 恒空（R-6 零行为变化）', () => {
        const cloud = { name: 'R' }
        const payload = { name: 'L' }
        expect(pickOverwrittenFields(cloud, payload, undefined)).toEqual([])
        expect(pickOverwrittenFields(cloud, payload, null)).toEqual([])
        expect(pickOverwrittenFields(cloud, payload, {})).toEqual([])
    })

    it('A4 载荷显式携带 undefined ⇒ 视为「本次不触碰」不记', () => {
        const cloud = { name: 'R' }
        const payload = { name: undefined }
        expect(
            pickOverwrittenFields(cloud, payload as Record<string, unknown>, { name: 'O' })
        ).toEqual([])
    })

    it.each([
        ['null', 'undefined', null, undefined],
        ['null', '空串', null, ''],
        ['空串', '空数组', '', []],
        ['undefined', '空数组', undefined, []]
    ])('A5 空哨兵归一：R=%s / O=%s ⇒ 视为未变（不记）', (_a, _b, r, o) => {
        const cloud = { name: r }
        expect(pickOverwrittenFields(cloud, { name: '我的新值' }, { name: o })).toEqual([])
    })

    it('A6 边界事实：valuesEqual 不把 "none" 当归一空（本批不可达，登记口径）', () => {
        // 事实：valuesEqual 的空集 = null/undefined/''/[]；`'none'` 属另一套 `isEmptySyncSentinel`
        expect(valuesEqual('none', '')).toBe(false)
        expect(valuesEqual('none', null)).toBe(false)
        // 若把它当业务值比较，'none'→'' 会被判「不同」；本批编辑基准只送 name/description，
        //   remindRepeat 等字段在保存侧不可达（见 A8 / DEF-153）
        expect(
            pickOverwrittenFields(
                { remindRepeat: 'none' },
                { remindRepeat: '' },
                { remindRepeat: 'x' }
            )
        ).toEqual(['remindRepeat'])
    })

    it('A7 AC1b：改回原值但远端改过该字段 ⇒ 记 1 个字段（L=O≠R）', () => {
        const cloud = { name: 'd9' }
        expect(pickOverwrittenFields(cloud, { name: 'd0' }, { name: 'd0' })).toEqual(['name'])
    })

    it('A8 DEF-153 边界：编辑器形态 origin（只有 name/description）⇒ 非文本字段覆盖不记', () => {
        const cloud = { name: 'n0', priority: 'low', state: 'todo', tags: ['a'], sortId: 5 }
        const payload = { name: 'n0', priority: 'high', state: 'done', tags: ['b'], sortId: 9 }
        const editorOrigin = { name: 'n0', description: '' }
        // 编辑器只送 name/description ⇒ priority/state/tags/sortId 全部不参与（不记账、不误报）
        expect(pickOverwrittenFields(cloud, payload, editorOrigin)).toEqual([])
    })

    it('A9 六类零误报（纯函数层逐条）', () => {
        // ① 连改两次：第二次 O = 上次提交值 = R
        expect(pickOverwrittenFields({ name: 'v1' }, { name: 'v2' }, { name: 'v1' })).toEqual([])
        // ② 仅格式差异：R = O ⇒ 不记
        expect(pickOverwrittenFields({ name: 'a' }, { name: ' a' }, { name: 'a' })).toEqual([])
        // ③ 远端改的是别的字段
        expect(
            pickOverwrittenFields({ name: 'n0', description: 'd1' }, { name: 'n1' }, { name: 'n0' })
        ).toEqual([])
        // ④ 改回原值且远端未动该字段
        expect(pickOverwrittenFields({ name: 'x' }, { name: 'x' }, { name: 'x' })).toEqual([])
        // ⑤ 远端改完我才输入（基准已是新值）
        expect(pickOverwrittenFields({ name: 'new' }, { name: 'mine' }, { name: 'new' })).toEqual(
            []
        )
        // ⑥ 我保存的值 = 云端当前值
        expect(pickOverwrittenFields({ name: 'r' }, { name: 'r' }, { name: 'o' })).toEqual([])
    })
})

describe('T670 探针 B：仓储链路（部分载荷 / AC1b / AC4 / DEF-153）', () => {
    beforeEach(async () => {
        await setup(USER_ID)
        clearStructuredLog()
    })

    it('B1 部分载荷：远端改两字段、只提交 name ⇒ 1 条且快照只含 name', async () => {
        const id = await seed('o-name', 'o-desc')
        await remoteLanding(id, { name: 'R-name', description: 'R-desc' })

        expect(
            await save(id, { name: 'L-name' }, { name: 'o-name', description: 'o-desc' })
        ).toBeNull()

        const entries = await journal()
        expect(entries).toHaveLength(1)
        expect(Object.keys(entries[0]!.loser).sort()).toEqual(['id', 'name'])
        expect(entries[0]!.loser.name).toBe('R-name')
        expect(await rowName(id)).toBe('L-name')
    })

    it('B2 AC1b 仓储链路：改回原值但远端改过 ⇒ 1 条且 loser = 云端值', async () => {
        const id = await seed('d0')
        await remoteLanding(id, { name: 'd9' })

        expect(await save(id, { name: 'd0' }, { name: 'd0' })).toBeNull()

        const entries = await journal()
        expect(entries).toHaveLength(1)
        expect(entries[0]!.kind).toBe('pull-local-wins')
        expect(entries[0]!.loser.name).toBe('d9')
        expect(await rowName(id)).toBe('d0')
    })

    it('B3 AC4 无编辑基准（老调用方/移动端）⇒ 0 条', async () => {
        const id = await seed('o')
        await remoteLanding(id, { name: 'R' })

        expect(await save(id, { name: 'L' })).toBeNull()
        expect(await journal()).toHaveLength(0)
        expect(await rowName(id)).toBe('L')
    })

    it('B4 DEF-153：远端改优先级，编辑器形态基准 ⇒ 0 条（不误报）', async () => {
        const id = await seed('n0')
        await remoteLanding(id, { priority: 'low' })

        // 编辑器形态：载荷带 priority，但 origin 只有 name/description
        expect(await save(id, { priority: 'high' }, { name: 'n0', description: '' })).toBeNull()
        expect(await journal()).toHaveLength(0)
    })
})

describe('T670 探针 C：记账时机与失败语义', () => {
    beforeEach(async () => {
        await setup(USER_ID)
        clearStructuredLog()
    })

    it('C1 记账在保存事务之后：journal 写入时读到的任务行已是「我的版本」', async () => {
        const id = await seed('o')
        await remoteLanding(id, { name: '云端版本' })

        const observed: string[] = []
        const originalPut = localDatabase.meta.put.bind(localDatabase.meta)
        const putSpy = vi.spyOn(localDatabase.meta, 'put').mockImplementation((async (
            value: { id?: string },
            key?: string
        ): Promise<string> => {
            if (value?.id === conflictJournalId(USER_ID)) {
                // journal 写入这一刻：业务写入必须已提交（R-5）
                observed.push(await rowName(id))
            }
            return originalPut(value as never, key)
        }) as never)

        expect(await save(id, { name: '我的版本' }, { name: 'o' })).toBeNull()
        putSpy.mockRestore()

        expect(observed).toEqual(['我的版本'])
        expect(await journal()).toHaveLength(1)
        const row = await localDatabase.tasks.get(id)
        expect((await journal())[0]!.winnerUpdatedAt).toBe(row!.updatedAt)
    })

    it('C2 记账失败 ⇒ 保存成功、无回滚、error 级日志、字段仅标识且无业务值', async () => {
        const id = await seed('o')
        await remoteLanding(id, { name: '云端版本' })
        const queueBefore = await localDatabase.syncQueue.count()

        const putSpy = vi
            .spyOn(localDatabase.meta, 'put')
            .mockRejectedValueOnce(new Error('disk-quota-exceeded'))
        const err = await save(id, { name: '我的版本' }, { name: 'o' })
        putSpy.mockRestore()

        expect(err).toBeNull()
        expect(await rowName(id)).toBe('我的版本')
        // 保存路径照旧入队（记账失败不影响同步队列，非回滚）
        expect(await localDatabase.syncQueue.count()).toBe(queueBefore + 1)
        expect(await journal()).toHaveLength(0)

        const failed = readStructuredLog().filter(
            (entry) => entry.event === STRUCTURED_LOG_EVENTS.SYNC_JOURNAL_RECORD_FAILED
        )
        expect(failed).toHaveLength(1)
        expect(failed[0]!.level).toBe('error')
        expect(Object.keys(failed[0]!.fields).sort()).toEqual(['entityId', 'reason', 'table'])
        expect(failed[0]!.fields.entityId).toBe(id)
        expect(failed[0]!.fields.table).toBe('tasks')
        expect(String(failed[0]!.fields.reason)).toContain('disk-quota-exceeded')
        const serialized = JSON.stringify(readStructuredLog())
        expect(serialized).not.toContain('我的版本')
        expect(serialized).not.toContain('云端版本')
    })

    it('C3 失败后再次正常保存（远端又变了）⇒ 仍能记账（失败不粘滞）', async () => {
        const id = await seed('o')
        await remoteLanding(id, { name: 'R1' })

        const putSpy = vi
            .spyOn(localDatabase.meta, 'put')
            .mockRejectedValueOnce(new Error('one-shot'))
        expect(await save(id, { name: 'L1' }, { name: 'o' })).toBeNull()
        putSpy.mockRestore()
        expect(await journal()).toHaveLength(0)

        // 远端再次推进，用户再次保存（基准 = 上次提交值 L1）
        await remoteLanding(id, { name: 'R2' })
        expect(await save(id, { name: 'L2' }, { name: 'L1' })).toBeNull()
        expect(await journal()).toHaveLength(1)
        expect((await journal())[0]!.loser.name).toBe('R2')
    })
})

describe('T670 探针 D：共享 helper 的回归面（A1 等价 / 忽略集单一来源）', () => {
    it('D1 pickChangedFields 与 A1 旧内联实现（5 字段忽略集）在既有形态下逐例一致', () => {
        const legacy = (
            remote: Record<string, unknown>,
            local: Record<string, unknown>
        ): string[] => {
            const ignored = new Set([
                'id',
                'userId',
                'updatedAt',
                'syncedServerUpdatedAt',
                'revision'
            ])
            const fields: string[] = []
            for (const field of new Set([...Object.keys(remote), ...Object.keys(local)])) {
                if (ignored.has(field)) continue
                if (valuesEqual(remote[field], local[field])) continue
                fields.push(field)
            }
            return fields
        }

        const cases: Array<[Record<string, unknown>, Record<string, unknown>]> = [
            [
                { id: 't', name: 'a', updatedAt: 'x' },
                { id: 't', name: 'b' }
            ],
            [
                { id: 't', name: '', tags: [] },
                { id: 't', name: null, tags: [] }
            ],
            [
                { id: 't', description: 'd', revision: 2 },
                { id: 't', description: 'd' }
            ],
            [
                { id: 't', remindRepeat: 'none' },
                { id: 't', remindRepeat: '' }
            ]
        ]
        for (const [remote, local] of cases) {
            expect(pickChangedFields(remote, local)).toEqual(legacy(remote, local))
        }
    })

    it('D2 忽略集单一来源：默认集 = SYNC_COMPARE_IGNORED_FIELDS（含 baseUpdatedAt）', () => {
        // 默认忽略集就是 sync-normalize 的单一来源（无第二套）
        expect(pickChangedFields({ baseUpdatedAt: 'b1' }, { baseUpdatedAt: 'b2' })).toEqual([])
        expect(pickChangedFields({ syncedServerUpdatedAt: 'x' }, {})).toEqual([])
        expect(pickChangedFields({ revision: 1 }, { revision: 2 })).toEqual([])
        expect(SYNC_COMPARE_IGNORED_FIELDS.has('baseUpdatedAt')).toBe(true)
    })

    it('D3 两套哨兵口径的边界事实：pull 侧 valuesEqual 未把 "none" 归一（本批未改）', () => {
        // 事实登记：A1 / 保存侧都走 valuesEqual（改名前后一致），'none' 由 isEmptySyncSentinel 单独处理
        expect(valuesEqual({ a: 1 }, { a: 1 })).toBe(true)
        expect(valuesEqual([], null)).toBe(true)
        expect(valuesEqual('none', 'None')).toBe(false)
    })

    it('D4 appendConflict 既有上限口径（pull-local-wins 同为 200 环）不被本批放大', async () => {
        await setup('t670-limit')
        for (let index = 0; index < 205; index += 1) {
            await appendConflict('t670-limit', {
                kind: 'pull-local-wins',
                table: 'tasks',
                entityId: `e-${index}`,
                loser: { id: `e-${index}`, name: `n-${index}` },
                winnerUpdatedAt: `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}.000Z`
            })
        }
        expect(await loadConflictJournal('t670-limit')).toHaveLength(200)
    })
})