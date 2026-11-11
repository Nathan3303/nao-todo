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
    it('四个入口（record / load / count / prune）全部安全降级 + 0 unhandled rejection', async () => {
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

        // ③ 读入口：不可用态（不报错）—— record / load / count / prune 四入口全覆盖
        await expect(countAudit(USER_ID)).resolves.toBe(0)
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
     * 原缺口（`T706` 复验发现，**P3 / 当时无生产调用点**）：`countAudit` 未兜住 `MissingAPIError`
     * ⇒ 无 IndexedDB 环境会 **reject**（其余三入口早已兜住，唯此处不对称）。
     * `T707`（`6f9ead2e`）已修 ⇒ 本用例从 **`it.fails` 改回正常断言**（`T708`）。
     *
     * 改前 / 改后证据（同一条断言 `resolves.toBe(0)`）：
     * - **改前**（HEAD `006819ad`）：**reject** `MissingAPIError: IndexedDB API missing` ⇒ `it.fails` 通过；
     *   本次复验用「临时回退 `countAudit` 实现（含 `sha256sum -c` 逐字节还原）」重放，红因仍是该异常；
     * - **改后**（HEAD `6f9ead2e`）：同一断言 **resolves 0**（显式 userId + 缺省参数两路径）⇒ 本 `it` 绿。
     */
    it('countAudit 在无 IndexedDB 环境下按不可用返回 0（T707 修复回归守卫）', async () => {
        await expect(countAudit(USER_ID)).resolves.toBe(0)
        // 缺省参数路径同样不得抛（无会话 ⇒ 0）
        await expect(countAudit()).resolves.toBe(0)
    })
})