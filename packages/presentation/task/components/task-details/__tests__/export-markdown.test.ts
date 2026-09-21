import { describe, expect, it } from 'vite-plus/test'
import {
    formatExportDateTime,
    generateTaskMarkdown,
    type ExportLabels,
    type ExportTaskNode
} from '../export-markdown'

/**
 * 导出 Markdown 纯函数断言（T21）
 * @description 覆盖主路径（名称/元信息/描述/检查项/子任务）、空段省略、递归缩进与时间格式化。
 *              时间一律使用无时区字面量（dayjs 按本地解析），避免断言受运行环境时区影响。
 */

const labels: ExportLabels = {
    state: '状态',
    priority: '优先级',
    startAt: '开始时间',
    endAt: '截止时间',
    project: '项目',
    tags: '标签',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    description: '描述',
    checkItems: '检查项',
    subTasks: '子任务'
}

const makeNode = (overrides: Partial<ExportTaskNode> = {}): ExportTaskNode => ({
    name: '任务 A',
    state: 'todo',
    stateLabel: '待办',
    priorityLabel: '高优先级',
    startAt: '2026-09-20 09:00:00',
    endAt: '2026-09-20 18:00:00',
    createdAt: '2026-09-19 08:00:00',
    updatedAt: '2026-09-19 20:00:00',
    ...overrides
})

describe('formatExportDateTime', () => {
    it('合法时间格式化为 YYYY-MM-DD HH:mm', () => {
        expect(formatExportDateTime('2026-09-20 09:05:00')).toBe('2026-09-20 09:05')
    })

    it('空值 / 非法值返回 null（供调用方省略整行）', () => {
        expect(formatExportDateTime(null)).toBeNull()
        expect(formatExportDateTime(undefined)).toBeNull()
        expect(formatExportDateTime('')).toBeNull()
        expect(formatExportDateTime('not-a-date')).toBeNull()
    })
})

describe('generateTaskMarkdown - 主路径', () => {
    it('输出标题、元信息、描述、检查项与递归子任务', () => {
        const md = generateTaskMarkdown(
            makeNode({
                projectName: '工作',
                tagNames: ['重要', '紧急'],
                description: '这是描述',
                checkItems: [
                    { name: '检查一', isDone: true },
                    { name: '检查二', isDone: false }
                ],
                children: [
                    makeNode({ name: '子任务 1', state: 'done' }),
                    makeNode({
                        name: '子任务 2',
                        state: 'todo',
                        children: [makeNode({ name: '孙任务', state: 'todo' })]
                    })
                ]
            }),
            labels
        )

        expect(md).toBe(
            [
                '# 任务 A',
                '',
                '- 状态：待办',
                '- 优先级：高优先级',
                '- 开始时间：2026-09-20 09:00',
                '- 截止时间：2026-09-20 18:00',
                '- 项目：工作',
                '- 标签：#重要 #紧急',
                '- 创建时间：2026-09-19 08:00',
                '- 更新时间：2026-09-19 20:00',
                '',
                '## 描述',
                '',
                '这是描述',
                '',
                '## 检查项',
                '',
                '- [x] 检查一',
                '- [ ] 检查二',
                '',
                '## 子任务',
                '',
                '- [x] 子任务 1',
                '- [ ] 子任务 2',
                '  - [ ] 孙任务',
                ''
            ].join('\n')
        )
    })
})

describe('generateTaskMarkdown - 空段省略', () => {
    it('无描述/检查项/子任务 ⇒ 对应段落整段省略（无空标题）', () => {
        const md = generateTaskMarkdown(
            makeNode({
                startAt: null,
                endAt: null,
                projectName: undefined,
                tagNames: [],
                description: '',
                checkItems: [],
                children: []
            }),
            labels
        )

        expect(md).toBe(
            [
                '# 任务 A',
                '',
                '- 状态：待办',
                '- 优先级：高优先级',
                '- 创建时间：2026-09-19 08:00',
                '- 更新时间：2026-09-19 20:00',
                ''
            ].join('\n')
        )
        expect(md).not.toContain('## 描述')
        expect(md).not.toContain('## 检查项')
        expect(md).not.toContain('## 子任务')
        expect(md).not.toContain('标签')
    })

    it('描述仅空白字符 ⇒ 整段省略；标签为空数组 ⇒ 省略标签行', () => {
        const md = generateTaskMarkdown(
            makeNode({ description: '   ', tagNames: [], checkItems: [], children: [] }),
            labels
        )
        expect(md).not.toContain('## 描述')
        expect(md).not.toContain('- 标签：')
    })
})

describe('generateTaskMarkdown - 子任务层级', () => {
    it('三层子任务按 2 空格/层缩进，复选框反映 done 状态', () => {
        const md = generateTaskMarkdown(
            makeNode({
                description: '',
                checkItems: [],
                children: [
                    makeNode({
                        name: 'L1',
                        state: 'done',
                        children: [
                            makeNode({
                                name: 'L2',
                                state: 'todo',
                                children: [makeNode({ name: 'L3', state: 'done' })]
                            })
                        ]
                    })
                ]
            }),
            labels
        )

        expect(md).toContain(['## 子任务', '', '- [x] L1', '  - [ ] L2', '    - [x] L3'].join('\n'))
    })
})