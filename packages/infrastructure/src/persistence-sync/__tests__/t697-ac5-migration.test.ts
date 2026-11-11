// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import Dexie from 'dexie'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { AUDIT_PAGE_SIZE, loadAudit, recordAudit } from '../audit-log'
import { countAudit, requireAuditTable, tableNames, USER_ID } from './t697-audit-harness'

/**
 * T697 / A 档 M0 —— **AC5 迁移 + 降级路径实测（⛔ 不许只靠文档推定）**
 *
 * 真源：PRD AC5 / ADR D1（同库新表 + `version(5)` 只增表、不写 `.upgrade()`）/
 * T696 §2.3（空升级 = 幂等）· §2.4（产品回滚三级）· PM T697 Q3 裁定（等价法 + 四条硬断言）。
 *
 * 等价法（伪 IndexedDB 下没有「旧构建」可装）：
 * ① 测试内定义 **v4 Dexie 子类**（照抄 v4 的 **15 张表 stores**，⛔ 不得只照抄部分表）
 *    → 建 v4 库 + 写 3 行 tasks（`plain:` 形态，便于逐字节比较）
 * ② 用项目 v5 类（`localDatabase`）打开 ⇒ `verno===5` · `auditLogs` 存在且空 ·
 *    tasks 三行逐字段相同 · **其余 14 表 stores 未变**
 * ③ close 后再用 v4 子类打开同库 ⇒ `dexie@4.4.5` 静默适配：可开 · `verno===4` ·
 *    tasks 可读 · `auditLogs` **不可见**（且不抛错）
 * ④ 全程记录 `verno` 数值（不只断言「能开」）
 * @see docs/prds/2026-11-10-audit-log.md（AC5 / §八 回滚）
 * @see docs/adr/2026-11-10-audit-log-bypass-log.md（决策 1 / 后果与风险 2 / 参考来源 1）
 */

const DB_NAME = 'nao-todo-desktop'

/** v4 的 15 张表 stores（逐字照抄 `local-database.ts` 的 `version(4)` 块） */
const V4_STORES: Record<string, string> = {
    projects: '&id, userId, deletedAt, archivedAt',
    projectPreferences: '&id, userId, projectId',
    tags: '&id, userId, deletedAt',
    tagPreferences: '&id, userId, tagId',
    tasks: '&id, userId, parentTaskId, projectId, state, startAt, endAt, archivedAt, starMarkAt, givenUpAt, remindAt, deletedAt',
    taskCheckItems: '&id, userId, taskId',
    taskComments: '&id, userId, taskId',
    pomodoros: '&id, userId, archivedAt, deletedAt',
    pomodoroRecords: '&id, userId, sessionId, pomodoroId, taskId, startAt, endAt',
    users: '&id, userId',
    userConfigs: '&id, userId',
    meta: '&id',
    deletionSchedules: '&id',
    syncQueue: '&id, userId, table, retryCount',
    syncCursor: '&id, userId'
}

class V4Database extends Dexie {
    constructor() {
        super(DB_NAME)
        this.version(4).stores(V4_STORES)
    }
}

/**
 * 表结构指纹（断言「其余 14 表 stores 未变」）
 * @description 用结构类型而非 `Dexie<T>` 泛型（后者对 15+ 表实例会触发 TS2589 过深实例化）
 */
interface SchemaCarrier {
    tables: ReadonlyArray<{
        name: string
        schema: {
            primKey: { keyPath?: string | string[] | null; name?: string | null }
            indexes: ReadonlyArray<{ name: string | null }>
        }
    }>
}

const schemaOf = (db: SchemaCarrier): Record<string, { primKey: string; indexes: string[] }> =>
    Object.fromEntries(
        db.tables.map((table) => [
            table.name,
            {
                primKey: String(table.schema.primKey.keyPath ?? table.schema.primKey.name ?? ''),
                indexes: table.schema.indexes.map((index) => String(index.name))
            }
        ])
    )

