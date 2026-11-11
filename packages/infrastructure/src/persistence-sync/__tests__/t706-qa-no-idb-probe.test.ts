// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { countAudit, loadAudit, pruneAuditLog, recordAudit } from '../audit-log'

/**
 * T706 · M6 修复复核 ①：**无 IndexedDB 环境**（node / 库未初始化）下
 * 审计读写与启动裁切**不得产生 unhandled rejection**
 *
 * 复现口径（与 M6 门禁抓到的一致）：
 * - 本文件**不加载** `fake-indexeddb`（node 环境本就没有 `indexedDB`）；
 * - 触发点 = 启动路径的 `void pruneAuditLog(uid)`（`bootstrap-local-data.ts` 同姿势）+
 *   `recordAudit` / `loadAudit` / `countAudit`；
 * - 断言：**全部 resolve**（`prune` ⇒ 0、`record` ⇒ null、`count` ⇒ 0、`load` ⇒ `unavailable:true`），
 *   且在防抖窗口（>500ms）内 `process` 上**零** `unhandledRejection`。
 *
 * ⛔ 只观察行为，不看代码推定（PM T706 要求）。
 */

const USER_ID = 't706-no-idb-user'

/**
 * `process` 的类型面（本仓刻意不引 `@types/node`，见 AGENTS.md：会把 `setTimeout` 染成 `Timeout`）
 * @description 只声明本文件用到的最小形状，经 `globalThis` 安全取值。
 */
interface ProcessLike {
    on: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void
    off: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void
}

const nodeProcess = (globalThis as unknown as { process?: ProcessLike }).process

const captured: unknown[] = []
const onUnhandled = (reason: unknown): void => {
    captured.push(reason)
}

beforeEach(() => {
    captured.length = 0
    expect(nodeProcess, 'node 环境应存在 process（否则本探针无效）').toBeTruthy()
    nodeProcess!.on('unhandledRejection', onUnhandled)
})

afterEach(() => {
    nodeProcess!.off('unhandledRejection', onUnhandled)
})

describe('T706 / M6 修复 ①：无 IndexedDB 环境零 unhandled rejection', () => {
    it('启动裁切 `void pruneAuditLog(uid)` + 三个读写入口 ⇒ 全部安全降级且无未处理拒绝', async () => {
        // 前置自检：本环境确实没有 IndexedDB（否则本例无意义）
        expect((globalThis as { indexedDB?: unknown }).indexedDB).toBeUndefined()

        // ① 启动路径同姿势（`void` = 无人 await，一旦 reject 就是 unhandled）
        void pruneAuditLog(USER_ID)

        // ② 写入口：无库 ⇒ 按不可用处理（null），⛔ 不抛
        await expect(
            recordAudit({
                entityId: 'no-idb-task',
                action: 'update',
                source: 'local-edit',
                fields: []
            })
        ).resolves.toBeNull()

        // ③ 读入口：不可用态（不报错）
        await expect(loadAudit('no-idb-task')).resolves.toEqual({
            items: [],
            hasMore: false,
            unavailable: true
        })

        // ④ 等过审计防抖窗口（500ms）+ 一个宏任务，收集期间任何未处理拒绝
        await new Promise((resolve) => setTimeout(resolve, 700))
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(captured, '无 IndexedDB 环境不得产生 unhandled rejection').toHaveLength(0)
    })

    /**
     * 已知缺口（T706 独立复验发现，**P3 / 当前无生产调用点**）：
     * `countAudit` 只判了 `hasAuditTable()`（schema 已声明 ⇒ true），没有兜住 `MissingAPIError`
     * ⇒ 无 IndexedDB 环境下会 **reject**。`pruneAuditLog` / `recordAudit` / `loadAudit` 三处都已兜住，
     * 唯此处不对称。⛔ 本档不改生产代码 ⇒ 用 `it.fails` 锁住现状（**修复后本用例会失败**，届时改为普通 `it`）。
     */
    it.fails('已知缺口（P3）：countAudit 在无 IndexedDB 环境下未兜底 ⇒ MissingAPIError', async () => {
        await expect(countAudit(USER_ID)).resolves.toBe(0)
    })
})