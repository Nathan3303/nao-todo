// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed } from 'vue'
import { InputButton, parse2RelativeDate, t, TaskCheckButton } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY } from '../../context'
import DetailsSubTasks from '../subtasks.vue'

/**
 * TASK-02 子任务行布局精简（时间内联 / 移除行内改名 / 脱离按钮并入标题行）
 * @description 覆盖 U-R1…U-R4 与 AC①④⑥⑦⑧。① 真实排版（AC②③ 截断）与改名往返（AC⑤）
 *              由 QA 实机冒烟出证据（jsdom 无布局引擎）；② 截断的 CSS 契约以静态论证列入
 *              交付汇报（`packages/presentation` 无 node 类型，单测内不读文件）。
 */
const { confirmMock, messageErrorMock } = vi.hoisted(() => ({
    confirmMock: vi.fn(),
    messageErrorMock: vi.fn()
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>()
    return { ...actual, NueConfirm: confirmMock, NueMessage: { error: messageErrorMock } }
})

const futureIso = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString()

/** 相对日期文案（与组件内 `formatDateTime` 同口径：空值回退空串） */
const rel = (iso: string | null): string => (iso && parse2RelativeDate(iso)) || ''

const makeSubTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 'sub-1',
        name: '子任务 A',
        description: undefined,
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: null,
        projectId: null,
        ...overrides
    }) as TaskViewObject

type Harness = {
    wrapper: VueWrapper
    switchTaskDetails: ReturnType<typeof vi.fn>
    detachSubTask: ReturnType<typeof vi.fn>
    updateTaskState: ReturnType<typeof vi.fn>
    createSubTask: ReturnType<typeof vi.fn>
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.clearAllMocks()
})

const mountRows = (subTasks: TaskViewObject[]): Harness => {
    const switchTaskDetails = vi.fn()
    const detachSubTask = vi.fn(async () => null)
    const updateTaskState = vi.fn(async () => null)
    const createSubTask = vi.fn(async () => {})
    const context = {
        subTasks: computed(() => subTasks),
        subTasksLoading: computed(() => false),
        subTasksError: computed(() => ''),
        retrySubTasks: vi.fn(async () => {}),
        switchTaskDetails,
        subTaskHandler: { updateTaskState },
        createSubTask,
        detachSubTask
    }
    wrapper = mount(DetailsSubTasks, {
        global: {
            provide: { [TASK_DETAILS_CONTEXT_KEY as symbol]: context },
            config: { warnHandler: () => {} }
        }
    })
    return { wrapper, switchTaskDetails, detachSubTask, updateTaskState, createSubTask }
}

const timeTextOf = (startAt: string | null, endAt: string | null): string => {
    const parts: string[] = []
    if (startAt) parts.push(t('task.details.startedAt', { time: rel(startAt) }))
    if (endAt) parts.push(t('task.details.dueAt', { time: rel(endAt) }))
    return parts.join(' ~ ')
}

