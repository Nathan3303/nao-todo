// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { localDatabase } from '../../persistence-local/db/local-database'
import { clearStructuredLog, readStructuredLog } from '../../observability/structured-log'
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
 * T675 / AC3 —— **合并中途失败 ⇒ 不写半成品、不丢数据、走既有错误面；日志结构化且不含业务值**
 *
 * 场景：拉取一批需要合并的记录时，本地落库抛错（存储 / 加解密）。
 * 期望：① 不留下「已裁决但未落库」的半成品记录；② 本地行保持原样（无部分写入）；
 *       ③ 队列保留（下一轮可重来）；④ 走既有错误面（`ok:false` + 运行级错误）；
 *       ⑤ 结构化日志不含明文业务值。
 *
 * 红因（现状）：`remote-wins` 分支**先记账后落库**（`sync-service.ts:1155-1178`），落库抛错时
 * 已存在一条针对「从未发生的覆盖」的记录 ⇒ 面板会显示一条假冲突。
 */
describe('T675 / AC3 合并中途失败', () => {
    beforeEach(async () => {
        await resetLocalState()
        clearStructuredLog()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('AC3 落库抛错 ⇒ journal 0 条、本地行无部分写入、队列保留、错误面可见、日志无业务值；重试后收敛', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        // 远端时间戳更晚 ⇒ 现状落「远端胜」分支（该分支确实写库，失败注入才会生效）
        await patchLocal(id, { name: 'B-name' })
        server.setRemote(id, { description: 'A-desc' }, FUTURE_REMOTE_TS)

        // 落库失败注入：合并路径无论走 `put` 还是 `update` 都必须被拦住（实现无关）
        const boom = new Error('storage-failed')
        vi.spyOn(localDatabase.tasks, 'put').mockRejectedValueOnce(boom)
        vi.spyOn(localDatabase.tasks, 'update').mockRejectedValueOnce(boom)

        const result = await makeService(server).pullAll()

        // ① 不写半成品：不得留下「已裁决但未落库」的记录
        expect(await readJournal()).toHaveLength(0)
        // ② 本地行原样（我的名称还在、云端描述未被部分写入）
        const local = await readLocal(id)
        expect(local.name).toBe('B-name')
        expect(local.description).toBe('A0-desc')
        // ③ 队列保留（下轮可重来）
        expect(await countQueue()).toBe(1)
        // ④ 既有错误面：运行失败可见（非静默成功）
        expect(result.ok).toBe(false)
        // ⑤ 结构化日志不含明文业务值
        const logs = JSON.stringify(readStructuredLog())
        expect(logs).not.toContain('B-name')
        expect(logs).not.toContain('A0-desc')
        expect(logs).not.toContain('A-desc')

        // 重试（故障消失）⇒ 合并收敛，两端字段都在、仍 0 条
        await makeService(server).pullAll()
        expect(await readJournal()).toHaveLength(0)
        expect((await readLocal(id)).name).toBe('B-name')
        expect((await readLocal(id)).description).toBe('A-desc')
    })
})