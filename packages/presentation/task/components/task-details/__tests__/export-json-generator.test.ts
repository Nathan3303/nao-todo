import { describe, expect, it } from 'vite-plus/test'
import { generateTaskJson } from '../export-json'
import type { ExportTaskNode } from '../export-markdown'

/**
 * TASK-22 T94 —— JSON 渲染器纯函数断言（PRD §5.3 / AC2 / AC4）
 * @description 契约（PRD §5.3）：
 *  - 签名 `generateTaskJson(root, exportedAt) -> string`；纯函数、无 Vue / i18n / I/O；
 *  - **固定全量 schema**：空值标量/时间 → `null`（空字符串归一为 `null`），空数组 → `[]`；
 *  - 时间原样保留 ISO 字符串（不做 `YYYY-MM-DD HH:mm` 展示格式化）；
 *  - `description` 保留原始换行（机器口径不折叠）；
 *  - 递归字段名为 `subTasks`（源内部字段 `children`）；
 *  - `JSON.stringify(payload, null, 2)` + 末尾换行；
 *  - `exportedAt` 由调用方注入 ⇒ 可确定性断言。
 *
 * ⚠️ 用例先行：本文件对 T95 尚未落地的实现断言（新增类型字段 / `export-json` 模块）。
 *    当前预期红——失败原因属「契约未实现」，非用例自身错误。
 */

const EXPORTED_AT = '2026-09-23T02:30:00.000Z'

/**
 * 构造任务节点（含 T95 新增的 additive 字段 id / priority / isGivenUp / projectId / tagIds）
 * @description additive 扩展必须为**可选**，否则 TASK-13 既有断言文件的节点字面量会编译失败。
 */
const makeNode = (overrides: Partial<ExportTaskNode> = {}): ExportTaskNode => ({
    id: 'node-1',
    name: '任务',
    state: 'todo',
    stateLabel: '待办',
    priority: 'low',
    priorityLabel: '低',
    isGivenUp: false,
    startAt: null,
    endAt: null,
    projectId: null,
    projectName: '',
    tagIds: [],
    tagNames: [],
    createdAt: '2026-09-19T02:00:00.000Z',
    updatedAt: '2026-09-19T03:00:00.000Z',
    description: '',
    checkItems: [],
    children: [],
    ...overrides
})

describe('generateTaskJson - 固定全量 schema（§5.3）', () => {
    it('输出完整 schema：formatVersion/exportedAt/task 全字段（含本地化 label 与原始枚举）', () => {
        const root = makeNode({
            id: 'a1b2c3d4-0000-0000-0000-000000000000',
            name: '示例任务',
            state: 'in-progress',
            stateLabel: '进行中',
            priority: 'high',
            priorityLabel: '高',
            isGivenUp: false,
            startAt: '2026-09-20T01:00:00.000Z',
            endAt: '2026-09-20T10:00:00.000Z',
            projectId: 'p-1',
            projectName: '工作',
            tagIds: ['t-1'],
            tagNames: ['重要'],
            createdAt: '2026-09-19T02:00:00.000Z',
            updatedAt: '2026-09-19T03:00:00.000Z',
            description: '原始描述\n保留换行',
            checkItems: [{ name: '检查项一', isDone: true }],
            children: []
        })

        const parsed = JSON.parse(generateTaskJson(root, EXPORTED_AT)) as {
            formatVersion: number
            exportedAt: string
            task: Record<string, unknown>
        }

        expect(parsed).toEqual({
            formatVersion: 1,
            exportedAt: EXPORTED_AT,
            task: {
                id: 'a1b2c3d4-0000-0000-0000-000000000000',
                name: '示例任务',
                state: 'in-progress',
                stateLabel: '进行中',
                priority: 'high',
                priorityLabel: '高',
                isGivenUp: false,
                startAt: '2026-09-20T01:00:00.000Z',
                endAt: '2026-09-20T10:00:00.000Z',
                projectId: 'p-1',
                projectName: '工作',
                tagIds: ['t-1'],
                tagNames: ['重要'],
                createdAt: '2026-09-19T02:00:00.000Z',
                updatedAt: '2026-09-19T03:00:00.000Z',
                description: '原始描述\n保留换行',
                checkItems: [{ name: '检查项一', isDone: true }],
                subTasks: []
            }
        })
    })

    it('缩进 2 空格 + 末尾换行；递归字段名为 subTasks 而非内部 children', () => {
        const out = generateTaskJson(makeNode({ name: '缩进' }), EXPORTED_AT)

        expect(out.endsWith('\n')).toBe(true)
        expect(out).toContain('\n  "formatVersion": 1,')
        expect(out).toContain('\n  "task": {')
        expect(out).toContain('\n    "name": "缩进",')
        expect(out).not.toContain('"children"')
        expect(out).toContain('"subTasks": []')
    })

    it('相同输入 + 相同 exportedAt ⇒ 逐字符一致的确定性输出', () => {
        const root = makeNode({ name: '确定性', description: 'x\ny' })
        expect(generateTaskJson(root, EXPORTED_AT)).toBe(generateTaskJson(root, EXPORTED_AT))
    })
})

