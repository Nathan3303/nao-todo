import { describe, expect, it } from 'vite-plus/test'
import {
    formatExportDateTime,
    generateTaskMarkdown,
    type ExportLabels,
    type ExportTaskNode
} from '../export-markdown'

/**
 * 导出 Markdown 纯函数断言（T21 基线 + T33 子任务丰富格式）
 * @description 覆盖根任务契约（名称/元信息/描述/检查项/子任务）、空段省略、时间格式化，
 *              以及 PRD §5.2「子任务输出」冻结基准：一级丰富（行内标量 + 属性子行）、
 *              ≥二级精简、空项/空括号省略、描述换行折叠。
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

describe('generateTaskMarkdown - 根任务主路径（契约不变）', () => {
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
                    makeNode({ name: '子任务 1', state: 'done', stateLabel: '已完成' }),
                    makeNode({
                        name: '子任务 2',
                        state: 'todo',
                        stateLabel: '待办',
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
                '- [x] 子任务 1（状态：已完成；优先级：高优先级；开始时间：2026-09-20 09:00；截止时间：2026-09-20 18:00）',
                '- [ ] 子任务 2（状态：待办；优先级：高优先级；开始时间：2026-09-20 09:00；截止时间：2026-09-20 18:00）',
                '  - [ ] 孙任务',
                ''
            ].join('\n')
        )
    })
})

describe('generateTaskMarkdown - 根任务空段省略（契约不变）', () => {
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

/**
 * PRD §5.2「完整拼接示例」为格式冻结基准，勿自行改格式。
 */
describe('generateTaskMarkdown - 子任务丰富格式（PRD §5.2 冻结基准）', () => {
    // 仅保留子任务段：根任务无描述/检查项/标量元信息
    const onlySubTasks = (children: ExportTaskNode[]) =>
        generateTaskMarkdown(
            makeNode({
                startAt: null,
                endAt: null,
                projectName: undefined,
                tagNames: [],
                description: '',
                checkItems: [],
                children
            }),
            labels
        )

    it('完整拼接示例：一级丰富（行内标量 + 属性子行），二级精简', () => {
        const md = onlySubTasks([
            makeNode({
                name: '子任务 1',
                state: 'done',
                stateLabel: '已完成',
                priorityLabel: '高',
                startAt: '2026-09-20 09:00:00',
                endAt: '2026-09-20 18:00:00',
                tagNames: ['重要'],
                description: '子任务描述',
                checkItems: [
                    { name: '检查项一', isDone: true },
                    { name: '检查项二', isDone: false }
                ]
            }),
            makeNode({
                name: '子任务 2',
                state: 'todo',
                stateLabel: '待办',
                priorityLabel: '低',
                startAt: null,
                endAt: null,
                tagNames: [],
                description: '',
                children: [
                    makeNode({
                        name: '孙任务',
                        state: 'todo',
                        stateLabel: '待办',
                        priorityLabel: '低',
                        startAt: '2026-09-20 09:00:00',
                        endAt: '2026-09-20 18:00:00',
                        tagNames: ['重要'],
                        description: '孙任务描述',
                        checkItems: [{ name: '孙检查项', isDone: true }]
                    })
                ]
            })
        ])

        expect(md).toContain(
            [
                '## 子任务',
                '',
                '- [x] 子任务 1（状态：已完成；优先级：高；开始时间：2026-09-20 09:00；截止时间：2026-09-20 18:00；标签：#重要）',
                '  - 描述：子任务描述',
                '  - 检查项：',
                '    - [x] 检查项一',
                '    - [ ] 检查项二',
                '- [ ] 子任务 2（状态：待办；优先级：低）',
                '  - [ ] 孙任务'
            ].join('\n')
        )
        // 深度 ≥1（二级及以下）即便携带丰富字段也必须精简
        expect(md).not.toContain('孙任务描述')
        expect(md).not.toContain('孙检查项')
    })

    it('行内标量顺序固定：状态 → 优先级 → 开始时间 → 截止时间 → 标签，空项跳过且不留空括号', () => {
        const md = onlySubTasks([
            makeNode({
                name: '仅标签',
                state: 'todo',
                stateLabel: '',
                priorityLabel: '',
                startAt: null,
                endAt: null,
                tagNames: ['重要', '紧急'],
                description: '',
                checkItems: []
            }),
            makeNode({
                name: '仅时间',
                state: 'todo',
                stateLabel: '',
                priorityLabel: '',
                startAt: '2026-09-20 09:00:00',
                endAt: '2026-09-20 18:00:00',
                tagNames: [],
                description: '',
                checkItems: []
            })
        ])

        expect(md).toContain('- [ ] 仅标签（标签：#重要 #紧急）')
        expect(md).toContain(
            '- [ ] 仅时间（开始时间：2026-09-20 09:00；截止时间：2026-09-20 18:00）'
        )
        // 仅标签时不得出现被跳过的空项占位
        expect(md).not.toContain('状态：；')
        expect(md).not.toContain('优先级：；')
    })

    it('一级子任务丰富字段全空 ⇒ 只输出名称 + 复选框，不输出空括号', () => {
        const md = onlySubTasks([
            makeNode({
                name: '空项子任务',
                state: 'todo',
                stateLabel: '',
                priorityLabel: '',
                startAt: null,
                endAt: null,
                tagNames: [],
                description: '',
                checkItems: []
            })
        ])

        expect(md).toContain('- [ ] 空项子任务')
        expect(md).not.toContain('（）')
        expect(md).not.toContain('- [ ] 空项子任务（')
    })
})

