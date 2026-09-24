// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import { useTaskDetailsStore } from '../../../stores'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import type { TaskDetailsViewObject } from '../types'
import { generateTaskMarkdown, type ExportLabels, type ExportTaskNode } from '../export-markdown'
import TaskExportDialog from '../export-dialog.vue'
import TaskDetailsFooter from '../footer/index.vue'

/**
 * T37 独立验收用例（新增，不改 T33 基线）
 * @description 只做证伪/加固：
 *  ① AC1 PRD §5.2 完整拼接示例「逐字符」比对（变更 1：名称行仅复选框+名称，属性 2 空格子行，
 *     检查项/子任务段嵌套缩进 4，更深层级走 `- 子任务：` 标签段）。
 *  ② AC2/AC3 footer 集成：对话框 copy payload → 剪贴板；还原按钮存在且恢复原文。
 *  ③ AC2 空草稿复制不拦截（PRD §5.4）。
 *  ④ AC5 剪贴板不可用（负向）。
 *  ⑤ NFR 长文：textarea 收到 autosize {minRows:12,maxRows:24} 与滚动类名（视觉滚动仍需人眼）。
 */

vi.mock('nue-ui', () => ({
    NueMessage: { success: vi.fn(), error: vi.fn() }
}))

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

/** PRD §5.2（2026-09-21 变更 1）「完整拼接示例」逐字符冻结串（含末尾换行） */
const FROZEN_SUBTASK_BLOCK =
    [
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
        '    - [ ] 孙任务'
    ].join('\n') + '\n'

describe('T37-AC1 PRD §5.2 完整拼接示例逐字符比对', () => {
    it('子任务段与冻结示例完全一致（含分隔符/缩进/标签/时间）', () => {
        const md = generateTaskMarkdown(
            makeNode({
                children: [
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
                        children: [
                            makeNode({
                                name: '孙任务',
                                state: 'todo',
                                stateLabel: '待办',
                                priorityLabel: '低',
                                // 即便携带丰富字段，二级也必须精简
                                description: '不应出现',
                                checkItems: [{ name: '不应出现', isDone: true }]
                            })
                        ]
                    })
                ]
            }),
            labels
        )

        // 从 ## 子任务 起至文件末尾，必须与冻结串逐字符相等
        expect(md.slice(md.indexOf('## 子任务'))).toBe(FROZEN_SUBTASK_BLOCK)
        // 反向：不得残留行内括号形态 / 全角逗号
        expect(md).not.toContain('（')
        expect(md).not.toContain('，')
        expect(md).not.toContain('(状态')
    })

    it('属性子行分隔符为全角冒号直接接值（与根任务元信息同构）', () => {
        const md = generateTaskMarkdown(
            makeNode({
                children: [
                    makeNode({
                        name: '格式',
                        state: 'done',
                        stateLabel: '已完成',
                        priorityLabel: '高',
                        startAt: null,
                        endAt: null,
                        tagNames: []
                    })
                ]
            }),
            labels
        )
        expect(md).toContain('  - 状态：已完成')
        expect(md).toContain('  - 优先级：高')
        expect(md).not.toContain('： ')
        expect(md).not.toContain(': ')
    })

    it('时间格式严格 YYYY-MM-DD HH:mm（零填充），标签 #名称 空格连接', () => {
        const md = generateTaskMarkdown(
            makeNode({
                children: [
                    makeNode({
                        name: '格式',
                        stateLabel: '',
                        priorityLabel: '',
                        startAt: '2026-01-02 03:04:00',
                        endAt: null,
                        tagNames: ['a', 'b']
                    })
                ]
            }),
            labels
        )
        expect(md).toContain(
            ['- [ ] 格式', '  - 开始时间：2026-01-02 03:04', '  - 标签：#a #b'].join('\n')
        )
    })
})

