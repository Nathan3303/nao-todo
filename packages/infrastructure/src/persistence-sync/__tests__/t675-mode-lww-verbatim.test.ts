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
 * T675 / 回滚开关双态护栏（AC14 / ADR D7） —— `mode='lww'` 必须**逐字复现今日 X/Y/Z**
 *
 * 开关位置与取值由 ADR 固定：`localStorage['nao-todo:field-merge-mode'] ∈ {merge, lww}`（默认 `merge`）。
 * 本文件在 `lww` 下跑 T671 三时序：**实现前必绿**（今天就是 LWW），**实现后必须仍绿**
 * （证明「一键降级」不是第二套算法）。默认态（`merge`）的零冲突断言见 `t675-ac1-*`。
 */
const MODE_KEY = 'nao-todo:field-merge-mode'

describe('T675 / mode=lww 逐字复现今日三时序（双态护栏）', () => {
    beforeEach(async () => {
        await resetLocalState()
        localStorage.setItem(MODE_KEY, 'lww')
    })

    it('lww-X 已拉取：0 条 + 两端字段都在（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await makeService(server).pullAll()
        await patchLocal(id, { name: 'B-name' })
        await makeService(server).pushAll()

        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
    })

    it('lww-Y 先 push：1 条 stale + 整行不合并 + 出队（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })
        await makeService(server).pushAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        expect(String(entries[0]!.kind)).toBe('stale')
        // 整行口径：本地仍是「我的整行」（对方描述未合并进来），且已出队（＝今日行为逐字）
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A0-desc')
        expect(await countQueue()).toBe(0)
    })

    it('lww-Z 先 pull：1 条 pull-local-wins + 后续 push 整行覆盖（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        const remoteAt = server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })
        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        expect(String(entries[0]!.kind)).toBe('pull-local-wins')
        expect((entries[0]!.loser as Record<string, unknown>).description).toBe('A-desc')
        expect(entries[0]!.loserUpdatedAt).toBe(remoteAt)
        // 本地胜：仅推进 base、不动业务字段、不出队（A1 既有语义）
        expect((await readLocal(id)).description).toBe('A0-desc')
        expect((await readLocalRaw(id)).syncedServerUpdatedAt).toBe(remoteAt)
        expect(await countQueue()).toBe(1)

        // 随后的 push 以「我的整行」写回 ⇒ 云端描述被覆盖（今日真实行为，降级态必须逐字一致）
        await makeService(server).pushAll()
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A0-desc')
    })
})