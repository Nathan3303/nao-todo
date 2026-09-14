// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { InputButton, parse2RelativeDate, t, TaskCheckButton } from '@nao-todo/shared'
import type { TaskTagViewObject, TaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY } from '../../context'
import { TaskTagBar } from '../../../tag-bar'
import DetailsSubTasks from '../subtasks.vue'

/**
 * TASK-02 子任务行布局精简（时间内联 / 移除行内改名 / 脱离按钮并入标题行）
 * @description 覆盖 U-R1…U-R4 与 AC①④⑥⑦⑧。① 真实排版（AC②③ 截断）与改名往返（AC⑤）
 *              由 QA 实机冒烟出证据（jsdom 无布局引擎）；② 截断的 CSS 契约以静态论证列入
 *              交付汇报（`packages/presentation` 无 node 类型，单测内不读文件）。
 * TASK-04 子任务行标签展示（只读标签栏上移名称行 / 时间下移独立行）：
 *              覆盖 AC①主路径（标签栏 + 时间独立行布局）、AC②空态、AC③溢出 +N、只读无编辑入口；
 *              真实排版（宽度/换行/溢出视觉效果）由用户手工验收（jsdom 无布局引擎）。
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
    resortSubTasks: ReturnType<typeof vi.fn>
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.clearAllMocks()
})

const mountRows = (subTasks: TaskViewObject[], tags: TaskTagViewObject[] = []): Harness => {
    const switchTaskDetails = vi.fn()
    const detachSubTask = vi.fn(async () => null)
    const updateTaskState = vi.fn(async () => null)
    const createSubTask = vi.fn(async () => {})
    const resortSubTasks = vi.fn(async () => null)
    const context = {
        subTasks: computed(() => subTasks),
        subTasksLoading: computed(() => false),
        subTasksError: computed(() => ''),
        retrySubTasks: vi.fn(async () => {}),
        switchTaskDetails,
        subTaskHandler: { updateTaskState },
        createSubTask,
        detachSubTask,
        resortSubTasks,
        tags: ref(tags)
    }
    wrapper = mount(DetailsSubTasks, {
        global: {
            provide: { [TASK_DETAILS_CONTEXT_KEY as symbol]: context },
            config: { warnHandler: () => {} }
        }
    })
    return {
        wrapper,
        switchTaskDetails,
        detachSubTask,
        updateTaskState,
        createSubTask,
        resortSubTasks
    }
}

const timeTextOf = (startAt: string | null, endAt: string | null): string => {
    const parts: string[] = []
    if (startAt) parts.push(t('task.details.startedAt', { time: rel(startAt) }))
    if (endAt) parts.push(t('task.details.dueAt', { time: rel(endAt) }))
    return parts.join(' ~ ')
}

describe('TASK-02 子任务行：时间内联 + 行内改名移除 + 脱离按钮并入标题行', () => {
    it('U-R1 时间文案四态：仅开始 / 仅结束 / 两者 / 皆无（文案与格式不变，且渲染在名称下方独立行）', () => {
        const startAt = futureIso(1)
        const endAt = futureIso(3)

        // 两者：`开始 <相对> ~ 结束 <相对>`，位于名称行（title-line）之下的独立行（AC①）
        const both = mountRows([makeSubTask({ startAt, endAt })])
        const time = both.wrapper.find('.subtask-row__time')
        expect(time.exists()).toBe(true)
        expect(time.text()).toBe(timeTextOf(startAt, endAt))
        expect(time.text()).toContain(' ~ ')
        const titleLine = both.wrapper.find('.subtask-row__title-line')
        // 时间不再内联于标题行：从标题行移出、落回 body 内名称行之后（AC① 布局）
        expect(titleLine.find('.subtask-row__time').exists()).toBe(false)
        const nameEl = both.wrapper.find('.subtask-row__name').element
        expect(
            nameEl.compareDocumentPosition(time.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()

        // 仅开始 / 仅结束
        const onlyStart = mountRows([makeSubTask({ startAt })])
        expect(onlyStart.wrapper.find('.subtask-row__time').text()).toBe(timeTextOf(startAt, null))
        const onlyEnd = mountRows([makeSubTask({ endAt })])
        expect(onlyEnd.wrapper.find('.subtask-row__time').text()).toBe(timeTextOf(null, endAt))

        // 皆无 ⇒ 时间元素不渲染（无悬空 `~`，也无空占位）
        const none = mountRows([makeSubTask()])
        expect(none.wrapper.find('.subtask-row__time').exists()).toBe(false)
        expect(none.wrapper.text()).not.toContain('~')
    })

    it('U-R2 时间移出 meta 行：无描述 ⇒ 不渲染 meta 行；有描述 ⇒ 第二行仅描述（且时间行位于描述上方）', () => {
        const withDesc = mountRows([
            makeSubTask({ description: '描述文本', startAt: futureIso(1), endAt: futureIso(2) })
        ])
        const meta = withDesc.wrapper.find('.subtask-row__meta')
        expect(meta.exists()).toBe(true)
        // 描述仍留末行，且不再拼接时间（死分支已清理）
        expect(meta.text()).toBe('描述文本')
        expect(meta.text()).not.toContain('~')
        expect(meta.text()).not.toContain('·')
        // AC① 布局：时间独立行在名称下、描述上
        const timeEl = withDesc.wrapper.find('.subtask-row__time').element
        expect(
            timeEl.compareDocumentPosition(meta.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()

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
        // AC③/C-R6：脱离按钮仍常驻标题行且始终在 DOM 中（隐藏只走 opacity + hover/focus-within）；
        // 时间已移出标题行，落入 body 独立行
        const titleLine = w.find('.subtask-row__title-line')
        expect(titleLine.find('.subtask-row__detach').exists()).toBe(true)
        expect(titleLine.find('.subtask-row__time').exists()).toBe(false)
        expect(w.find('.subtask-row__body').find('.subtask-row__time').exists()).toBe(true)
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

describe('子任务拖拽排序（整行拖拽 + 插入指示线 + 交互元素防误触）', () => {
    const dragstart = (el: Element, dataTransfer: Record<string, unknown>) => {
        const event = new Event('dragstart', { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
        return el.dispatchEvent(event)
    }

    it('行携带 draggable / data-drag-item / data-sid', () => {
        const h = mountRows([makeSubTask({ id: 'sub-1' }), makeSubTask({ id: 'sub-2' })])
        const rows = h.wrapper.findAll('.subtask-row')
        expect(rows[0]!.attributes('draggable')).toBe('true')
        expect(rows[0]!.attributes('data-drag-item')).toBe('true')
        expect(rows[0]!.attributes('data-sid')).toBe('sub-1')
        expect(rows[1]!.attributes('data-sid')).toBe('sub-2')
    })

    it('交互元素（名称）发起 dragstart 被 preventDefault，不进入拖拽态（B10）', async () => {
        const h = mountRows([makeSubTask({ id: 'sub-1' })])
        const name = h.wrapper.find('.subtask-row__name').element
        const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
        const notPrevented = dragstart(name, dataTransfer)
        expect(notPrevented).toBe(false)
        expect(dataTransfer.setData).not.toHaveBeenCalled()
        expect(h.wrapper.find('.subtask-row').attributes('data-dragging')).toBeUndefined()
    })

    it('整行拖拽 → dragover → drop ⇒ 调用 resortSubTasks（子任务 ID 契约）', async () => {
        const h = mountRows([makeSubTask({ id: 'sub-1' }), makeSubTask({ id: 'sub-2' })])
        const rows = h.wrapper.findAll('.subtask-row').map((row) => row.element)
        const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }

        expect(dragstart(rows[0]!, dataTransfer)).toBe(true)
        expect(rows[0]!.getAttribute('data-dragging')).toBe('true')

        const over = new Event('dragover', { bubbles: true, cancelable: true })
        Object.defineProperty(over, 'dataTransfer', { value: dataTransfer })
        Object.defineProperty(over, 'clientY', { value: 10 })
        rows[1]!.dispatchEvent(over)
        expect(rows[1]!.getAttribute('data-dod')).toBe('down')

        rows[1]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(h.resortSubTasks).toHaveBeenCalledWith('sub-1', 'sub-2', false)
    })

    it('dragstart 设置自定义半透明拖拽预览（setDragImage）并在 dragstart 后移除 clone', async () => {
        const h = mountRows([makeSubTask({ id: 'sub-1' })])
        const row = h.wrapper.find('.subtask-row').element
        const setDragImage = vi.fn()
        const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '', setDragImage }
        const event = new Event('dragstart', { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
        Object.defineProperty(event, 'clientX', { value: 12 })
        Object.defineProperty(event, 'clientY', { value: 24 })
        row.dispatchEvent(event)

        expect(setDragImage).toHaveBeenCalledTimes(1)
        const [clone, offsetX, offsetY] = setDragImage.mock.calls[0] as [
            HTMLElement,
            number,
            number
        ]
        expect(clone).toBeInstanceOf(HTMLElement)
        expect(clone.style.opacity).toBe('0.35')
        // 灰色底 + 圆角（jsdom 不解析 var()，断言原文；浏览器中 :root 变量可解析）
        expect(clone.style.backgroundColor).toBe('var(--nue-primary-color-100)')
        expect(clone.style.borderRadius).toBe('var(--nue-primary-radius)')
        // jsdom getBoundingClientRect 全 0 ⇒ offset = clientX/Y
        expect(offsetX).toBe(12)
        expect(offsetY).toBe(24)
        expect(document.body.contains(clone)).toBe(true)

        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(document.body.contains(clone)).toBe(false)
    })
})

describe('TASK-04 子任务行：名称右侧只读标签栏 + 时间下移独立行', () => {
    const tagPool: TaskTagViewObject[] = [
        { id: 'tag-1', name: '工作', color: '#3b82f6' },
        { id: 'tag-2', name: '紧急', color: '#ef4444' },
        { id: 'tag-3', name: '项目', color: '#10b981' }
    ]

    it('AC1 主路径：有标签 ⇒ 名称右侧渲染只读 small 标签栏（clamped=2，标签池复用详情上下文）', async () => {
        const h = mountRows([makeSubTask({ tags: ['tag-1', 'tag-2'] })], tagPool)
        const bar = h.wrapper.findComponent(TaskTagBar)
        expect(bar.exists()).toBe(true)
        // 只读 + 小尺寸 + 溢出上限 2（标签池 = 详情上下文注入的 tags）
        expect(bar.props('readonly')).toBe(true)
        expect(bar.props('small')).toBe(true)
        expect(bar.props('clamped')).toBe(2)
        expect(bar.props('availableTags')).toEqual(tagPool)
        expect(bar.props('taskTagIds')).toEqual(['tag-1', 'tag-2'])
        // 标签栏位于标题行内（名称右侧、脱离按钮左侧）
        const titleLine = h.wrapper.find('.subtask-row__title-line')
        expect(titleLine.findComponent(TaskTagBar).exists()).toBe(true)
        const nameEl = h.wrapper.find('.subtask-row__name').element
        expect(
            nameEl.compareDocumentPosition(bar.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        // 标签文本渲染，且只读：无删除按钮、无编辑输入
        expect(h.wrapper.text()).toContain('工作')
        expect(h.wrapper.text()).toContain('紧急')
        expect(h.wrapper.find('.tag-node__delete-button').exists()).toBe(false)
        expect(h.wrapper.find('.subtask-row input').exists()).toBe(false)
        // 只读标签栏不触发详情导航
        await bar.trigger('click')
        expect(h.switchTaskDetails).not.toHaveBeenCalled()
    })

    it('AC2 空态：无标签不渲染标签栏；无时间不渲染时间行（无空占位）', () => {
        const h = mountRows([makeSubTask({ description: '有描述' })])
        expect(h.wrapper.findComponent(TaskTagBar).exists()).toBe(false)
        expect(h.wrapper.find('.subtask-row__time').exists()).toBe(false)
        // 描述仍在，且未被标签栏/时间行挤出布局断言之外
        expect(h.wrapper.find('.subtask-row__meta').exists()).toBe(true)
        // 有标签但无时间：标签栏渲染、时间行不渲染
        const onlyTags = mountRows([makeSubTask({ tags: ['tag-1'] })], tagPool)
        expect(onlyTags.wrapper.findComponent(TaskTagBar).exists()).toBe(true)
        expect(onlyTags.wrapper.find('.subtask-row__time').exists()).toBe(false)
    })

    it('AC3 边界：标签数 > clamped ⇒ 溢出 +N 展示（2 个实体标签 + 1 个 +N）', () => {
        const h = mountRows(
            [makeSubTask({ tags: ['tag-1', 'tag-2', 'tag-3'], startAt: futureIso(1) })],
            tagPool
        )
        const names = h.wrapper.findAll('.tag-node__name').map((n) => n.text())
        // 前 2 个标签 + 溢出计数 +1（第 3 个不重复渲染，由 +N 汇总）
        expect(names).toEqual(['工作', '紧急', '+1'])
        // 时间独立行与标签栏共存（AC1 主路径叠加）
        expect(h.wrapper.find('.subtask-row__time').exists()).toBe(true)
    })

    it('AC4 负向闭环：无标签子任务拖拽排序 / 勾选 / 脱离按钮仍常驻标题行（零回归）', async () => {
        const h = mountRows([makeSubTask({ id: 'sub-1', tags: [] })])
        expect(h.wrapper.findComponent(TaskTagBar).exists()).toBe(false)
        // 拖拽契约不变（行级 draggable / data-drag-item / data-sid）
        const row = h.wrapper.find('.subtask-row')
        expect(row.attributes('draggable')).toBe('true')
        expect(row.attributes('data-drag-item')).toBe('true')
        expect(row.attributes('data-sid')).toBe('sub-1')
        // 勾选完成 / 脱离按钮仍在标题行
        h.wrapper.findComponent(TaskCheckButton).vm.$emit('change')
        expect(h.updateTaskState).toHaveBeenCalledWith('sub-1', 'done')
        expect(
            h.wrapper.find('.subtask-row__title-line').find('.subtask-row__detach').exists()
        ).toBe(true)
    })
})