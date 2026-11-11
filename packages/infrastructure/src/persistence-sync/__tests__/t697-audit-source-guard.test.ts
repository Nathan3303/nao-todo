/// <reference types="vite/client" />
import { describe, expect, it } from 'vite-plus/test'

/**
 * T697 / A 档 M0 —— **源级守卫（AC17 值形状 / 唯一写入口 / 与冲突记账不得互相调用）**
 *
 * 三层守卫中的第 2、3 层（arch §5「三道守卫」/ §3.2-5）：
 * ① **值形状**：审计只存**实体明文**（同步边界），⛔ 不得 import `crypto-service` / `converters/*`，
 *    文件内不得出现 `PLAIN_PREFIX` 或 `'plain:'` 字面量（否则界面会出现「plain:买牛奶」，
 *    且记录层判等会让每次 pull 都判「文本字段变了」⇒ 与 `DEF-147` 叠加成永久刷屏）；
 * ② **唯一写入口**：全仓 `auditLogs` 的写法只允许出现在 `audit-log.ts`（`recordAudit` 是唯一门），
 *    否则「一次业务写 = 1 条」不可保证；
 * ③ **不得互调**：`conflict-journal.ts` **不得**调用 `recordAudit`（两者同源于同一次写 ⇒ 会变 2 条）。
 *
 * 手法：`import.meta.glob(?raw)`（同 `t675-write-point-source-guard.test.ts`）。
 * ⛔ 不用 `node:fs` —— 在本包引入 `@types/node` 会把 `setTimeout` 全局返回类型染成 `Timeout`，
 * 令 `t654/t655/t657`（自绘假定时器）整片报 TS 错。
 * @see docs/reports/T696-audit-log-arch-review.md（§3.2-5 / §5）
 */

const sources = import.meta.glob(
    ['/packages/infrastructure/src/**/*.ts', '!/packages/infrastructure/src/**/__tests__/**'],
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

const AUDIT_MODULE = '/packages/infrastructure/src/persistence-sync/audit-log.ts'
const JOURNAL_MODULE = '/packages/infrastructure/src/persistence-sync/conflict-journal.ts'

/** 取源文件（缺失 ⇒ 显式失败，⛔ 抛 ENOENT） */
const sourceOf = (path: string): string => {
    const source = sources[path]
    expect(source, `源级守卫：未找到 ${path}（M1 应新增该模块）`).toBeTruthy()
    return source as string
}

/** 全仓写 `auditLogs` 的位置（三种常见写法） */
const auditWriteSites = (): string[] =>
    Object.entries(sources)
        .filter(([, source]) =>
            /auditLogs'\s*\)\s*\.add\(|auditLogs\.add\(|auditLogs\.bulkAdd\(|auditLogs\.put\(/.test(
                source
            )
        )
        .map(([path]) => path)

describe('T697 / 源级守卫：审计模块（值形状 / 唯一写入口 / 不得互调）', () => {
    it('审计模块存在，且导出唯一写入口 recordAudit', () => {
        const source = sourceOf(AUDIT_MODULE)
        expect(source).toMatch(/export const recordAudit|export async function recordAudit/)
    })

    it('⛔ 不得 import crypto-service / converters（值必须取实体明文）', () => {
        const source = sourceOf(AUDIT_MODULE)
        expect(source).not.toContain('crypto-service')
        expect(source).not.toContain('persistence-local/converters')
    })

    it('⛔ 文件内不得出现 PLAIN_PREFIX 或 "plain:" 字面量（T676 重放）', () => {
        const source = sourceOf(AUDIT_MODULE)
        expect(source).not.toContain('PLAIN_PREFIX')
        expect(source).not.toContain('plain:')
    })

    it('全仓只有审计模块写 auditLogs 表（唯一写入口）', () => {
        expect(
            auditWriteSites(),
            'auditLogs 的写入只允许出现在 audit-log.ts（recordAudit 唯一门）'
        ).toEqual([AUDIT_MODULE])
    })

    it('冲突记账不得调用 recordAudit（同一次写变 2 条）', () => {
        const journal = sourceOf(JOURNAL_MODULE)
        expect(journal).not.toContain('recordAudit')
    })
})