describe('generateTaskMarkdown - 子任务边界（AC4）', () => {
    const onlySubTasks = (children: ExportTaskNode[]) =>
        generateTaskMarkdown(
            makeNode({
                startAt: null,
                endAt: null,
                projectName: undefined,
                tagNames: [],
                description: '',
                checkItems: [],
                children
            }),
            labels
        )

    it('描述内部换行折叠为单行（空格连接）', () => {
        const md = onlySubTasks([
            makeNode({
                name: '多行描述',
                state: 'todo',
                stateLabel: '',
                priorityLabel: '',
                startAt: null,
                endAt: null,
                tagNames: [],
                description: '第一行\n第二行\n第三行',
                checkItems: []
            })
        ])

        expect(md).toContain('  - 描述：第一行 第二行 第三行')
        expect(md).not.toContain('第一行\n第二行')
    })

    it('描述与检查项各段独立：仅检查项不输出描述行，仅描述不输出检查项段', () => {
        const onlyCheck = onlySubTasks([
            makeNode({
                name: '仅检查',
                state: 'todo',
                stateLabel: '',
                priorityLabel: '',
                startAt: null,
                endAt: null,
                tagNames: [],
                description: '',
                checkItems: [{ name: 'A', isDone: false }]
            })
        ])
        expect(onlyCheck).toContain(['  - 检查项：', '    - [ ] A'].join('\n'))
        expect(onlyCheck).not.toContain('  - 描述：')

        const onlyDesc = onlySubTasks([
            makeNode({
                name: '仅描述',
                state: 'todo',
                stateLabel: '',
                priorityLabel: '',
                startAt: null,
                endAt: null,
                tagNames: [],
                description: '有描述',
                checkItems: []
            })
        ])
        expect(onlyDesc).toContain('  - 描述：有描述')
        expect(onlyDesc).not.toContain('检查项：')
    })

    it('属性子行位于一级子任务行之下、更深子任务之前', () => {
        const md = onlySubTasks([
            makeNode({
                name: '父',
                state: 'todo',
                stateLabel: '',
                priorityLabel: '',
                startAt: null,
                endAt: null,
                tagNames: [],
                description: '父描述',
                checkItems: [],
                children: [
                    makeNode({
                        name: '子',
                        state: 'todo',
                        stateLabel: '待办',
                        priorityLabel: '低优先级',
                        startAt: null,
                        endAt: null,
                        tagNames: [],
                        description: '',
                        checkItems: []
                    })
                ]
            })
        ])

        const block = md.split('## 子任务\n\n')[1]!
        expect(block.indexOf('- [ ] 父')).toBeLessThan(block.indexOf('  - 描述：父描述'))
        expect(block.indexOf('  - 描述：父描述')).toBeLessThan(block.indexOf('  - [ ] 子'))
    })

    it('深层子任务保持精简（名称 + 复选框）并逐层缩进 2 空格', () => {
        const md = onlySubTasks([
            makeNode({
                name: 'L1',
                state: 'done',
                stateLabel: '',
                priorityLabel: '',
                startAt: null,
                endAt: null,
                tagNames: [],
                description: '',
                checkItems: [],
                children: [
                    makeNode({
                        name: 'L2',
                        state: 'todo',
                        stateLabel: '待办',
                        priorityLabel: '低优先级',
                        startAt: '2026-09-20 09:00:00',
                        endAt: null,
                        tagNames: [],
                        description: 'L2 描述',
                        checkItems: [{ name: 'L2 检查', isDone: false }],
                        children: [makeNode({ name: 'L3', state: 'done' })]
                    })
                ]
            })
        ])

        expect(md).toContain(['- [x] L1', '  - [ ] L2', '    - [x] L3'].join('\n'))
        expect(md).not.toContain('L2 描述')
        expect(md).not.toContain('L2 检查')
    })
})