describe('generateTaskJson - 空值语义（§5.3 / AC4）', () => {
    it('空字符串标量归一为 null，空数组输出 []，isGivenUp=false 保持布尔', () => {
        const root = makeNode({
            id: '',
            state: '',
            stateLabel: '',
            priority: '',
            priorityLabel: '',
            isGivenUp: false,
            startAt: null,
            endAt: null,
            projectId: null,
            projectName: '',
            tagIds: [],
            tagNames: [],
            description: '',
            checkItems: [],
            children: []
        })

        const parsed = JSON.parse(generateTaskJson(root, EXPORTED_AT)) as {
            task: Record<string, unknown>
        }

        expect(parsed.task).toMatchObject({
            id: null,
            state: null,
            stateLabel: null,
            priority: null,
            priorityLabel: null,
            isGivenUp: false,
            startAt: null,
            endAt: null,
            projectId: null,
            projectName: null,
            tagIds: [],
            tagNames: [],
            description: null,
            checkItems: [],
            subTasks: []
        })
    })

    it('legacy 节点缺省 additive 字段 ⇒ 标量 null / 数组 []（键不省略）', () => {
        // 只给 TASK-13 既有必填字段，模拟未扩展的旧节点
        const legacy: ExportTaskNode = {
            name: '旧节点',
            state: 'todo',
            stateLabel: '待办',
            priorityLabel: '低',
            startAt: null,
            endAt: null,
            createdAt: '2026-09-19T02:00:00.000Z',
            updatedAt: '2026-09-19T03:00:00.000Z'
        }

        const parsed = JSON.parse(generateTaskJson(legacy, EXPORTED_AT)) as {
            task: Record<string, unknown>
        }

        expect(parsed.task).toMatchObject({
            id: null,
            priority: null,
            projectId: null,
            projectName: null,
            tagIds: [],
            tagNames: [],
            description: null,
            checkItems: [],
            subTasks: []
        })
        expect(Object.keys(parsed.task)).toEqual([
            'id',
            'name',
            'state',
            'stateLabel',
            'priority',
            'priorityLabel',
            'isGivenUp',
            'startAt',
            'endAt',
            'projectId',
            'projectName',
            'tagIds',
            'tagNames',
            'createdAt',
            'updatedAt',
            'description',
            'checkItems',
            'subTasks'
        ])
    })

    it('时间保持原始 ISO 字符串（不套用展示格式化）', () => {
        const out = generateTaskJson(
            makeNode({
                startAt: '2026-09-20T01:00:00.000Z',
                endAt: '2026-09-20T10:00:00.000Z',
                createdAt: '2026-09-19T02:00:00.000Z',
                updatedAt: '2026-09-19T03:00:00.000Z'
            }),
            EXPORTED_AT
        )

        expect(out).toContain('"startAt": "2026-09-20T01:00:00.000Z"')
        expect(out).toContain('"createdAt": "2026-09-19T02:00:00.000Z"')
        expect(out).not.toContain('2026-09-20 09:00')
    })

    it('description 保留原始换行（JSON 转义为 \\n，解析后还原）', () => {
        const out = generateTaskJson(makeNode({ description: '第一行\n第二行' }), EXPORTED_AT)
        const parsed = JSON.parse(out) as { task: { description: string } }

        expect(out).toContain('第一行\\n第二行')
        expect(parsed.task.description).toBe('第一行\n第二行')
    })
})

describe('generateTaskJson - 子任务递归（§5.3）', () => {
    it('多层子任务逐层写入 subTasks，字段名一致', () => {
        const root = makeNode({
            name: '根',
            children: [
                makeNode({
                    id: 'c1',
                    name: '子 1',
                    children: [makeNode({ id: 'g1', name: '孙 1' })]
                })
            ]
        })

        const parsed = JSON.parse(generateTaskJson(root, EXPORTED_AT)) as {
            task: { name: string; subTasks: { name: string; subTasks: { name: string }[] }[] }
        }

        expect(parsed.task.subTasks[0]!.name).toBe('子 1')
        expect(parsed.task.subTasks[0]!.subTasks[0]!.name).toBe('孙 1')
    })

    it('子任务数组为空 ⇒ 输出 []（不省略键）', () => {
        const out = generateTaskJson(makeNode({ children: [] }), EXPORTED_AT)
        expect(out).toContain('"subTasks": []')
    })
})