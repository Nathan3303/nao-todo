// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { isEmptySyncSentinel } from '../sync-normalize'
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
 * T675 / AC5 —— **零误报 / 零漏报矩阵（八项，逐条可断言）**
 *
 * 三项为**护栏·现状已正确**（仅我改 / 仅对方改 / 空哨兵）：现状不会误报，合并上线后必须继续不误报
 * （尤其：判等必须走 `valuesEqual` 的空哨兵归一，⛔ 不得退化为 `===`）。
 *
 * 其余五项**现状必红**：
 * - **我改回原值**：现状 A1「整行有差异」口径仍记 1 条（`L==B` 时应取 `R`、0 条）；
 * - **格式化（数组顺序）差异**：`tags` 顺序不同被 JSON 深比较判为差异 ⇒ 记 1 条；
 * - **同毫秒**：`remoteTs > localTs` 为假 ⇒ 落本地胜分支且记账（合并判据不得依赖时间戳）；
 * - **字段集不相交**：现状记 1 条且对方字段整行丢失；
 * - **部分相交**：现状记 1 条但快照是整行、无字段级信号，且被合并的字段（description）也丢。
 */
describe('T675 / AC5 判据矩阵', () => {
    beforeEach(resetLocalState)

    it('AC5-① 仅我改（push 路径）⇒ 0 条、我的值生效、对方字段原样（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name' })
        await makeService(server).pushAll()

        expect(await readJournal()).toHaveLength(0)
        expect(await countQueue()).toBe(0)
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A0-desc')
    })

    it('AC5-② 仅对方改（无本地队列）⇒ 0 条、对方值落库（护栏·现状已绿）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await makeService(server).pullAll()

        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).description).toBe('A-desc')
        expect(await countQueue()).toBe(0)
    })

    it('AC5-③ 我改回原值（L==B，队列仍在）⇒ 0 条、对方字段仍合并进来', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        // 先改成 X，再改回原值 ⇒ 队列脏但内容回到基准（`fieldBase` 首次写胜 ⇒ B 仍是 A0-name）
        await patchLocal(id, { name: 'X-name' })
        await patchLocal(id, { name: 'A0-name' })
        server.setRemote(id, { description: 'A-desc' })

        await makeService(server).pullAll()

        // 现状红：整行 diff 非空 ⇒ 记 1 条 pull-local-wins
        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).name).toBe('A0-name')
        expect((await readLocal(id)).description).toBe('A-desc')
        expect(await countQueue()).toBe(1)
    })

    it('AC5-④ 格式化差异（tags 顺序不同、集合相同）⇒ 0 条、无重复、顺序确定', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, { tags: ['t1'] })

        await patchLocal(id, { tags: ['t2', 't1'] })
        server.setRemote(id, { tags: ['t1', 't2'] })

        await makeService(server).pullAll()

        // 现状红：JSON 深比较把顺序差异判成 tags 差异 ⇒ 记 1 条
        expect(await readJournal()).toHaveLength(0)
        const tags = (await readLocal(id)).tags
        expect(tags).toEqual(['t2', 't1'])
        expect(new Set(tags).size).toBe(tags.length)
    })

    it("AC5-⑤ 空哨兵（服务端 null / 客户端 '' / 集合 [] 归一）⇒ 0 条误报（护栏·现状已绿）", async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, {
            description: 'A0-desc',
            tags: ['t1'],
            remindRepeat: 'none',
            remindTime: '09:00'
        })

        // 对方用服务端空表示（null / []），本地用客户端空表示（null → 落库为 '' / []）
        // ⚠️ 口径：`'none'` 只被 `sync-normalize.isEmptySyncSentinel` 归空，`valuesEqual`（R-1 指定判等）
        //    **不**把 `'none'` 与 `''` 视为相等 ⇒ `'none'` vs `''` 的组合**不在本用例断言范围**（见报告口径冲突 ①）
        server.setRemote(id, { remindTime: null, tags: [] })
        await patchLocal(id, { remindTime: null, tags: [] })

        await makeService(server).pullAll()

        expect(await readJournal()).toHaveLength(0)
        const after = await readLocal(id)
        expect(isEmptySyncSentinel(after.remindTime)).toBe(true)
        expect(after.remindRepeat).toBe('none')
        expect(after.tags).toEqual([])
    })

    it('AC5-⑥ 同毫秒（远端 updatedAt == 本地写入 updatedAt）⇒ 0 条、两字段都在', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name' })
        const localTs = String((await readLocalRaw(id)).updatedAt)
        // 同毫秒：远端版本与本地写入**逐字相同** ⇒ 现状 `remoteTs > localTs` 为假 ⇒ 本地胜分支记账
        server.setRemote(id, { description: 'A-desc' }, localTs)

        await makeService(server).pullAll()

        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
    })

    it('AC5-⑦ 字段集不相交（我改 name+priority，对方改 description+endAt）⇒ 0 条、四字段都在', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name', priority: 'high' })
        server.setRemote(id, {
            description: 'A-desc',
            endAt: '2026-12-01T00:00:00.000Z'
        })

        await makeService(server).pullAll()

        // 现状红：记 1 条 + 对方两个字段整行丢失
        expect(await readJournal()).toHaveLength(0)
        const after = await readLocal(id)
        expect(after.name).toBe('B-name')
        expect(after.priority).toBe('high')
        expect(after.description).toBe('A-desc')
        expect(after.endAt).toBe('2026-12-01T00:00:00.000Z')
    })

    it('AC5-⑧ 部分相交（一半合并、一半冲突）⇒ 1 条且只记冲突字段，合并字段不进快照', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name', priority: 'high' })
        server.setRemote(id, { description: 'A-desc', priority: 'low' })

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(String(entry.kind)).toBe('pull-local-wins')
        // 字段级信号（ADR D5 additive）：只有冲突字段
        const conflictFields = (entry as unknown as { conflictFields?: string[] }).conflictFields
        expect(conflictFields).toEqual(['priority'])
        // 合并成功的字段不记账（R-3）：败方快照不得包含 description
        expect((entry.loser as Record<string, unknown>).priority).toBe('low')
        expect((entry.loser as Record<string, unknown>).description).toBeUndefined()

        const after = await readLocal(id)
        expect(after.name).toBe('B-name')
        expect(after.description).toBe('A-desc')
        expect(after.priority).toBe('high')

        await makeService(server).pushAll()
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A-desc')
        expect(server.row(id)?.priority).toBe('high')
    })
})