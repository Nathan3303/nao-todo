import { describe, expect, it } from 'vite-plus/test'
import {
    KNOWN_UNSUPPORTED_PUSH_FIELDS,
    isKnownUnsupportedPushField,
    pickUnexpectedDroppedFields
} from '../dropped-fields'
import { SYNC_TABLES } from '../sync-service'

/**
 * T471 / DEF-44：客户端消费 `SyncResult.droppedFields`，区分「真·契约漂移」与「已知不支持字段」。
 *
 * 本文件覆盖：
 * - 逐条挑拣助手（白名单过滤 / 去重排序 / 缺省与脏值 no-op）；
 * - **防漂移契约镜像**：`客户端发送集 − 服务端 sync DTO 承载集 === 白名单`（精确相等 ⇒ 双向校验：
 *   白名单多写（服务端已承载）或漏写（客户端新发字段）都会红）。
 */

/**
 * 服务端 sync 条目 DTO 的**承载键集契约镜像**（不变量 `baseUpdatedAt` 由服务层追加、非 entityToPush 产出，故不含）。
 * @description 来源 = `nao-todo-server/interfaces/types/{sync,task,project,tag,pomodoro}.go` 的 json tag
 *              （服务端自身以**反射**求同集，见 `interfaces/controllers/sync_dropped_fields.go`）。
 *              ⚠️ 服务端补承载字段时**必须**同步此镜像 ⇒ 下面的相等断言会失败，直到白名单同步收敛。
 */
const SERVER_CARRIED: Record<string, ReadonlySet<string>> = {
    projects: new Set([
        'id',
        'name',
        'description',
        'createdAt',
        'updatedAt',
        'deletedAt',
        'archivedAt',
        'deactivedAt'
    ]),
    tags: new Set(['id', 'name', 'description', 'color', 'createdAt', 'updatedAt', 'deletedAt']),
    tasks: new Set([
        'id',
        'parentTaskId',
        'name',
        'description',
        'state',
        'priority',
        'startAt',
        'endAt',
        'projectId',
        'tags',
        'archivedAt',
        'starMarkAt',
        'givenUpAt',
        'remindAt',
        'remindRepeat',
        'remindTime',
        'remindWeekdays',
        'sortId',
        'createdAt',
        'updatedAt',
        'deletedAt'
    ]),
    taskCheckItems: new Set([
        'id',
        'taskId',
        'name',
        'description',
        'createdAt',
        'updatedAt',
        'isDone',
        'sortId'
    ]),
    taskComments: new Set(['id', 'taskId', 'content', 'createdAt', 'updatedAt']),
    pomodoros: new Set([
        'id',
        'type',
        'name',
        'description',
        'duration',
        'createdAt',
        'updatedAt',
        'deletedAt',
        'archivedAt'
    ]),
    pomodoroRecords: new Set([
        'id',
        'sessionId',
        'pomodoroId',
        'type',
        'taskId',
        'taskName',
        'description',
        'startAt',
        'endAt',
        'duration',
        'note',
        'createdAt',
        'updatedAt'
    ])
}

/** 以「万能实体」跑 `entityToPush`，取该表客户端真正会发送的键集 */
const sentKeysOf = (table: string): Set<string> => {
    const config = SYNC_TABLES.find((c) => c.table === table)
    if (!config) throw new Error(`未配置的同步表: ${table}`)
    // 任意键取真值 ⇒ 覆盖所有 `record[field] = entity[field]` 分支（含 `if (!record.sortId)` 真值守卫）
    const entity = new Proxy({}, { get: () => 1 }) as Record<string, unknown>
    return new Set(Object.keys(config.entityToPush(entity)))
}

describe('T471 挑拣助手', () => {
    it('非白名单字段被挑出；去重 + 字典序', () => {
        expect(pickUnexpectedDroppedFields(['someNewField'], 'tasks')).toEqual(['someNewField'])
        expect(pickUnexpectedDroppedFields(['b', 'a', 'b'], 'tasks')).toEqual(['a', 'b'])
        // projects 的 icon/sortId 属白名单 ⇒ 只剩 someNewField
        expect(pickUnexpectedDroppedFields(['icon', 'someNewField', 'sortId'], 'projects')).toEqual(
            ['someNewField']
        )
    })

    it('缺省 / 非数组 / 空 / 脏项 ⇒ no-op（旧服务端无该字段）', () => {
        expect(pickUnexpectedDroppedFields(undefined, 'tasks')).toEqual([])
        expect(pickUnexpectedDroppedFields(null, 'tasks')).toEqual([])
        expect(pickUnexpectedDroppedFields('nope', 'tasks')).toEqual([])
        expect(pickUnexpectedDroppedFields([], 'tasks')).toEqual([])
        expect(pickUnexpectedDroppedFields([1, '', null, 'ok'], 'tasks')).toEqual(['ok'])
    })

    it('白名单命中判定（含未知表 ⇒ 非已知）', () => {
        expect(isKnownUnsupportedPushField('projects', 'icon')).toBe(true)
        expect(isKnownUnsupportedPushField('taskCheckItems', 'deletedAt')).toBe(true)
        expect(isKnownUnsupportedPushField('projects', 'name')).toBe(false)
        expect(isKnownUnsupportedPushField('unknown-table', 'icon')).toBe(false)
    })
})

describe('T471 防漂移：客户端发送集 − 服务端承载集 === 白名单（精确相等）', () => {
    it('逐表双向校验（白名单多写 / 漏写均会红）', () => {
        for (const { table } of SYNC_TABLES) {
            const sent = sentKeysOf(table)
            const carried = SERVER_CARRIED[table]
            if (!carried) throw new Error(`缺少服务端承载集契约镜像: ${table}`)

            // 只校验「客户端在发、服务端不承载」的差集（服务端可承载客户端未发的字段，不影响丢弃集）
            const dropped = [...sent].filter((field) => !carried.has(field)).sort()
            const whitelist = [...(KNOWN_UNSUPPORTED_PUSH_FIELDS[table] ?? [])].sort()
            expect(dropped, `白名单与服务端契约不一致: ${table}`).toEqual(whitelist)
        }
    })
})