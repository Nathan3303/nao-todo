// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { InputButton } from '@nao-todo/shared/components/input-button'
import { parse2RelativeDate } from '@nao-todo/shared/utils/relative-date-parser'
import { t } from '@nao-todo/shared/locales'
import { TaskCheckButton } from '@nao-todo/shared/components/task-check-button'
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
 * TASK-06 子任务节点 UI 优化（脱离按钮移除 / 时间·描述合并单行 / 数量徽标）：
 *              覆盖① 脱离按钮/逻辑/样式整体移除（DOM 无 detach 按钮、无确认流）；
 *              ② 时间·描述合并单行（` · ` 拼接、任缺剩另一部分、皆空不渲染、无悬空分隔符、
 *              title 提供全文、摘要行不导航）；③ 检查项/子任务数量徽标（>0 才渲染、两者独立、
 *              名称行末标签栏后 flex 0 0 auto 不挤占名称）；样式数值为 CSS 契约以静态论证列入汇报。
 */
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
        checkItemCount: 0,
        subtaskCount: 0,
        ...overrides
    }) as TaskViewObject

type Harness = {
    wrapper: VueWrapper
    switchTaskDetails: ReturnType<typeof vi.fn>
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

/** 摘要文案（与组件内 `subTaskMeta` 同口径：时间 · 描述，空段过滤） */
const subTaskMetaOf = (
    startAt: string | null,
    endAt: string | null,
    description?: string
): string => [timeTextOf(startAt, endAt), description].filter(Boolean).join(' · ')

describe('TASK-02 子任务行：时间内联 + 行内改名移除 + 脱离按钮并入标题行', () => {
    it('U-R1 时间文案四态：仅开始 / 仅结束 / 两者 / 皆无（文案与格式不变，与描述同住摘要行）', () => {
        const startAt = futureIso(1)
        const endAt = futureIso(3)

        // 两者：`开始 <相对> ~ 结束 <相对>`；无描述时摘要行仅时间（合并后仍无悬空 `·`）
        const both = mountRows([makeSubTask({ startAt, endAt })])
        const meta = both.wrapper.find('.subtask-row__meta')
        expect(meta.exists()).toBe(true)
        expect(meta.text()).toBe(timeTextOf(startAt, endAt))
        expect(meta.text()).toContain(' ~ ')
        expect(meta.text()).not.toContain('·')
        // 摘要行位于 body 内名称行（title-line）之后（AC① 布局）
        const titleLine = both.wrapper.find('.subtask-row__title-line')
        expect(titleLine.find('.subtask-row__meta').exists()).toBe(false)
        const nameEl = both.wrapper.find('.subtask-row__name').element
        expect(
            nameEl.compareDocumentPosition(meta.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()

        // 仅开始 / 仅结束
        const onlyStart = mountRows([makeSubTask({ startAt })])
        expect(onlyStart.wrapper.find('.subtask-row__meta').text()).toBe(timeTextOf(startAt, null))
        const onlyEnd = mountRows([makeSubTask({ endAt })])
        expect(onlyEnd.wrapper.find('.subtask-row__meta').text()).toBe(timeTextOf(null, endAt))

        // 皆无且无描述 ⇒ 摘要行不渲染（无悬空 `~`/`·`，也无空占位）
        const none = mountRows([makeSubTask()])
        expect(none.wrapper.find('.subtask-row__meta').exists()).toBe(false)
        expect(none.wrapper.text()).not.toContain('~')
    })

    it('U-R2 时间·描述合并单行：两者以 ` · ` 拼接；任缺剩另一部分；皆空不渲染', () => {
        const startAt = futureIso(1)
        const endAt = futureIso(2)

        // 两者：`时间 · 描述` 单行合并（TASK-06：原时间独立行与 meta 行合并）
        const withDesc = mountRows([makeSubTask({ description: '描述文本', startAt, endAt })])
        const meta = withDesc.wrapper.find('.subtask-row__meta')
        expect(meta.exists()).toBe(true)
        expect(meta.text()).toBe(subTaskMetaOf(startAt, endAt, '描述文本'))
        expect(meta.text()).toContain(' · ')

        // 仅描述：不产生前导/尾随 ` · `（无悬空分隔符）
        const descOnly = mountRows([makeSubTask({ description: '描述文本' })])
        expect(descOnly.wrapper.find('.subtask-row__meta').text()).toBe('描述文本')
        expect(descOnly.wrapper.find('.subtask-row__meta').text()).not.toContain('·')

        // 皆无：不渲染
        const none = mountRows([makeSubTask({ description: undefined })])
        expect(none.wrapper.find('.subtask-row__meta').exists()).toBe(false)
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

    it('U-R4 摘要行 title 提供全文（时间+描述），脱离按钮已整体移除（无按钮元素/无确认流）', () => {
        const startAt = futureIso(1)
        const endAt = futureIso(2)
        const { wrapper: w } = mountRows([makeSubTask({ startAt, endAt, description: '描述文本' })])
        // title = 合并全文（不做绝对时间转换）
        expect(w.find('.subtask-row__meta').attributes('title')).toBe(
            subTaskMetaOf(startAt, endAt, '描述文本')
        )
        // TASK-06：脱离按钮移除 —— DOM 无 detach 按钮；旧时间独立行也已合并（无残留元素）
        expect(w.find('.subtask-row__detach').exists()).toBe(false)
        expect(w.find('.subtask-row__time').exists()).toBe(false)
        // 摘要行位于 body（名称行之下）
        expect(w.find('.subtask-row__body').find('.subtask-row__meta').exists()).toBe(true)
    })

    it('AC⑥ 点击口径：名称导航、摘要行不导航（脱离按钮已移除）', async () => {
        const subTask = makeSubTask({ startAt: futureIso(1), endAt: futureIso(2) })
        const h = mountRows([subTask])

        // 点击名称 ⇒ 进入详情
        await h.wrapper.find('.subtask-row__name').trigger('click')
        expect(h.switchTaskDetails).toHaveBeenCalledWith(subTask.id)

        // 点击摘要行 ⇒ 不导航
        h.switchTaskDetails.mockClear()
        await h.wrapper.find('.subtask-row__meta').trigger('click')
        expect(h.switchTaskDetails).not.toHaveBeenCalled()
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
        // 摘要行（含时间，TASK-06 合并）与标签栏共存（AC1 主路径叠加）
        const startAt = futureIso(1)
        expect(h.wrapper.find('.subtask-row__meta').text()).toBe(timeTextOf(startAt, null))
    })

    it('AC4 负向闭环：无标签子任务拖拽排序 / 勾选正常（脱离按钮已移除，零回归）', async () => {
        const h = mountRows([makeSubTask({ id: 'sub-1', tags: [] })])
        expect(h.wrapper.findComponent(TaskTagBar).exists()).toBe(false)
        // 拖拽契约不变（行级 draggable / data-drag-item / data-sid）
        const row = h.wrapper.find('.subtask-row')
        expect(row.attributes('draggable')).toBe('true')
        expect(row.attributes('data-drag-item')).toBe('true')
        expect(row.attributes('data-sid')).toBe('sub-1')
        // 勾选完成正常；脱离按钮已在 TASK-06 移除（不再常驻标题行）
        h.wrapper.findComponent(TaskCheckButton).vm.$emit('change')
        expect(h.updateTaskState).toHaveBeenCalledWith('sub-1', 'done')
        expect(h.wrapper.find('.subtask-row__detach').exists()).toBe(false)
    })
})

describe('TASK-06 子任务节点：数量徽标（检查项 / 子任务）', () => {
    it('>0 才渲染且各自独立：仅检查项 ⇒ 只有 check 徽标；仅子任务 ⇒ 只有 subtask 徽标；皆 0 不渲染', () => {
        const checkOnly = mountRows([makeSubTask({ checkItemCount: 3, subtaskCount: 0 })])
        const checkBadge = checkOnly.wrapper.find('.subtask-row__badge--check')
        const subBadge = checkOnly.wrapper.find('.subtask-row__badge--subtask')
        expect(checkBadge.exists()).toBe(true)
        expect(checkBadge.text()).toBe('3')
        expect(subBadge.exists()).toBe(false)

        const subOnly = mountRows([makeSubTask({ checkItemCount: 0, subtaskCount: 2 })])
        expect(subOnly.wrapper.find('.subtask-row__badge--check').exists()).toBe(false)
        const subBadgeOnly = subOnly.wrapper.find('.subtask-row__badge--subtask')
        expect(subBadgeOnly.exists()).toBe(true)
        expect(subBadgeOnly.text()).toBe('2')

        const none = mountRows([makeSubTask()])
        expect(none.wrapper.find('.subtask-row__badge').exists()).toBe(false)
    })

    it('徽标与标签栏共存：顺序为 名称 → check 徽标 → 标签栏 → subtask 徽标；title 提供 i18n 文案（含数量）', async () => {
        const h = mountRows(
            [makeSubTask({ tags: ['tag-1'], checkItemCount: 3, subtaskCount: 2 })],
            [{ id: 'tag-1', name: '工作', color: '#3b82f6' }]
        )
        const titleLine = h.wrapper.find('.subtask-row__title-line')
        const checkBadge = titleLine.find('.subtask-row__badge--check')
        const subBadge = titleLine.find('.subtask-row__badge--subtask')
        const tagBarEl = titleLine.findComponent(TaskTagBar).element
        expect(checkBadge.exists()).toBe(true)
        expect(subBadge.exists()).toBe(true)
        // 新顺序（用户样式微调）：名称 → check 徽标 → 标签栏 → subtask 徽标（行尾）
        const nameEl = h.wrapper.find('.subtask-row__name').element
        expect(
            nameEl.compareDocumentPosition(checkBadge.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        expect(
            checkBadge.element.compareDocumentPosition(tagBarEl) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        expect(
            tagBarEl.compareDocumentPosition(subBadge.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        // title = i18n 文案（含数量插值）
        expect(checkBadge.attributes('title')).toBe(t('task.details.checkItemCount', { count: 3 }))
        expect(subBadge.attributes('title')).toBe(t('task.details.subtaskCount', { count: 2 }))
        // 徽标不触发详情导航
        await checkBadge.trigger('click')
        expect(h.switchTaskDetails).not.toHaveBeenCalled()
    })

    it('徽标与标签栏共存且不挤占名称（flex 0 0 auto 为 CSS 契约，静态论证）', () => {
        const h = mountRows(
            [
                makeSubTask({
                    tags: ['tag-1', 'tag-2'],
                    checkItemCount: 5,
                    subtaskCount: 1
                })
            ],
            [
                { id: 'tag-1', name: '工作', color: '#3b82f6' },
                { id: 'tag-2', name: '紧急', color: '#ef4444' }
            ]
        )
        expect(h.wrapper.findComponent(TaskTagBar).exists()).toBe(true)
        const badges = h.wrapper.findAll('.subtask-row__badge')
        expect(badges).toHaveLength(2)
        // 徽标均位于标题行内（与标签栏同一行，互不换行挤占）
        expect(
            h.wrapper.find('.subtask-row__title-line').find('.subtask-row__badge').exists()
        ).toBe(true)
    })
})