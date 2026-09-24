import { describe, expect, it } from 'vite-plus/test'
import { generateTaskMarkdown, type ExportLabels, type ExportTaskNode } from '../export-markdown'

/**
 * TASK-22 T94 —— Markdown 渲染器「零变更」回归（PRD §1 / §5.5 / AC1 / AC5）
 * @description TASK-22 增量 = JSON + HTML + LoadingError；`generateTaskMarkdown` 输出必须与
 *              TASK-13 冻结基准**逐字符相同**。本文件为独立重算断言（不依赖既有断言文件），
 *              并额外证伪「新增 additive 字段（id/priority/isGivenUp/projectId/tagIds）泄入输出」。
 *
 * ⚠️ 若本文件变红而 `export-markdown.test.ts` 全绿 ⇒ 判为 TASK-13 冻结基准被夹带变更，回退并上报 PM。
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
    name: '任务',
    state: 'todo',
    stateLabel: '待办',
    priorityLabel: '低优先级',
    startAt: null,
    endAt: null,
    createdAt: '2026-09-19 08:00:00',
    updatedAt: '2026-09-19 20:00:00',
    ...overrides
})

describe('generateTaskMarkdown - TASK-22 零变更冻结基准', () => {
    it('根任务 + 一级/二级子任务完整文档逐字符等于冻结串', () => {
        const md = generateTaskMarkdown(
            makeNode({
                name: '根任务',
                state: 'todo',
                stateLabel: '待办',
                priorityLabel: '低优先级',
                startAt: '2026-09-20 09:00:00',
                endAt: '2026-09-20 18:00:00',
                projectName: '工作',
                tagNames: ['重要', '紧急'],
                createdAt: '2026-09-19 08:00:00',
                updatedAt: '2026-09-19 20:00:00',
                description: '  描述第一行\n描述第二行  ',
                checkItems: [
                    { name: '检一', isDone: true },
                    { name: '检二', isDone: false }
                ],
                children: [
                    makeNode({
                        name: '子任务 1',
                        state: 'done',
                        stateLabel: '已完成',
                        priorityLabel: '高',
                        startAt: '2026-09-20 09:00:00',
                        endAt: '2026-09-20 18:00:00',
                        tagNames: ['重要'],
                        description: '子任务描述\n换行',
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
                        children: [makeNode({ name: '孙任务', state: 'todo' })]
                    })
                ]
            }),
            labels
        )

        const expected =
            [
                '# 根任务',
                '',
                '- 状态：待办',
                '- 优先级：低优先级',
                '- 开始时间：2026-09-20 09:00',
                '- 截止时间：2026-09-20 18:00',
                '- 项目：工作',
                '- 标签：#重要 #紧急',
                '- 创建时间：2026-09-19 08:00',
                '- 更新时间：2026-09-19 20:00',
                '',
                '## 描述',
                '',
                '描述第一行\n描述第二行',
                '',
                '## 检查项',
                '',
                '- [x] 检一',
                '- [ ] 检二',
                '',
                '## 子任务',
                '',
                '- [x] 子任务 1',
                '  - 状态：已完成',
                '  - 优先级：高',
                '  - 开始时间：2026-09-20 09:00',
                '  - 截止时间：2026-09-20 18:00',
                '  - 标签：#重要',
                '  - 描述：子任务描述 换行',
                '  - 检查项：',
                '    - [x] 检查项一',
                '    - [ ] 检查项二',
                '- [ ] 子任务 2',
                '  - 状态：待办',
                '  - 优先级：低',
                '  - 子任务：',
                '    - [ ] 孙任务'
            ].join('\n') + '\n'

        expect(md).toBe(expected)
    })

    it('新增 additive 字段不泄入 Markdown 输出（零变化，D4）', () => {
        const base = makeNode({
            name: '字段',
            description: '描述',
            checkItems: [{ name: '检一', isDone: true }],
            children: [makeNode({ name: '子 1' })]
        })
        const extended = {
            ...base,
            id: 'a1b2c3d4-0000-0000-0000-000000000000',
            priority: 'high',
            isGivenUp: true,
            projectId: 'p-1',
            tagIds: ['t-1']
        } as ExportTaskNode

        expect(generateTaskMarkdown(extended, labels)).toBe(generateTaskMarkdown(base, labels))
        expect(generateTaskMarkdown(extended, labels)).not.toContain('a1b2c3d4')
        expect(generateTaskMarkdown(extended, labels)).not.toContain('p-1')
    })

    it('空描述/空检查项/无子任务 ⇒ 对应段落整段省略（冻结行为不变）', () => {
        const md = generateTaskMarkdown(
            makeNode({ name: '空段', createdAt: '', updatedAt: '' }),
            labels
        )

        expect(md).toBe('# 空段\n\n- 状态：待办\n- 优先级：低优先级\n')
        expect(md).not.toContain('## 描述')
        expect(md).not.toContain('## 检查项')
        expect(md).not.toContain('## 子任务')
    })
})