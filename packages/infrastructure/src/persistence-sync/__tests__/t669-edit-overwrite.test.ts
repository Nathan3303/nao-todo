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
    countConflicts,
    loadConflictJournal,
    valuesEqual
} from '../conflict-journal'
import { pickChangedFields, pickOverwrittenFields } from '../edit-overwrite'

/**
 * T669 / `DEF-146` 用例先行（红基线）—— **编辑期覆盖 ⇒ 保存侧三值判定 + 复用记账**
 *
 * 契约真源：`docs/prds/2026-11-07-edit-vs-remote-overwrite.md`（R-1…R-8 · AC1–AC9 · AC1b）
 *          · `docs/reports/T668-def146-verdict.md` §2（判据）/ §3（快照复用）/ §5（M1–M5 变异点）
 *          · `docs/adr/2026-11-06-edit-vs-remote-overwrite.md`
 *
 * 判据（PM 冻结，⛔ 不得改口径）：`F = keys(载荷) ∩ keys(编辑基准)`；
 *   逐字段 `(R_f ≠ O_f) 且 (L_f ≠ R_f)` 才记；`≠` 一律 `valuesEqual`（空值哨兵归一）。
 *   `R` = 库中云端当前值（写前读）· `L` = 本次载荷 · `O` = 用户编辑起点值（编辑器 `persistedText`）。
 *
 * 覆盖：6 反例（零误报）+ 4 正例 + AC3（记账失败不阻断）/ AC4（无基准零行为变化）/
 *       AC6（截断与上限不回退）+ 共享 helper 与 A1 旧实现的等价守门。
 *
 * ⚠️ 红基线原因（现状）：`TaskRepository.update` 无「编辑基准」入参，保存路径无任何记账 ⇒
 *    正例全红、AC3 无日志、helper 模块不存在。
 */

const USER_ID = 't669-user'

const repo = () => newLocalTaskRepository()

/** 造一条已存在任务（清掉 seed 产生的队列项，避免与「远端落库」混淆） */
const seed = async (name: string, description = ''): Promise<string> => {
    const [task, err] = await repo().create(makeTaskVO({ name, description }))
    expect(err).toBeNull()
    await localDatabase.syncQueue.clear()
    return task!.id
}

/** 模拟「远端那次修改已由自动刷新落库」：走本地写路径 + 清队列（不模拟 A1 记账） */
const remoteLanding = async (id: string, patch: Record<string, unknown>): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    Object.assign(vo, patch)
    const err = await repo().update(id, vo)
    expect(err).toBeNull()
    await localDatabase.syncQueue.clear()
}

/** 用户保存（带可选编辑基准） */
const save = async (id: string, patch: Record<string, unknown>, origin?: TaskUpdateOrigin) => {
    const vo = new UpdateTaskValueObject(id)
    Object.assign(vo, patch)
    return repo().update(id, vo, origin)
}

const journal = () => loadConflictJournal(USER_ID)

const taskRow = async (id: string) => {
    const record = await localDatabase.tasks.get(id)
    return {
        name: await cryptoService.decrypt(record!.name),
        description: await cryptoService.decrypt(record!.description),
        updatedAt: record!.updatedAt
    }
}

