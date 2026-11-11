// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { taskRecordToEntity } from '../../persistence-local/converters/task'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import {
    clearAudit,
    readAudit,
    resetAuditState,
    structuredEvents,
    structuredLogRaw
} from './t697-audit-harness'
import { makeTaskVO } from '../../persistence-local/__tests__/local-repos-test-helpers'

/**
 * T697 / A 档 M0 —— **AC4 审计写失败不阻断业务（R-1 旁路）**
 *
 * 契约（PRD AC4 / ADR D-决策 3 / 既有 `recordEditOverwrite` 同姿势）：
 * ① `auditLogs.add` 抛错 ⇒ **业务保存仍成功**（`GoAsync` 返回 `null`）且行**已落库**（⛔ 不回滚）；
 * ② 失败必须**可观测**：`STRUCTURED_LOG_EVENTS.AUDIT_RECORD_FAILED`（值 `audit.record.failed`）+ error 级别；
 * ③ 日志**不含业务值**（任务名/描述一律不得出现在日志里）；
 * ④ `recordAudit` 自身**永不 reject**（调用点无需 try/catch 也不会污染保存路径）。
 *
 * 失败注入方式：`Dexie.Table.prototype.add` 按表名过滤 mock（只让 `auditLogs` 的 `add` 失败）
 * ⇒ 对「实现是用 `localDatabase.auditLogs.add` 还是 `db.table('auditLogs').add`」两种写法都生效，
 * 且业务写走 `put`（不受影响），不会把「注入失败」和「业务失败」混在一起。
 * @see docs/prds/2026-11-10-audit-log.md（AC4 / R-1 / 指标 3）
 */

const AUDIT_FAILED_EVENT = 'audit.record.failed'
const TASK_NAME = 'AUDIT-SECRET-任务名-7f3a'
const TASK_DESC = 'AUDIT-SECRET-描述-9c1b'

const seedTask = async (): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(
        makeTaskVO({ name: TASK_NAME, description: TASK_DESC })
    )
    expect(err).toBeNull()
    // 清掉 create 产生的审计（夹具噪声；本文件只断言「改」的审计行为）
    await clearAudit()
    return task!.id
}

const patchName = async (id: string, name: string): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    vo.name = name
    expect(await newLocalTaskRepository().update(id, vo)).toBeNull()
}

/** 只让审计表的 `add` 失败 */
const breakAuditAdd = (): ReturnType<typeof vi.spyOn> => {
    // ⚠️ `Dexie.Table` 不是可靠静态导出（ESM 构建下为 `undefined`）；用真实表实例取原型，
    // 这样 `db.table('auditLogs').add(...)` 与 `localDatabase.auditLogs.add(...)` 两种写法都会命中。
    const prototype = Object.getPrototypeOf(localDatabase.tasks) as {
        add: (...args: unknown[]) => Promise<unknown>
    }
    const original = prototype.add
    return vi.spyOn(prototype, 'add').mockImplementation(function (
        this: { name: string },
        ...args: unknown[]
    ) {
        if (this.name === 'auditLogs') {
            return Promise.reject(new Error('QuotaExceededError: audit add failed'))
        }
        return original.apply(this, args)
    } as never)
}

describe('T697 / AC4 审计写失败 ⇒ 业务不阻断 + 失败可观测 + 不含业务值', () => {
    beforeEach(resetAuditState)

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('add 抛错 ⇒ 保存返回 null、行已落库、无审计条目、error 级 audit.record.failed', async () => {
        const id = await seedTask()
        breakAuditAdd()

        await patchName(id, 'B1-after-audit-failure')

        // ① 业务保存成功且真的落库（⛔ 不得因旁路失败回滚）
        const record = await localDatabase.tasks.get(id)
        expect(record).toBeTruthy()
        expect((await taskRecordToEntity(record!)).name).toBe('B1-after-audit-failure')
        // 失败 ⇒ 没有审计条目（不是「半条」）
        expect(await readAudit()).toHaveLength(0)

        // ② 可观测：固定事件名 + error 级别
        const events = structuredEvents()
        expect(events, '审计失败必须有结构化 error 事件（AC4/AC16）').toContain(AUDIT_FAILED_EVENT)
        const failed = structuredLogRaw().filter(
            (entry) => String(entry.event) === AUDIT_FAILED_EVENT
        )
        expect(failed).toHaveLength(1)
        expect(failed[0]!.level).toBe('error')
        // 定位信息（entity/entityId/原因）齐备；PRD 写「entity」，ADR 写 `table` ⇒ 两者任一即可
        const fields = failed[0]!.fields ?? {}
        expect(fields.entityId ?? fields.id).toBe(id)
        expect(JSON.stringify(fields.entity ?? fields.table ?? '')).toContain('task')
        expect(JSON.stringify(fields.reason ?? '')).not.toBe('""')

        // ③ 日志不含业务值（⛔ 不得落任务名/描述）
        const serialized = JSON.stringify(structuredLogRaw())
        expect(serialized).not.toContain(TASK_NAME)
        expect(serialized).not.toContain(TASK_DESC)
        expect(serialized).not.toContain('B1-after-audit-failure')
    })

    it('失败后可继续写：下一次保存仍成功（旁路失败不留下坏状态）', async () => {
        const id = await seedTask()
        breakAuditAdd()
        await patchName(id, 'B1-first-fail')
        vi.restoreAllMocks()

        await patchName(id, 'B1-second-ok')

        const record = await localDatabase.tasks.get(id)
        expect((await taskRecordToEntity(record!)).name).toBe('B1-second-ok')
        // 恢复注入后审计照常工作（证明失败不污染后续路径）
        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        expect(entries[0]!.fields).toEqual([
            { field: 'name', from: 'B1-first-fail', to: 'B1-second-ok' }
        ])
    })
})