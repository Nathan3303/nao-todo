// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { makeTaskVO } from '../../persistence-local/__tests__/local-repos-test-helpers'
import { FIELD_MERGE_MODE_KEY, resolveMergeMode } from '../field-merge'
import {
    FUTURE_REMOTE_TS,
    countQueue,
    makeServer,
    makeService,
    patchLocal,
    readJournal,
    readLocal,
    resetLocalState,
    type FakeServer
} from './t675-field-merge-harness'

/**
 * T683 / B 批 M6 —— **回滚开关（`mode='lww'`）真实链路实测**
 *
 * 口径（ADR D7 + M6 卡）：
 * - 开关键 `localStorage['nao-todo:field-merge-mode']`；读取点唯一 = `resolveMergeMode()`；默认 `merge`；
 * - `lww` ⇒ **逐字复现 `v1.18.2`**：pull 远端胜 = 整行覆盖 + 出队；pull 本地胜 = 只推进 base（不合并）；
 *   push `stale` = 记账 + 出队；
 * - **运行中切换即可生效**（按批读取，⛔ 无需重启 / 重建 DB / 迁移）—— 本文件在**同一进程 + 同一 DB**
 *   内依次跑 `merge → lww → merge`，不靠单测桩（真实仓储 + 真实 journal + 假服务端只模拟契约）。
 */

const journalLength = async (): Promise<number> => (await readJournal()).length

interface Scenario {
    id: string
    server: FakeServer
}

/**
 * 建一条已同步任务（**本文件自带夹具**：`createSyncedTask` 会断言「journal 为空」，
 * 而运行中切换场景共用同一 DB、journal 有历史条目 ⇒ 不能复用）。
 */
const createSynced = async (server: FakeServer): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(
        makeTaskVO({ name: 'A0-name', description: 'A0-desc' })
    )
    if (err !== null) throw new Error(`夹具建任务失败: ${err}`)
    await makeService(server).pushAll()
    return (task as { id: string }).id
}

/** 场景夹具：已同步任务 + 远端改描述（时间更早 ⇒ pull 本地胜支）+ 本地改名称 */
const localWinScenario = async (server: FakeServer): Promise<Scenario> => {
    const id = await createSynced(server)
    server.setRemote(id, { description: 'A-desc' })
    await patchLocal(id, { name: 'B-name' })
    return { id, server }
}

describe('T683 / M6 回滚开关：同一进程内运行中切换（真实链路）', () => {
    beforeEach(resetLocalState)

    it('merge（默认）⇒ 字段级合并；运行中切 lww ⇒ 逐字今日；切回 merge ⇒ 再次合并', async () => {
        const server = makeServer()

        // ── ① 默认（无开关键）⇒ merge ──
        expect(resolveMergeMode()).toBe('merge')
        const first = await localWinScenario(server)
        const beforeFirst = await journalLength()
        await makeService(server).pullAll()
        expect(await journalLength()).toBe(beforeFirst) // 0 记账
        const firstLocal = await readLocal(first.id)
        expect(firstLocal.name).toBe('B-name')
        expect(firstLocal.description).toBe('A-desc')
        expect(await countQueue()).toBe(1)

        // ── ② 运行中切 lww（⛔ 不重启 / 不重建 DB）⇒ 逐字今日 ──
        localStorage.setItem(FIELD_MERGE_MODE_KEY, 'lww')
        expect(resolveMergeMode()).toBe('lww')
        const second = await localWinScenario(server)
        const beforeSecond = await journalLength()
        await makeService(server).pullAll()
        const secondEntries = (await readJournal()).slice(beforeSecond)
        expect(secondEntries.map((entry) => String(entry.kind))).toEqual(['pull-local-wins'])
        const secondLocal = await readLocal(second.id)
        // 今日行为：本地胜只推进 base、**不合并**业务字段
        expect(secondLocal.name).toBe('B-name')
        expect(secondLocal.description).toBe('A0-desc')
        expect(await countQueue()).toBe(1)

        // ── ③ 切回 merge ⇒ 再次字段级合并 ──
        localStorage.removeItem(FIELD_MERGE_MODE_KEY)
        expect(resolveMergeMode()).toBe('merge')
        const third = await localWinScenario(server)
        const beforeThird = await journalLength()
        await makeService(server).pullAll()
        expect(await journalLength()).toBe(beforeThird)
        const thirdLocal = await readLocal(third.id)
        expect(thirdLocal.name).toBe('B-name')
        expect(thirdLocal.description).toBe('A-desc')
    })
})

describe('T683 / M6 lww 下其余两支逐字今日（pull 远端胜 / push stale）', () => {
    beforeEach(async () => {
        await resetLocalState()
        localStorage.setItem(FIELD_MERGE_MODE_KEY, 'lww')
    })

    it('pull 远端胜 ⇒ 整行覆盖（取 R）+ 1 条 remote-wins + 出队', async () => {
        const server = makeServer()
        const id = await createSynced(server)
        await patchLocal(id, { priority: 'high' })
        server.setRemote(id, { priority: 'low' }, FUTURE_REMOTE_TS)

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries.map((entry) => String(entry.kind))).toEqual(['remote-wins'])
        // 今日：整行覆盖 ⇒ 冲突字段取远端值（不合并）
        expect((await readLocal(id)).priority).toBe('low')
        expect(await countQueue()).toBe(0)
    })

    it('push stale ⇒ 1 条 stale + 出队（不合并、不保队列）', async () => {
        const server = makeServer()
        const id = await createSynced(server)
        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        await makeService(server).pushAll()

        const entries = await readJournal()
        expect(entries.map((entry) => String(entry.kind))).toEqual(['stale'])
        // 今日：整行不合并（云端描述未进本地）+ 出队
        const local = await readLocal(id)
        expect(local.name).toBe('B-name')
        expect(local.description).toBe('A0-desc')
        expect(await countQueue()).toBe(0)
    })
})