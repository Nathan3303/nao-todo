// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { clearStructuredLog, readStructuredLog } from '../../observability/structured-log'
import { conflictFieldCounts, loadConflictJournal } from '../conflict-journal'
import { syncStatus } from '../sync-status'
import {
    USER_ID,
    createSyncedTask,
    makeServer,
    makeService,
    patchLocal,
    readJournal,
    resetLocalState
} from './t675-field-merge-harness'

/**
 * T683 / B 批 M6 —— **可观测（PRD NFR）**
 *
 * 口径（M6 卡 / ADR「可观测」）：
 * - **合并次数**：`syncStatus.get().fieldMergeCount`（内存态累计，不落盘、不参与运行边界）
 *   + 结构化事件 `sync.field-merge.applied`（字段：`table` / `conflicts` 计数，**⛔ 不含业务值**）；
 * - **冲突次数（按字段）**：从 journal 条目读（`conflictFieldCounts`；每条目去重后各计 1）；
 * - ⛔ 不新增 UI 面 / 不新增持久化字段。
 */

describe('T683 / M6 合并次数（syncStatus + 结构化日志）', () => {
    beforeEach(async () => {
        await resetLocalState()
        clearStructuredLog()
    })

    it('reportFieldMerge 累加（<=0 不计数）', () => {
        const before = syncStatus.get().fieldMergeCount
        syncStatus.reportFieldMerge()
        syncStatus.reportFieldMerge(2)
        syncStatus.reportFieldMerge(0)
        syncStatus.reportFieldMerge(-1)
        expect(syncStatus.get().fieldMergeCount).toBe(before + 3)
    })

    it('pull 侧合并真正应用 ⇒ 计数 +1，且结构化事件不含业务值', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        const before = syncStatus.get().fieldMergeCount
        await makeService(server).pullAll()
        expect(syncStatus.get().fieldMergeCount).toBe(before + 1)

        const events = readStructuredLog().filter(
            (entry) => entry.event === 'sync.field-merge.applied'
        )
        expect(events).toHaveLength(1)
        const serialized = JSON.stringify(events)
        // 只含计数与表名，⛔ 不含业务值
        expect(serialized).toContain('tasks')
        expect(serialized).not.toContain('B-name')
        expect(serialized).not.toContain('A-desc')
        expect(serialized).not.toContain('A0-desc')
    })

    it('无冲突的纯合并也计数（journal 0 条 ⇒ 只能从状态面/日志读出）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })

        const before = syncStatus.get().fieldMergeCount
        await makeService(server).pullAll()

        expect(await readJournal()).toHaveLength(0)
        expect(syncStatus.get().fieldMergeCount).toBe(before + 1)
    })
})

describe('T683 / M6 冲突次数（按字段）', () => {
    beforeEach(resetLocalState)

    it('conflictFieldCounts：每条目去重后各计 1，缺省字段的旧条目不计入', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        await patchLocal(id, { name: 'B-name', priority: 'high' })
        server.setRemote(id, { description: 'A-desc', priority: 'low' })
        await makeService(server).pullAll()

        const entries = await loadConflictJournal(USER_ID)
        expect(conflictFieldCounts(entries)).toEqual({ priority: 1 })
    })

    it('同一字段在两条条目 ⇒ 计 2；重复字段在同一目内只算 1', () => {
        expect(
            conflictFieldCounts([
                { conflictFields: ['name', 'name'] },
                { conflictFields: ['name', 'priority'] },
                {}
            ])
        ).toEqual({ name: 2, priority: 1 })
    })
})