// --- 对话框 stub（记录 props，供 autosize 断言） ---

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
    props: {
        modelValue: { type: String, default: '' },
        autosize: { type: [Boolean, Object], default: false }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        return () =>
            h('textarea', {
                class: ['stub-textarea'],
                value: props.modelValue,
                'data-autosize': JSON.stringify(props.autosize),
                onInput: (event: Event) =>
                    emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
            })
    }
})
const dialogStubs = {
    NueDialog: DialogStub,
    'nue-dialog': DialogStub,
    NueDiv: DivStub,
    'nue-div': DivStub,
    NueButton: ButtonStub,
    'nue-button': ButtonStub,
    NueTextarea: TextareaStub,
    'nue-textarea': TextareaStub
}

describe('T37-NFR 长文滚动接线（视觉滚动仍需人眼）', () => {
    it('textarea 收到 autosize {minRows:12,maxRows:24}，滚动类名 task-export-preview 已挂', () => {
        const w = mount(TaskExportDialog, {
            props: { modelValue: true, markdown: '# 任务' },
            global: { stubs: dialogStubs }
        })
        const textarea = w.find('textarea')
        expect(textarea.exists()).toBe(true)
        const autosize = JSON.parse(textarea.attributes('data-autosize') ?? '{}')
        expect(autosize).toEqual({ minRows: 12, maxRows: 24 })
        // class 落在外层 wrapper（nue 组件根元素）上
        expect(w.find('.task-export-preview').exists()).toBe(true)
        w.unmount()
    })
})

// --- footer 集成（对话框 copy payload → 剪贴板） ---

const DropdownStub = defineComponent({
    name: 'NueDropdown',
    emits: ['execute'],
    setup(_, { slots }) {
        return () => h('div', slots.trigger?.({ trigger: () => {} }))
    }
})
const ExportDialogEmitStub = defineComponent({
    name: 'TaskExportDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        markdown: { type: String, default: '' },
        // TASK-22：footer 以 status 驱动框内三态（supersede 断言需观察框内 error 态 + 重试）
        status: { type: String, default: 'ready' },
        errorMessage: { type: String, default: '' }
    },
    emits: ['copy', 'update:modelValue', 'retry'],
    setup(props) {
        return () =>
            h(
                'div',
                {
                    class: props.modelValue
                        ? 'export-dialog-stub export-open'
                        : 'export-dialog-stub export-closed',
                    'data-status': props.status
                },
                props.modelValue && props.status === 'error'
                    ? [
                          h('div', { class: 'export-dialog-error', 'data-error': 'true' }),
                          h('button', { type: 'button' }, '重试')
                      ]
                    : []
            )
    }
})
const footerStubs = {
    'nue-dropdown': DropdownStub,
    'nue-button': true,
    'nue-divider': true,
    'dropdown-div-block': true,
    'inner-dropdown-option': true,
    'task-project-selector': true,
    'task-export-dialog': ExportDialogEmitStub
}

const taskVo = (): TaskDetailsViewObject =>
    ({
        id: 'root',
        name: '根任务',
        projectId: null,
        tags: [],
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: null,
        description: '',
        createdAt: '2026-09-19 08:00:00',
        updatedAt: '2026-09-19 20:00:00'
    }) as unknown as TaskDetailsViewObject

type FooterOptions = {
    subTaskList?: (options: { parentTaskId?: string; page?: number }) => Promise<unknown>
    listByTask?: (taskId: string) => Promise<unknown>
}

const mountFooter = (options: FooterOptions = {}) => {
    setActivePinia(createPinia())
    useTaskDetailsStore()
    const vo = ref<TaskDetailsViewObject | null>(taskVo())
    return mount(TaskDetailsFooter, {
        global: {
            stubs: footerStubs,
            provide: {
                [TASK_DETAILS_CONTEXT_KEY as symbol]: {
                    vo,
                    checkItems: computed(() => []),
                    projects: computed(() => []),
                    isCommenting: ref(false),
                    taskHandler: { update: vi.fn(), copyTask: vi.fn() },
                    switchTaskDetails: vi.fn(),
                    dialogManager: { open: vi.fn() },
                    updateTaskDetails: vi.fn(),
                    deleteTask: vi.fn(),
                    restoreTask: vi.fn(),
                    giveUpTask: vi.fn(),
                    ungiveUpTask: vi.fn()
                },
                [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                    subTaskUseCase: {
                        list: options.subTaskList ?? vi.fn(async () => [{ taskIds: [] }, null])
                    },
                    taskCheckItemUseCase: {
                        listByTask: options.listByTask ?? vi.fn(async () => [[], null])
                    },
                    getTag: () => undefined,
                    getProjectName: () => ''
                }
            }
        }
    })
}