describe('T669 正例：编辑期覆盖 ⇒ 恰 1 条 pull-local-wins（复用既有 kind/快照）', () => {
    beforeEach(async () => {
        await setup(USER_ID)
        clearStructuredLog()
    })

    it('AC1 同字段被远端改过 + 我保存的值 ≠ 云端当前值 ⇒ 1 条，loser 仅含身份字段 + 该字段', async () => {
        const id = await seed('起点标题')
        await remoteLanding(id, { name: '云端标题' })

        const err = await save(id, { name: '我的标题' }, { name: '起点标题' })
        expect(err).toBeNull()

        const entries = await journal()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(entry.kind).toBe('pull-local-wins')
        expect(entry.table).toBe('tasks')
        expect(entry.entityId).toBe(id)
        // R-4：快照 = 身份字段 + diff 字段（⛔ 不得整行复制）
        expect(Object.keys(entry.loser).sort()).toEqual(['id', 'name'])
        expect(entry.loser.name).toBe('云端标题')
        // A1 同口径：winner = 本次本地写入，loser = 被覆盖的云端版本
        expect(entry.winnerUpdatedAt).toBe((await taskRow(id)).updatedAt)
        expect(entry.loserUpdatedAt).toBeUndefined()
        // 可见面计数（同一真源）
        expect(await countConflicts(USER_ID)).toBe(1)
        // 保存本身照旧落库（AC2：不改变任何同步裁决）
        expect((await taskRow(id)).name).toBe('我的标题')
    })

    it('AC1 两个字段同时被覆盖 ⇒ 仍是 1 条记录，loser 恰好含这两个字段', async () => {
        const id = await seed('起点标题', '起点描述')
        await remoteLanding(id, { name: '云端标题', description: '云端描述' })

        const err = await save(
            id,
            { name: '我的标题', description: '我的描述' },
            { name: '起点标题', description: '起点描述' }
        )
        expect(err).toBeNull()

        const entries = await journal()
        expect(entries).toHaveLength(1)
        expect(Object.keys(entries[0]!.loser).sort()).toEqual(['description', 'id', 'name'])
        expect(entries[0]!.loser).toMatchObject({
            name: '云端标题',
            description: '云端描述'
        })
    })

    it('AC1b 改回原值但远端改过该字段 ⇒ 1 条（覆盖真实发生，不得静默）', async () => {
        const id = await seed('d0')
        await remoteLanding(id, { name: 'd9' })

        // 用户改了又改回 d0 ⇒ L === O，但 R !== O 且 L !== R ⇒ 保存确实把云端 d9 写回 d0
        const err = await save(id, { name: 'd0' }, { name: 'd0' })
        expect(err).toBeNull()

        const entries = await journal()
        expect(entries).toHaveLength(1)
        expect(entries[0]!.loser).toMatchObject({ name: 'd9' })
        expect((await taskRow(id)).name).toBe('d0')
    })

    it('AC6 长文本 > 512 ⇒ 截断并标 truncated（复用既有快照口径）', async () => {
        const id = await seed('短标题', '起点')
        const longRemote = 'r'.repeat(600)
        await remoteLanding(id, { description: longRemote })

        const err = await save(id, { description: '我的新描述' }, { description: '起点' })
        expect(err).toBeNull()

        const entry = (await journal())[0]!
        expect(entry.truncated).toBe(true)
        expect(entry.truncatedFields).toEqual(['description'])
        expect(String(entry.loser.description)).toHaveLength(512)
        expect(entry.loser.description).toBe(longRemote.slice(0, 512))
    })
})

describe('T669 反例：零误报（AC5）', () => {
    beforeEach(async () => {
        await setup(USER_ID)
        clearStructuredLog()
    })

    it('① 连改两次（第二次基准 = 上次提交值 = R）⇒ 0 条', async () => {
        const id = await seed('v0')
        expect(await save(id, { name: 'v1' })).toBeNull()
        expect(await save(id, { name: 'v2' }, { name: 'v1' })).toBeNull()
        expect(await journal()).toHaveLength(0)
    })

    it('② 仅格式化/空哨兵差异（valuesEqual 归一）⇒ 0 条', async () => {
        const id = await seed('哨兵', 'side')
        // 远端落库把 remindWeekdays 归一为 null（真服务端空数组形态），编辑起点是 [1]
        await localDatabase.tasks.update(id, {
            remindWeekdays: null as unknown as number[]
        })

        const err = await save(id, { remindWeekdays: [] }, { remindWeekdays: [1] })
        expect(err).toBeNull()

        // `[]` ≡ `null`（空值哨兵归一）⇒ ② 不成立 ⇒ 不记（用 `!==` 会误报 ⇒ M3 必红）
        expect(await journal()).toHaveLength(0)
    })

    it('③ 远端改的是别的字段 ⇒ 0 条（无字段级重叠就不记）', async () => {
        const id = await seed('n0', 'd0')
        await remoteLanding(id, { description: 'd1' })

        expect(await save(id, { name: 'n1' }, { name: 'n0' })).toBeNull()
        expect(await journal()).toHaveLength(0)
    })

    it('④ 改回原值且远端未动该字段（L = O = R）⇒ 0 条', async () => {
        const id = await seed('x')
        // 用户先在输入框改成 'y' 又改回 'x'（中间值从未保存）⇒ 载荷 = 起点 = 库中当前值
        expect(await save(id, { name: 'x' }, { name: 'x' })).toBeNull()
        expect(await journal()).toHaveLength(0)
    })

    it('⑤ 远端改完我才输入（基准已是新值）⇒ 0 条', async () => {
        const id = await seed('old')
        await remoteLanding(id, { name: '新值' })

        // 自动刷新已落库，编辑器基准随 store 推进到新值
        expect(await save(id, { name: '我的修改' }, { name: '新值' })).toBeNull()
        expect(await journal()).toHaveLength(0)
    })

    it('⑥ 我保存的值 = 云端当前值（L = R）⇒ 0 条', async () => {
        const id = await seed('o')
        await remoteLanding(id, { name: 'r' })

        expect(await save(id, { name: 'r' }, { name: 'o' })).toBeNull()
        expect(await journal()).toHaveLength(0)
    })
})

