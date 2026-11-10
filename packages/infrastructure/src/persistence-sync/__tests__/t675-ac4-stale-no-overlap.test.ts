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
    readLocalRaw,
    resetLocalState
} from './t675-field-merge-harness'

/**
 * T675 / AC4 —— **`stale` 且无同字段重叠 ⇒ 0 记账 + 保队列 + 下一轮 push `applied`**
 *
 * 口径（ADR D-b2 / D3）：push 回执 `stale` 携带 `serverCurrent`（= `R`）；用 `fieldBase`（= `B`）
 * 与本地行（= `L`）在回执侧就地合并：不记账、**不删队列项**、`base` 前进到 `serverUpdatedAt`；
 * 下一轮 push 以新 base 命中 `applied`（网络往返不增加）。
 *
 * 红因（现状）：`stale` 必记 1 条 + 出队（`sync-service.ts:1576-1630`）⇒ 我的字段无人再推，
 * 云端异字段随后被整行覆盖。
 */
describe('T675 / AC4 stale 无重叠字段时零记账并自愈', () => {
    beforeEach(resetLocalState)

    it('AC4 回执 stale ⇒ 0 条 + 队列保留 + base 前进到服务端版本 + 下一轮 push applied', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        await makeService(server).pushAll()

        // 现状红：stale 必记账 + 出队
        expect(await readJournal()).toHaveLength(0)
        expect(await countQueue()).toBe(1)
        // 合并结果落在本地行（我改的 name + 对方的 description）
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
        // R-6 基准只前进：base = 回执里的服务端当前版本
        expect((await readLocalRaw(id)).syncedServerUpdatedAt).toBe(server.row(id)?.updatedAt)

        const baseAfterMerge = server.row(id)?.updatedAt
        const pushesBefore = server.pushBodies.length
        await makeService(server).pushAll()

        // 下一轮 push 用的是新 base ⇒ applied（不新增记录、队列清空）
        expect(server.pushBodies.length).toBe(pushesBefore + 1)
        const lastBody = server.pushBodies.at(-1)
        const sent = (lastBody?.tasks as Record<string, unknown>[] | undefined)?.[0]
        expect(sent?.baseUpdatedAt).toBe(baseAfterMerge)
        expect(await readJournal()).toHaveLength(0)
        expect(await countQueue()).toBe(0)
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
    })

    it('AC4+ 两端 300ms 内先后写不同字段（含双端都 push）⇒ 0 条 + 三个字段最终都在', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        // B 端：改名称（本地写 → 真实入队）
        await patchLocal(id, { name: 'B-name' })
        // A 端：同一窗口内改描述（假服务端只模拟服务端行版本前进）
        server.setRemote(id, { description: 'A-desc' })

        // B 先 push ⇒ 行级 OCC 判 stale（未见过 R）⇒ 回执侧合并
        await makeService(server).pushAll()
        expect(await readJournal()).toHaveLength(0)
        expect(await countQueue()).toBe(1)

        // B 再改一个不同字段（同毫秒窗口内），随后下一轮 push 收敛
        await patchLocal(id, { priority: 'high' })
        await makeService(server).pushAll()

        expect(await readJournal()).toHaveLength(0)
        expect(await countQueue()).toBe(0)
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
        expect((await readLocal(id)).priority).toBe('high')
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
        expect(server.row(id)?.priority).toBe('high')
    })
})