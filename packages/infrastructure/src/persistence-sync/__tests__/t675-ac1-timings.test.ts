// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
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
 * T675 / AC1 —— **不同字段 × 三时序 ⇒ 0 条冲突记录 + 两端字段都保住**
 *
 * 口径（PRD AC1 / T671 三时序）：
 * - **X**：另一端改描述、本端保存名称前**已拉取**过 ⇒ 现状已 0 条（本文件为护栏）；
 * - **Y**：本端保存名称后**先 push**（未拉取）⇒ 现状 `stale` × 1，且随后 push 把云端描述覆盖掉；
 * - **Z**：本端保存名称后**先 pull**（周期自动刷新）⇒ 现状 `pull-local-wins` × 1，同样覆盖云端描述。
 *
 * 断言一律**字段级**（`name` / `description` 逐条相等），⛔ 不用「整行相等」代替。
 * 红因（Y/Z）：现状裁决粒度 = 整行（LWW / 行级 OCC），不存在字段级合并路径。
 */
describe('T675 / AC1 不同字段三时序', () => {
    beforeEach(resetLocalState)

    it('AC1-X 已拉取：A 改描述 → B 拉取 → B 保存名称 → B push ⇒ 0 条 + 两端字段都在（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await makeService(server).pullAll()
        expect((await readLocal(id)).description).toBe('A-desc')

        await patchLocal(id, { name: 'B-name' })
        expect(await readJournal()).toHaveLength(0)

        await makeService(server).pushAll()

        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
    })

    it('AC1-Y 先 push：A 改描述 → B 保存名称 → B push ⇒ 0 条 + 描述不被覆盖', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        await makeService(server).pushAll()

        // 现状红：行级 OCC 判 stale + 记 1 条 + 出队 ⇒ 我的名称与云端描述只能二选一
        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
        // D-b2：合并后**保队列**，由下一轮 push 完成收敛（网络往返不增加）
        expect(await countQueue()).toBe(1)

        await makeService(server).pushAll()
        expect(await readJournal()).toHaveLength(0)
        expect(await countQueue()).toBe(0)
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
    })

    it('AC1-Z 先 pull：A 改描述 → B 保存名称 → B pull ⇒ 0 条 + 描述不被覆盖', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        await makeService(server).pullAll()

        // 现状红：落在既有 A1「本地胜」分支 ⇒ 记 1 条 pull-local-wins（整行口径），云端描述稍后被覆盖
        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
        expect(await countQueue()).toBe(1)

        await makeService(server).pushAll()
        expect(await readJournal()).toHaveLength(0)
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
    })
})