const legacyTaskRow = (id: string, name: string) => ({
    id,
    userId: USER_ID,
    parentTaskId: '',
    name: `plain:${name}`,
    description: 'plain:旧描述',
    state: 'todo',
    priority: 'medium',
    startAt: '',
    endAt: '',
    projectId: 'project-legacy',
    tags: [],
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: '',
    remindRepeat: 'none',
    remindTime: '',
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0,
    sortId: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
})

const LEGACY_ROWS = [
    legacyTaskRow('legacy-1', '老任务一'),
    legacyTaskRow('legacy-2', '老任务二'),
    legacyTaskRow('legacy-3', '老任务三')
]

let v4Db: V4Database | null = null
let v4SchemaBefore: Record<string, { primKey: string; indexes: string[] }> = {}

/** 造「老库（v4，无审计表）」并记录 v4 结构指纹 */
const seedLegacyDatabase = async (): Promise<void> => {
    localDatabase.close()
    await Dexie.delete(DB_NAME)
    v4Db = new V4Database()
    await v4Db.open()
    expect(v4Db.verno, '夹具自检：必须以 v4 建库').toBe(4)
    expect(v4Db.tables.map((table) => table.name)).not.toContain('auditLogs')
    await v4Db.table('tasks').bulkPut(LEGACY_ROWS)
    v4SchemaBefore = schemaOf(v4Db)
    v4Db.close()
    v4Db = null
}

beforeEach(async () => {
    await seedLegacyDatabase()
})

afterEach(async () => {
    v4Db?.close()
    v4Db = null
    localDatabase.close()
    await Dexie.delete(DB_NAME)
})

describe('T697 / AC5 v4 → v5 迁移：只增表 + 业务数据零变化 + 历史空', () => {
    it('老库升级 ⇒ verno=5 + auditLogs 存在且空 + tasks 三行逐字段相同 + 其余 14 表结构未变', async () => {
        await localDatabase.open()

        // ① 版本号（⛔ 不只断言「能开」）
        expect(localDatabase.verno, 'version(5) 必须真的生效（ADR D1）').toBe(5)
        // ② 新表存在且为空（老数据无审计）
        expect(tableNames()).toContain('auditLogs')
        expect(await countAudit()).toBe(0)
        requireAuditTable()
        // ③ 业务数据零变化（逐字段比较原始行；迁移不得改写既有行）
        const rows = await localDatabase.tasks.bulkGet(LEGACY_ROWS.map((row) => row.id))
        expect(rows).toEqual(LEGACY_ROWS)
        // ④ 既有 14 表 stores 未变（v4 全表清单逐字保留，只追加 auditLogs）
        const after = schemaOf(localDatabase)
        for (const [name, schema] of Object.entries(v4SchemaBefore)) {
            expect(after[name], `表 ${name} 必须保留（v4 清单逐字不改）`).toEqual(schema)
        }
        expect(Object.keys(after).sort()).toEqual(
            [...Object.keys(v4SchemaBefore), 'auditLogs'].sort()
        )
    })

    it('读路径兜底：老数据无历史 ⇒ 读到 0 条且不抛错（UI 走「暂无记录」空态，⛔ 不显示错误）', async () => {
        await localDatabase.open()

        // 表恒存在（v5 打开后）⇒ 读空数组是正常结果，不是异常
        const entries = await requireAuditTable().toArray()
        expect(entries).toEqual([])
    })

    it('重复打开同一版本 ⇒ 幂等（不重复升级、不重复建表、数据不变）', async () => {
        await localDatabase.open()
        const firstVerno = localDatabase.verno
        localDatabase.close()
        await localDatabase.open()

        expect(localDatabase.verno).toBe(firstVerno)
        expect(await requireAuditTable().toArray()).toEqual([])
        expect(await localDatabase.tasks.bulkGet(LEGACY_ROWS.map((row) => row.id))).toEqual(
            LEGACY_ROWS
        )
    })
})