describe('TASK-02 子任务行：时间内联 + 行内改名移除 + 脱离按钮并入标题行', () => {
    it('U-R1 时间文案四态：仅开始 / 仅结束 / 两者 / 皆无（文案与格式不变，且内联在名称之后）', () => {
        const startAt = futureIso(1)
        const endAt = futureIso(3)

        // 两者：`开始 <相对> ~ 结束 <相对>`，位于名称之后的同一标题行内（AC①）
        const both = mountRows([makeSubTask({ startAt, endAt })])
        const time = both.wrapper.find('.subtask-row__time')
        expect(time.exists()).toBe(true)
        expect(time.text()).toBe(timeTextOf(startAt, endAt))
        expect(time.text()).toContain(' ~ ')
        const titleLine = both.wrapper.find('.subtask-row__title-line')
        expect(titleLine.find('.subtask-row__time').exists()).toBe(true)
        const nameEl = both.wrapper.find('.subtask-row__name').element
        expect(
            nameEl.compareDocumentPosition(time.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()

        // 仅开始 / 仅结束
        const onlyStart = mountRows([makeSubTask({ startAt })])
        expect(onlyStart.wrapper.find('.subtask-row__time').text()).toBe(timeTextOf(startAt, null))
        const onlyEnd = mountRows([makeSubTask({ endAt })])
        expect(onlyEnd.wrapper.find('.subtask-row__time').text()).toBe(timeTextOf(null, endAt))

        // 皆无 ⇒ 时间元素不渲染（无悬空 `~`）
        const none = mountRows([makeSubTask()])
        expect(none.wrapper.find('.subtask-row__time').exists()).toBe(false)
        expect(none.wrapper.text()).not.toContain('~')
    })

    it('U-R2 时间移出 meta 行：无描述 ⇒ 不渲染 meta 行；有描述 ⇒ 第二行仅描述（无悬空分隔符）', () => {
        const withDesc = mountRows([
            makeSubTask({ description: '描述文本', startAt: futureIso(1), endAt: futureIso(2) })
        ])
        const meta = withDesc.wrapper.find('.subtask-row__meta')
        expect(meta.exists()).toBe(true)
        // 描述仍留第二行，且不再拼接时间（死分支已清理）
        expect(meta.text()).toBe('描述文本')
        expect(meta.text()).not.toContain('~')
        expect(meta.text()).not.toContain('·')

        const noDesc = mountRows([makeSubTask({ description: undefined })])
        expect(noDesc.wrapper.find('.subtask-row__meta').exists()).toBe(false)
    })

    it('U-R3 行内改名机制整体移除：无编辑入口 / 无编辑输入 / 无 editing 属性与 actions 列', () => {
        const { wrapper: w } = mountRows([makeSubTask({ name: '可改名子任务' })])
        expect(w.find('.subtask-row input').exists()).toBe(false)
        expect(w.find('.subtask-row__input').exists()).toBe(false)
        expect(w.find('.subtask-row__actions').exists()).toBe(false)
        expect(w.find('[data-editing]').exists()).toBe(false)
        expect(
            w.findAll('button').filter((b) => b.attributes('title') === t('common.edit'))
        ).toHaveLength(0)
    })

    it('U-R4 时间完整文案由 title 取得，且脱离按钮常驻标题行（不以 v-if 隐藏）', () => {
        const startAt = futureIso(1)
        const endAt = futureIso(2)
        const { wrapper: w } = mountRows([makeSubTask({ startAt, endAt })])
        // AC④：title = 完整展示文案（不做绝对时间转换）
        expect(w.find('.subtask-row__time').attributes('title')).toBe(timeTextOf(startAt, endAt))
        // AC③/C-R6：脱离按钮与时间同处标题行且始终在 DOM 中（隐藏只走 opacity + hover/focus-within）
        const titleLine = w.find('.subtask-row__title-line')
        expect(titleLine.find('.subtask-row__detach').exists()).toBe(true)
        expect(titleLine.find('.subtask-row__time').exists()).toBe(true)
    })

    it('AC⑥ 点击口径：名称导航、时间不导航、脱离按钮不误触导航（且确认后调用 detachSubTask）', async () => {
        const subTask = makeSubTask({ startAt: futureIso(1), endAt: futureIso(2) })
        const h = mountRows([subTask])

        // 点击名称 ⇒ 进入详情（改名唯一入口）
        await h.wrapper.find('.subtask-row__name').trigger('click')
        expect(h.switchTaskDetails).toHaveBeenCalledWith(subTask.id)

        // 点击时间 ⇒ 不导航
        h.switchTaskDetails.mockClear()
        await h.wrapper.find('.subtask-row__time').trigger('click')
        expect(h.switchTaskDetails).not.toHaveBeenCalled()

        // 点击脱离按钮 ⇒ 确认弹窗 + detachSubTask，且不导航（AC⑧ 行为不变）
        confirmMock.mockResolvedValueOnce([false])
        await h.wrapper.find('.subtask-row__detach').trigger('click')
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(confirmMock).toHaveBeenCalledTimes(1)
        expect(h.detachSubTask).toHaveBeenCalledWith(subTask.id)
        expect(h.switchTaskDetails).not.toHaveBeenCalled()
        expect(messageErrorMock).not.toHaveBeenCalled()

        // 取消确认 ⇒ 不调用 detachSubTask
        h.detachSubTask.mockClear()
        confirmMock.mockResolvedValueOnce([true])
        await h.wrapper.find('.subtask-row__detach').trigger('click')
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(h.detachSubTask).not.toHaveBeenCalled()
    })

    it('AC⑧ 行为不变：勾选切换状态、创建输入条仍走 createSubTask、行与标题行不挂导航点击', async () => {
        const subTask = makeSubTask()
        const h = mountRows([subTask])

        h.wrapper.findComponent(TaskCheckButton).vm.$emit('change')
        expect(h.updateTaskState).toHaveBeenCalledWith(subTask.id, 'done')

        const createBar = h.wrapper.findComponent(InputButton)
        expect(createBar.exists()).toBe(true)
        expect(createBar.props('placeholder')).toBe(t('task.details.subTaskNamePlaceholder'))
        const onSubmit = createBar.props('onSubmit') as (payload: { value: string }) => unknown
        onSubmit({ value: '新子任务' })
        await Promise.resolve()
        expect(h.createSubTask).toHaveBeenCalledWith('新子任务')

        // 行容器与标题行不得承载导航点击（AC⑥ 反向断言）
        await h.wrapper.find('.subtask-row').trigger('click')
        await h.wrapper.find('.subtask-row__title-line').trigger('click')
        expect(h.switchTaskDetails).not.toHaveBeenCalled()
    })
})