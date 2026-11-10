// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
    FUTURE_REMOTE_TS,
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
 * T675 / AC6 —— **墓碑优先（删除胜、无假账）+ 归档优先但其它字段继续合并**
 *
 * 口径（PRD R-4 / 场景 5、ADR D-b3）：
 * - `deletedAt` **不进合并域**：任一侧非空 ⇒ 整行按墓碑语义裁决（删除优先、禁复活）；
 *   「我的修改覆盖云端」类假账（`pull-local-wins`）不得出现；
 * - `archivedAt` **归档优先但其它字段继续合并**（归档不删内容）。
 *
 * 现状：删除并发两时序已正确（护栏）；归档并发**必红** —— 现状落 A1「本地胜」分支，
 * 只推进 base 不动业务字段 ⇒ 归档丢失 + 记 1 条整行记录。
 */
describe('T675 / AC6 墓碑与归档', () => {
    beforeEach(resetLocalState)

    it('AC6 删除 + 改字段并发（本地胜时序）⇒ 删除胜、出队、无「我的修改覆盖云端」假账（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name' })
        server.setRemote(id, { deletedAt: '2026-02-02T00:00:00.000Z' })

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries.map((entry) => String(entry.kind))).not.toContain('pull-local-wins')
        expect((await readLocal(id)).deletedAt).not.toBeNull()
        expect(await countQueue()).toBe(0)

        // 后续 push 不得复活：队列已空、服务端墓碑仍在
        const pushesBefore = server.pushBodies.length
        await makeService(server).pushAll()
        expect(server.pushBodies.length).toBe(pushesBefore)
        expect(server.row(id)?.deletedAt).toBe('2026-02-02T00:00:00.000Z')
    })

    it('AC6 删除 + 改字段并发（远端胜时序：远端时间戳更晚）⇒ 删除胜、无假账（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name' })
        server.setRemote(id, { deletedAt: '2026-02-02T00:00:00.000Z' }, FUTURE_REMOTE_TS)

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries.map((entry) => String(entry.kind))).not.toContain('pull-local-wins')
        expect((await readLocal(id)).deletedAt).not.toBeNull()
        expect(await countQueue()).toBe(0)
        expect(server.row(id)?.deletedAt).toBe('2026-02-02T00:00:00.000Z')
    })

    it('AC6 归档 + 改字段并发 ⇒ 归档优先且其它字段继续合并（0 条）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name' })
        server.setRemote(id, {
            archivedAt: '2026-02-03T00:00:00.000Z',
            description: 'A-desc'
        })

        await makeService(server).pullAll()

        // 现状红：A1 本地胜只推进 base ⇒ 归档丢失（null）+ 记 1 条整行记录
        expect(await readJournal()).toHaveLength(0)
        const after = await readLocal(id)
        expect(after.archivedAt).toBe('2026-02-03T00:00:00.000Z')
        expect(after.name).toBe('B-name')
        expect(after.description).toBe('A-desc')

        await makeService(server).pushAll()
        expect(server.row(id)?.archivedAt).toBe('2026-02-03T00:00:00.000Z')
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
    })
})