describe('T37-AC2/AC5 footer 集成：copy payload → 剪贴板', () => {
    beforeEach(() => {
        vi.mocked(NueMessage.success).mockClear()
        vi.mocked(NueMessage.error).mockClear()
    })
    afterEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('footer 以对话框回传的编辑后文本写剪贴板（非生成文本）', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        const w = mountFooter()
        await flushPromises()

        w.findComponent(ExportDialogEmitStub).vm.$emit('copy', '# 编辑后文本')
        await flushPromises()

        expect(writeText).toHaveBeenCalledWith('# 编辑后文本')
        w.unmount()
    })

    it('空草稿复制不拦截：仍调用剪贴板一次（PRD §5.4）', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        const w = mountFooter()
        await flushPromises()

        w.findComponent(ExportDialogEmitStub).vm.$emit('copy', '')
        await flushPromises()

        expect(writeText).toHaveBeenCalledWith('')
        w.unmount()
    })

    it('剪贴板不可用 ⇒ 不静默：错误提示（负向）', async () => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
        const w = mountFooter()
        await flushPromises()

        w.findComponent(ExportDialogEmitStub).vm.$emit('copy', '# 文本')
        await flushPromises()

        expect(NueMessage.error).toHaveBeenCalledTimes(1)
        w.unmount()
    })

    it('子任务 listByTask 失败 ⇒ toast「导出失败：boom」、浮层已开且为框内错误态、不写剪贴板（AC5 独立复核）', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        const w = mountFooter({
            subTaskList: vi.fn(async ({ parentTaskId }) =>
                parentTaskId === 'root'
                    ? [
                          {
                              taskIds: ['c1'],
                              pagination: { total: 1, page: 1, limit: 100, maxPage: 1 }
                          },
                          null
                      ]
                    : [
                          {
                              taskIds: [],
                              pagination: { total: 0, page: 1, limit: 100, maxPage: 1 }
                          },
                          null
                      ]
            ),
            listByTask: vi.fn(async () => [null, 'boom'])
        })
        // 子任务节点须在详情 store 中，fetchChildren 才能映射为节点
        useTaskDetailsStore().addTasks([
            {
                id: 'c1',
                parentTaskId: 'root',
                name: '子 1',
                state: 'todo',
                priority: 'low',
                startAt: null,
                endAt: null,
                projectId: null,
                tags: [],
                description: '',
                createdAt: '2026-09-19 08:00:00',
                updatedAt: '2026-09-19 20:00:00',
                deletedAt: null,
                userId: 'u1',
                archivedAt: null,
                starMarkAt: null,
                givenUpAt: null,
                remindAt: null,
                remindRepeat: 'none',
                remindTime: null,
                remindWeekdays: [],
                checkItemCount: 0,
                commentCount: 0,
                subtaskCount: 0,
                sortId: 1000,
                isDeleted: false,
                isArchived: false,
                isStarMarked: false,
                isGivenUp: false
            } as never
        ])

        w.findComponent(DropdownStub).vm.$emit('execute', 'export-task')
        await flushPromises()

        expect(NueMessage.error).toHaveBeenCalledWith('导出失败：boom')
        // supersede（PM 2026-09-23 裁决 A）：流程反转 ⇒ 失败时浮层仍开，错误态在框内（+ 重试）
        expect(w.find('.export-open').exists()).toBe(true)
        expect(w.find('.export-dialog-error').exists()).toBe(true)
        expect(w.findAll('button').some((button) => /重试|Retry/.test(button.text()))).toBe(true)
        expect(writeText).not.toHaveBeenCalled()
        w.unmount()
    })
})