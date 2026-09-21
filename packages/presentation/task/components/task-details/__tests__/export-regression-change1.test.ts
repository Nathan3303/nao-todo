// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { generateTaskMarkdown, type ExportLabels, type ExportTaskNode } from '../export-markdown'
import TaskExportDialog from '../export-dialog.vue'

/**
 * T41 变更 1 独立回归验证（只读；独立重算，不依赖 T39 既有断言）
 * @description 覆盖：
 *  - §5.2 完整拼接示例逐字符（独立构造）；
 *  - 反向断言：无 `（` / 无 `： `，全角冒号直接接值；
 *  - 递归规则：含子节点的每个节点各一段 `- 子任务：`，每深一级 +4；独立核 L3/L4；
 *  - 描述换行折叠、检查项缩进 4；
 *  - 根任务 §5.1 回归；
 *  - UI：footer 无「关闭」+ 右上角关闭通路 `nue-dialog update:modelValue` 转发。
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
    name: '根任务',
    state: 'todo',
    stateLabel: '待办',
    priorityLabel: '低优先级',
    startAt: null,
    endAt: null,
    createdAt: '2026-09-19 08:00:00',
    updatedAt: '2026-09-19 20:00:00',
    description: '',
    checkItems: [],
    ...overrides
})

const emptyRoot = (children: ExportTaskNode[]): ExportTaskNode =>
    makeNode({ description: '', checkItems: [], children })

describe('T41-AC1 §5.2 完整拼接示例（独立重算）', () => {
    it('逐字符等于 PRD §5.2 冻结块', () => {
        const md = generateTaskMarkdown(
            emptyRoot([
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
                    children: [makeNode({ name: '孙任务', state: 'todo' })]
                })
            ]),
            labels
        )
        const expected = [
            '# 根任务',
            '',
            '- 状态：待办',
            '- 优先级：低优先级',
            '- 创建时间：2026-09-19 08:00',
            '- 更新时间：2026-09-19 20:00',
            '',
            '## 子任务',
            '',
            '- [x] 子任务 1',
            '  - 状态：已完成',
            '  - 优先级：高',
            '  - 开始时间：2026-09-20 09:00',
            '  - 截止时间：2026-09-20 18:00',
            '  - 标签：#重要',
            '  - 描述：子任务描述',
            '  - 检查项：',
            '    - [x] 检查项一',
            '    - [ ] 检查项二',
            '- [ ] 子任务 2',
            '  - 状态：待办',
            '  - 优先级：低',
            '  - 子任务：',
            '    - [ ] 孙任务',
            ''
        ].join('\n')
        expect(md).toBe(expected)
    })

    it('反向：全段无 `（`、无 `： `，全角冒号后直接接值', () => {
        const md = generateTaskMarkdown(
            emptyRoot([
                makeNode({
                    name: 'X',
                    state: 'done',
                    stateLabel: '已完成',
                    priorityLabel: '高',
                    startAt: '2026-09-20 09:00:00',
                    endAt: '2026-09-20 18:00:00',
                    tagNames: ['a'],
                    description: 'D',
                    checkItems: [{ name: 'C', isDone: true }]
                })
            ]),
            labels
        )
        expect(md).not.toContain('（')
        expect(md).not.toContain('： ')
        // 全角冒号后必为值本身（抽 - 状态/优先级/开始/截止/标签/描述 校验）
        for (const re of [
            /- 状态：已完成/,
            /- 优先级：高/,
            /- 开始时间：2026-09-20 09:00/,
            /- 截止时间：2026-09-20 18:00/,
            /- 标签：#a/,
            /- 描述：D/
        ]) {
            expect(md).toMatch(re)
        }
    })

    it('属性全空 ⇒ 仅 `- [ ] 名称` 一行', () => {
        const md = generateTaskMarkdown(
            emptyRoot([makeNode({ name: '空', stateLabel: '', priorityLabel: '' })]),
            labels
        )
        expect(md).toContain('- [ ] 空')
        const section = md.slice(md.indexOf('## 子任务\n\n') + '## 子任务\n\n'.length)
        expect(section).toBe('- [ ] 空\n')
    })
})

describe('T41-AC4 递归规则（独立核 L3/L4 缩进）', () => {
    it('含子节点每个节点各一段 `- 子任务：`；L2=4 / 标签6 / L3=8 / 标签10 / L4=12', () => {
        const md = generateTaskMarkdown(
            emptyRoot([
                makeNode({
                    name: 'L1',
                    state: 'done',
                    stateLabel: '',
                    priorityLabel: '',
                    children: [
                        makeNode({
                            name: 'L2',
                            state: 'todo',
                            stateLabel: '待办',
                            priorityLabel: '低优先级',
                            description: 'L2 描述',
                            checkItems: [{ name: 'L2 检查', isDone: true }],
                            children: [
                                makeNode({
                                    name: 'L3',
                                    state: 'todo',
                                    stateLabel: '',
                                    priorityLabel: '',
                                    children: [makeNode({ name: 'L4', state: 'done' })]
                                })
                            ]
                        })
                    ]
                })
            ]),
            labels
        )
        const section = md.split('## 子任务\n\n')[1]!
        const expected = [
            '- [x] L1',
            '  - 子任务：',
            '    - [ ] L2',
            '      - 子任务：',
            '        - [ ] L3',
            '          - 子任务：',
            '            - [x] L4',
            ''
        ].join('\n')
        expect(section).toBe(expected)
        // 深度 ≥1 精简：L2 的属性/描述/检查项不得输出
        expect(md).not.toContain('L2 描述')
        expect(md).not.toContain('L2 检查')
    })

    it('描述换行折叠单行；检查项逐项缩进 4', () => {
        const md = generateTaskMarkdown(
            emptyRoot([
                makeNode({
                    name: 'S',
                    stateLabel: '',
                    priorityLabel: '',
                    description: '第一行\n第二行  \n第三行',
                    checkItems: [
                        { name: 'C1', isDone: true },
                        { name: 'C2', isDone: false }
                    ]
                })
            ]),
            labels
        )
        expect(md).toContain('  - 描述：第一行 第二行 第三行')
        expect(md).not.toMatch(/第一行\n第二行/)
        expect(md).toContain('  - 检查项：\n    - [x] C1\n    - [ ] C2\n')
    })
})

describe('T41-AC-root 根任务 §5.1 回归', () => {
    it('根任务元信息行保持 `- 状态：待办` 同构且段落顺序不变', () => {
        const md = generateTaskMarkdown(
            makeNode({
                projectName: '工作',
                tagNames: ['重要'],
                description: '描述',
                checkItems: [{ name: 'C', isDone: true }]
            }),
            labels
        )
        expect(md).toContain(
            [
                '# 根任务',
                '',
                '- 状态：待办',
                '- 优先级：低优先级',
                '- 项目：工作',
                '- 标签：#重要',
                '- 创建时间：2026-09-19 08:00',
                '- 更新时间：2026-09-19 20:00',
                '',
                '## 描述',
                '',
                '描述',
                '',
                '## 检查项',
                '',
                '- [x] C'
            ].join('\n')
        )
    })
})

// --- UI：footer no-close + 右上角关闭通路 ---

const DialogStub = defineComponent({
    name: 'NueDialog',
    props: { modelValue: { type: Boolean, default: false } },
    emits: ['update:modelValue'],
    setup(props, { slots }) {
        return () =>
            props.modelValue
                ? h('div', { class: 'stub-dialog' }, [slots.content?.(), slots.footer?.()])
                : null
    }
})
const DivStub = defineComponent({
    name: 'NueDiv',
    setup(_, { slots }) {
        return () => h('div', slots.default?.())
    }
})
const ButtonStub = defineComponent({
    name: 'NueButton',
    emits: ['click'],
    setup(_, { slots, emit }) {
        return () => h('button', { onClick: () => emit('click') }, slots.default?.())
    }
})
const TextareaStub = defineComponent({
    name: 'NueTextarea',
    props: { modelValue: { type: String, default: '' } },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        return () =>
            h('textarea', {
                value: props.modelValue,
                onInput: (e: Event) =>
                    emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
            })
    }
})
const stubs = {
    NueDialog: DialogStub,
    'nue-dialog': DialogStub,
    NueDiv: DivStub,
    'nue-div': DivStub,
    NueButton: ButtonStub,
    'nue-button': ButtonStub,
    NueTextarea: TextareaStub,
    'nue-textarea': TextareaStub
}

describe('T41-UI 变更 1', () => {
    it('footer 仅两个按钮：还原 + 复制；无「关闭」', () => {
        const w = mount(TaskExportDialog, {
            props: { modelValue: true, markdown: '# 任务' },
            global: { stubs }
        })
        const texts = w.findAll('button').map((b) => b.text())
        expect(texts).toHaveLength(2)
        expect(texts.some((t) => /还原|Restore/i.test(t))).toBe(true)
        expect(texts.some((t) => /复制|Copy/.test(t))).toBe(true)
        expect(texts.some((t) => /关闭|Close/.test(t))).toBe(false)
        w.unmount()
    })

    it('右上角关闭通路：nue-dialog update:modelValue(false) → 组件 emit false', async () => {
        const w = mount(TaskExportDialog, {
            props: { modelValue: true, markdown: '# 任务' },
            global: { stubs }
        })
        w.findComponent(DialogStub).vm.$emit('update:modelValue', false)
        await nextTick()
        expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false])
        w.unmount()
    })
})