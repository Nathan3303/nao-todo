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
 * T675 / AC2 —— **集合（`tags`）逐元素三方 + 并集不丢 + 幂等**
 *
 * 口径（ADR D4）：结果 =（我的集合 ∪ 对方集合）− 我删的 − 对方删的；按值去重；
 * 顺序 = 我的相对顺序在前，对方**新增**项按对方顺序追加（顺序确定 ⇒ 合并幂等、不触发无意义写）。
 *
 * 红因（现状）：`tags` 是整数组覆盖（LWW / 行级 OCC）⇒ 一边新增的标签必丢，
 * 且重复 pull 会反复产生 A1 记账。
 */
describe('T675 / AC2 tags 并集不丢', () => {
    beforeEach(resetLocalState)

    it('AC2 手机加 #紧急 + 桌面加 #工作 ⇒ 两个标签都在、不重复、顺序确定', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, { tags: [] })

        server.setRemote(id, { tags: ['#紧急'] })
        await patchLocal(id, { tags: ['#工作'] })

        await makeService(server).pullAll()

        // 现状红：A1 整行口径记 1 条，且本地 tags 仍只有我这一侧
        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).tags).toEqual(['#工作', '#紧急'])
        expect(await countQueue()).toBe(1)

        await makeService(server).pushAll()
        expect(await readJournal()).toHaveLength(0)
        expect(server.row(id)?.tags).toEqual(['#工作', '#紧急'])
    })

    it('AC2 幂等：同一份输入重复 pull ⇒ 结果不变、无重复、无新增记账', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, { tags: [] })

        server.setRemote(id, { tags: ['#紧急'] })
        await patchLocal(id, { tags: ['#工作'] })

        await makeService(server).pullAll()
        const afterFirst = (await readLocal(id)).tags
        await makeService(server).pullAll()
        const afterSecond = (await readLocal(id)).tags

        expect(afterFirst).toEqual(afterSecond)
        expect(new Set(afterSecond).size).toBe(afterSecond.length)
        expect([...afterSecond].sort()).toEqual(['#工作', '#紧急'].sort())
        expect(await readJournal()).toHaveLength(0)
    })
})