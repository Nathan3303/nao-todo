// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { localDatabase } from '../../persistence-local/db/local-database'
import {
    FUTURE_REMOTE_TS,
    USER_ID,
    countQueue,
    createSyncedTask,
    makeServer,
    makeService,
    patchLocal,
    readJournal,
    readLocal,
    resetLocalState
} from './t675-field-merge-harness'

/**
 * T679 / B 批 M3 —— **pull 侧接入字段级合并**（集成守卫）
 *
 * 本文件锁 M3 的三条集成守卫（ADR §实施口径补充 / M2 复核）与「显式 winner」约束：
 * ① 远端胜支必须**显式** `lwwWinner='remote'`（漏传 ⇒ 冲突字段会按「我的」落库）；
 * ② 落库 = `{ ...localRecord, ...mergedFiltered }` + **base 单独推进** + `deletedAt` 从本地行保留
 *    （⛔ 不得整行 replace）；
 * ③ `merged` 的显式 `undefined` **必须过滤**（远端缺键且我未改该字段时，不得清空本地值）。
 *
 * ⚠️ 记账面的 `conflictFields` 属 M5（additive），本文件**不**断言它。
 */

const rawRow = (id: string): Promise<Record<string, unknown> | undefined> =>
    localDatabase.tasks.get(id) as Promise<Record<string, unknown> | undefined>

const queuedRow = (id: string) => localDatabase.syncQueue.get(`${USER_ID}:tasks:${id}`)

describe('T679 / M3 远端胜支：冲突字段取远端值（显式 winner 守卫）', () => {
    beforeEach(resetLocalState)

    it('同字段冲突（远端更晚）⇒ 落库 = 远端值 + kind=remote-wins + 无我方字段可保留时出队', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { priority: 'high' })
        server.setRemote(id, { priority: 'low' }, FUTURE_REMOTE_TS)

        await makeService(server).pullAll()

        const local = await readLocal(id)
        // ⛔ 漏传 lwwWinner='remote' 时这里会是 'high'（静默按「我的」裁决）
        expect(local.priority).toBe('low')
        expect(local.name).toBe('A0-name')
        const entries = await readJournal()
        expect(entries.map((entry) => String(entry.kind))).toEqual(['remote-wins'])
        // 合并结果 == 远端（我方无字段可保留）⇒ 出队（= 今日行为，D5 记账表）
        expect(await countQueue()).toBe(0)
    })
})

describe('T679 / M3 落库守卫：部分行覆盖 + base 单独推进 + 墓碑保留 + 基准退役', () => {
    beforeEach(resetLocalState)

    it('本地胜支合并后：身份/墓碑/base 均保留，fieldBase 退役为远端域值（含我未改字段）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        // 远端只改描述（时间更早 ⇒ 本地胜支）
        const remoteAt = server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        await makeService(server).pullAll()

        const local = await readLocal(id)
        expect(local.name).toBe('B-name')
        expect(local.description).toBe('A-desc')

        const raw = await rawRow(id)
        // ② 部分行：身份与同步元数据不得丢（⛔ 整行 replace 会丢 userId / base）
        expect(raw?.userId).toBe(USER_ID)
        expect(raw?.syncedServerUpdatedAt).toBe(remoteAt)
        // ② `deletedAt` 从本地行保留（R-4：墓碑不进合并域）
        expect(raw?.deletedAt).toBeNull()
        // 队列保留（我的字段仍需推送）
        expect(await countQueue()).toBe(1)
        // 基准只前进：退役为远端当前域值（`description` 我未改也会进基准 ⇒ 下一轮判据稳定）
        expect((await queuedRow(id))?.fieldBase).toMatchObject({
            name: 'A0-name',
            description: 'A-desc'
        })
    })
})

describe('T679 / M3 本地胜支：同字段冲突 ⇒ 落库取 L + 快照只含冲突字段（R-H）', () => {
    beforeEach(resetLocalState)

    it('本地胜支同字段冲突 ⇒ kind=pull-local-wins、loser 仅冲突字段、合并字段照常落库', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        await patchLocal(id, { name: 'B-name', priority: 'high' })
        // 远端更早 ⇒ 本地胜支；priority 同字段冲突，description 只对方改
        server.setRemote(id, { description: 'A-desc', priority: 'low' })

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(String(entry.kind)).toBe('pull-local-wins')
        // R-H：快照只含冲突字段（合并成功的 description 不得入账）
        expect(entry.loser).toMatchObject({ priority: 'low' })
        expect((entry.loser as Record<string, unknown>).description).toBeUndefined()
        const local = await readLocal(id)
        expect(local.name).toBe('B-name')
        expect(local.description).toBe('A-desc')
        expect(local.priority).toBe('high')
        expect(await countQueue()).toBe(1)
    })
})

describe('T679 / M3 `merged` 显式 undefined 守卫', () => {
    beforeEach(resetLocalState)

    it('远端缺键 + 我未改该字段（L==B）⇒ 落库不得清空本地值', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, { endAt: '2026-12-01T00:00:00.000Z' })
        // 远端行缺 `endAt` 键且时间更晚 ⇒ 远端胜支；`R==undefined` + `L==B` ⇒ merged.endAt = undefined
        const remoteRow = server.rows.get(id)!
        delete remoteRow.endAt
        remoteRow.updatedAt = FUTURE_REMOTE_TS
        await patchLocal(id, { name: 'B-name' })

        await makeService(server).pullAll()

        const local = await readLocal(id)
        // ③ 不过滤 `undefined` ⇒ spread 会把本地 endAt 清成 undefined
        expect(local.endAt).toBe('2026-12-01T00:00:00.000Z')
        // 同一次合并的其它字段仍按字段级生效（证明本次确实走了合并路径）
        expect(local.name).toBe('B-name')
        expect(await readJournal()).toHaveLength(0)
    })
})

describe('T679 / M3 回滚开关（ADR D7，读取点唯一）', () => {
    beforeEach(async () => {
        await resetLocalState()
        localStorage.setItem('nao-todo:field-merge-mode', 'lww')
    })

    it("mode='lww' ⇒ pull 不合并、逐字走今日整行裁决", async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        const remoteAt = server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        await makeService(server).pullAll()

        const local = await readLocal(id)
        // 今日行为：本地胜只推进 base、不动业务字段，且记 1 条整行 pull-local-wins
        expect(local.name).toBe('B-name')
        expect(local.description).toBe('A0-desc')
        expect((await rawRow(id))?.syncedServerUpdatedAt).toBe(remoteAt)
        expect((await readJournal()).map((entry) => String(entry.kind))).toEqual([
            'pull-local-wins'
        ])
        expect(await countQueue()).toBe(1)
    })
})