describe('T669 边界与异常（AC3 / AC4 / AC6）', () => {
    beforeEach(async () => {
        await setup(USER_ID)
        clearStructuredLog()
    })

    it('AC4 未传编辑基准（老调用方 / 移动端）⇒ 0 条，保存逐字照旧', async () => {
        const id = await seed('o')
        await remoteLanding(id, { name: 'r' })

        expect(await save(id, { name: '我的' })).toBeNull()
        expect(await journal()).toHaveLength(0)
        expect((await taskRow(id)).name).toBe('我的')
    })

    it('AC3 记账失败 ⇒ 保存仍成功、不回滚，只有结构化日志（含实体 id 与原因，无业务值）', async () => {
        const id = await seed('o')
        await remoteLanding(id, { name: '云端版本' })

        const put = vi
            .spyOn(localDatabase.meta, 'put')
            .mockRejectedValueOnce(new Error('quota-exceeded'))
        const err = await save(id, { name: '我的版本' }, { name: 'o' })
        put.mockRestore()

        expect(err).toBeNull() // 保存成功、无用户可见错误
        expect((await taskRow(id)).name).toBe('我的版本') // 无回滚
        expect(await journal()).toHaveLength(0) // 记账确实失败

        const failed = readStructuredLog().filter(
            (entry) => entry.event === STRUCTURED_LOG_EVENTS.SYNC_JOURNAL_RECORD_FAILED
        )
        expect(failed).toHaveLength(1)
        // 级别 = error：一次真实覆盖没有任何记录 = 能力失效，不得降级为 warn
        expect(failed[0]!.level).toBe('error')
        expect(failed[0]!.fields.entityId).toBe(id)
        expect(failed[0]!.fields.table).toBe('tasks')
        expect(String(failed[0]!.fields.reason)).toContain('quota-exceeded')
        // R-H / NFR：不得落明文业务值
        expect(JSON.stringify(failed[0])).not.toContain('我的版本')
        expect(JSON.stringify(failed[0])).not.toContain('云端版本')
    })

    it('AC6 记录数超上限时按既有优先级淘汰，总量仍 200（上限不升）', async () => {
        for (let index = 0; index < 200; index += 1) {
            await appendConflict(USER_ID, {
                kind: 'stale',
                table: 'tasks',
                entityId: `seeded-${index}`,
                loser: { id: `seeded-${index}`, name: `seeded-${index}` },
                winnerUpdatedAt: `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}.000Z`
            })
        }
        expect(await journal()).toHaveLength(200)

        const id = await seed('o')
        await remoteLanding(id, { name: 'r' })
        expect(await save(id, { name: '我的' }, { name: 'o' })).toBeNull()

        expect(await journal()).toHaveLength(200)
    })
})

describe('T669 共享 helper（A1 重构等价守门）', () => {
    it('pickChangedFields 与 A1 旧内联实现同输入同产物', () => {
        /** 重构前 `recordPullLocalWins` 的内联实现（原样保留作对照基准） */
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
                const a = remote[field]
                const b = local[field]
                // 旧实现亦走 valuesEqual（DEF-135 唯一口径）
                if (valuesEqual(a, b)) continue
                fields.push(field)
            }
            return fields
        }

        const cases: Array<[Record<string, unknown>, Record<string, unknown>]> = [
            [
                { id: 't', name: 'a', description: 'b', updatedAt: 'x' },
                { id: 't', name: 'a2', description: 'b' }
            ],
            [
                { id: 't', name: '', tags: [] },
                { id: 't', name: null, tags: [] }
            ],
            [
                { id: 't', projectId: 'p1' },
                { id: 't', projectId: 'p2', sortId: 3 }
            ]
        ]
        for (const [remote, local] of cases) {
            expect(pickChangedFields(remote, local)).toEqual(legacy(remote, local))
        }
    })

    it('pickOverwrittenFields 只取「载荷 ∩ 基准」且两条件同时成立', () => {
        const cloud = { id: 't', name: 'R', description: 'R-d', priority: 'low' }
        const payload = { name: 'L', priority: 'high' }
        const origin = { name: 'O', priority: 'low', description: 'R-d' }

        // name：R≠O 且 L≠R ⇒ 记；priority：R=O ⇒ 不记；description：不在载荷 ⇒ 不记
        expect(pickOverwrittenFields(cloud, payload, origin)).toEqual(['name'])
        // 无基准 ⇒ 恒空（R-6 缺省零行为变化）
        expect(pickOverwrittenFields(cloud, payload, undefined)).toEqual([])
    })
})