describe('T697 / AC5 降级路径实测：dexie@4.4.5 用旧版本打开新版本库', () => {
    it('v5 之后用 v4 子类打开 ⇒ 可开 + verno=4 + tasks 可读 + auditLogs 不可见（不抛错）', async () => {
        await localDatabase.open()
        expect(localDatabase.verno).toBe(5)
        localDatabase.close()

        v4Db = new V4Database()
        await v4Db.open()

        // ① 降级不是硬故障（旧代码可开库）
        expect(v4Db.verno, '降级打开后 verno 必须如实为 4').toBe(4)
        // ② 业务数据仍可读（回滚后用户数据不丢）
        expect(await v4Db.table('tasks').count()).toBe(LEGACY_ROWS.length)
        // ③ 新表对旧版本不可见（Dexie 静默适配：按已安装版本读 schema）
        expect(v4Db.tables.map((table) => table.name)).not.toContain('auditLogs')
        // ④ 旧版本 schema 与升级前逐字一致（无隐式结构漂移）
        expect(schemaOf(v4Db)).toEqual(v4SchemaBefore)
    })
})
describe('T697 / AC5 读接口 `loadAudit`（T699 补：不可用态 + keyset 分页，M1 新面）', () => {
    beforeEach(async () => {
        localSession.setCurrentUserId(USER_ID)
        await localDatabase.open()
    })

    it('表不可用（老库 / 旧版本连接）⇒ unavailable:true + items 空 + hasMore:false，且不抛错', async () => {
        // 复现「当前 schema 里没有 auditLogs」：Dexie 的 `tables` 只反映**已声明** schema
        // （close() 不会清空 `_allTables`）⇒ 用 getter 打桩走 `!hasAuditTable()` 分支。
        // 反例（本用例要抓的走偏）：实现用「空数组 + unavailable:false」冒充不可用 ⇒ 必红。
        const spy = vi.spyOn(localDatabase, 'tables', 'get').mockReturnValue([])
        try {
            await expect(loadAudit('task-unavailable')).resolves.toEqual({
                items: [],
                hasMore: false,
                unavailable: true
            })
        } finally {
            spy.mockRestore()
        }
    })

    it('keyset 分页：7 条 ⇒ 首页 5 条（seq 降序）+ hasMore=true；beforeSeq 取下一页 2 条 + hasMore=false（无重复无遗漏）', async () => {
        const entityId = 'task-paging'
        for (let index = 1; index <= 7; index += 1) {
            const seq = await recordAudit({
                entityId,
                action: 'update',
                source: 'local-edit',
                fields: [{ field: 'name', from: `v${index - 1}`, to: `v${index}` }]
            })
            expect(seq, `第 ${index} 条应写入成功（表可用）`).toBeTypeOf('number')
        }

        const first = await loadAudit(entityId, undefined, AUDIT_PAGE_SIZE)
        expect(first.unavailable).toBe(false)
        expect(first.items).toHaveLength(AUDIT_PAGE_SIZE)
        expect(first.hasMore).toBe(true)
        const firstSeqs = first.items.map((item) => item.seq)
        // seq 降序 = 最新在前（⛔ 不用 offset 分页）
        expect(firstSeqs).toEqual([...firstSeqs].sort((left, right) => right - left))

        const second = await loadAudit(entityId, firstSeqs[firstSeqs.length - 1], AUDIT_PAGE_SIZE)
        expect(second.items).toHaveLength(2)
        expect(second.hasMore).toBe(false)

        const allSeqs = [...firstSeqs, ...second.items.map((item) => item.seq)]
        expect(new Set(allSeqs).size, '分页不得重复').toBe(7)
        expect(allSeqs, '分页不得遗漏，且整体仍为 seq 降序').toEqual(
            [...allSeqs].sort((left, right) => right - left)
        )
    })
})