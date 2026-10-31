import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import {
    NueButton,
    NueContainer,
    NueContent,
    NueDiv,
    NueEmpty,
    NueHeader,
    NueIcon,
    NueInfiniteScroll,
    NueLink,
    NueMain,
    NueProgress,
    NueSeparator,
    NueText
} from 'nue-ui'
import { vi } from 'vite-plus/test'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { defaultColumns, type TaskColumnOptions } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import TaskKanban from '../kanban.vue'

/**
 * T608 看板用例 harness（`DEF-114` / PRD `docs/prds/2026-10-31-kanban-priority-grouping.md`）
 *
 * @description **真实挂载** `TaskKanban`（真身 `nue-*` 组件，仅 `$route` 用 mock，因为列内部
 *              用 `$route.params.taskId` 标记激活卡片）⇒ 断言落在**用户可见的列头文本 / 列内容 /
 *              仓储 `update` 入参**，不依赖 RD 内部实现形状（除下方「接缝假设」）。
 *
 * **接缝假设（PM `T608` 裁定 A 规格）**：
 *   ① 分组切换入口在 `TaskKanban` 内部（看板容器顶部一行）——若实现移到
 *      `view-adapters/kanban-view-adapter.vue`，须先与 QA 对齐接缝，否则 AC1a/AC1b 会「假红」；
 *   ② 列元素仍带 `data-category`（拖拽 `getTargetNode` 的既有依赖，见 `use-kanban-dragger.ts`）；
 *   ③ 列头容器仍为 `.kanban-column__header`（现有类名，本次只改其**内容**）；
 *   ④ 卡片元素仍带 `data-taskid`（现有 `data-taskId` 绑定）。
 */

/**
 * jsdom 缺 `IntersectionObserver` / `requestIdleCallback`：`nue-infinite-scroll` 与
 * `useMinuteTask` 会用到。替换为无害桩（不影响看板列渲染与拖拽链路）。
 */
const installDomStubs = () => {
    const scope = globalThis as unknown as Record<string, unknown>
    if (typeof scope.IntersectionObserver === 'undefined') {
        scope.IntersectionObserver = class {
            root = null
            rootMargin = ''
            thresholds: number[] = []
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return []
            }
        }
    }
    if (typeof scope.requestIdleCallback === 'undefined') {
        scope.requestIdleCallback = (cb: (deadline: unknown) => void) =>
            setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0)
    }
}

installDomStubs()

export class MissingImplementationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'MissingImplementationError'
    }
}

const NUE_COMPONENTS = {
    'nue-button': NueButton,
    'nue-container': NueContainer,
    'nue-content': NueContent,
    'nue-div': NueDiv,
    'nue-empty': NueEmpty,
    'nue-header': NueHeader,
    'nue-icon': NueIcon,
    'nue-infinite-scroll': NueInfiniteScroll,
    'nue-link': NueLink,
    'nue-main': NueMain,
    'nue-progress': NueProgress,
    'nue-separator': NueSeparator,
    'nue-text': NueText
}

/** 任务视图对象最小工厂（未给出的字段按「空任务」填充，避免每个用例重复 25 个字段） */
export const makeTask = (overrides: Partial<TaskViewObject> & { id: string }): TaskViewObject => ({
    createdAt: '2026-10-31 10:00:00',
    updatedAt: '2026-10-31 10:00:00',
    deletedAt: null,
    parentTaskId: null,
    userId: 'user-1',
    name: overrides.id,
    description: '',
    state: 'todo',
    priority: 'medium',
    startAt: null,
    endAt: null,
    projectId: null,
    tags: [],
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
    sortId: 0,
    isDeleted: false,
    isArchived: false,
    isStarMarked: false,
    isGivenUp: false,
    ...overrides
})

export type UpdateCall = { taskId: string; payload: Record<string, unknown> }

export type KanbanHarness = {
    wrapper: VueWrapper
    /** 仓储 `update` 的 spy（**AC2/AC3/AC4 的判据落点**：抓实际写入参数） */
    update: ReturnType<typeof vi.fn>
    calls: () => UpdateCall[]
}

/**
 * 挂载真实看板
 * @param tasks 初始任务（也是「库中原值」的替身：断言未被改写的依据）
 * @param updateResult `taskUseCase.update` 的返回码（`null` = 成功；错误码 = 离线/只读等失败路径）
 */
export const mountKanban = (
    tasks: TaskViewObject[],
    updateResult: string | null = null
): KanbanHarness => {
    const update = vi.fn(async (taskId: string, payload: Record<string, unknown>) => {
        void taskId
        void payload
        return updateResult
    })

    const wrapper = mount(TaskKanban, {
        attachTo: document.body,
        props: {
            tags: [],
            tasks,
            columns: { ...defaultColumns } as TaskColumnOptions,
            sortOptions: { field: 'createdAt', order: 'desc' },
            taskUseCase: { update } as unknown as TaskUseCase,
            columnLabelGetter: (key: string) => key,
            projectNameGetter: () => ''
        },
        global: {
            components: NUE_COMPONENTS,
            mocks: { $route: { params: {} } }
        }
    })

    const calls = (): UpdateCall[] =>
        update.mock.calls.map(([taskId, payload]) => ({
            taskId: taskId as string,
            payload: payload as Record<string, unknown>
        }))

    return { wrapper, update, calls: calls as KanbanHarness['calls'] }
}

/** 全部列元素（列根 = 拖拽落点，带 `data-category`） */
export const columnNodes = (wrapper: VueWrapper): DOMWrapper<Element>[] =>
    wrapper.findAll('[data-category]')

export const columnNode = (wrapper: VueWrapper, category: string): DOMWrapper<Element> => {
    const node = columnNodes(wrapper).find((n) => n.attributes('data-category') === category)
    if (!node) {
        throw new MissingImplementationError(
            `[缺实现] 看板无「${category}」列；实测列 = ${JSON.stringify(
                columnNodes(wrapper).map((n) => n.attributes('data-category'))
            )}`
        )
    }
    return node
}

/** 列头文本（`kanban-column.vue` 现有类名；本次只换内容不换容器） */
export const headerText = (node: DOMWrapper<Element>): string => {
    const header =
        node.element.querySelector('.kanban-column__header') ?? node.element.firstElementChild
    return (header?.textContent ?? '').replace(/\s+/g, '')
}

/** 列内卡片 ID（按渲染顺序） */
export const taskIdsIn = (node: DOMWrapper<Element>): string[] =>
    Array.from(node.element.querySelectorAll('[data-taskid]')).map(
        (el) => el.getAttribute('data-taskid') ?? ''
    )

export const cardNode = (wrapper: VueWrapper, taskId: string): DOMWrapper<Element> => {
    const node = wrapper
        .findAll('[data-taskid]')
        .find((n) => n.attributes('data-taskid') === taskId)
    if (!node) {
        throw new MissingImplementationError(
            `[缺实现] 看板未渲染任务卡片「${taskId}」；实测 = ${JSON.stringify(
                wrapper.findAll('[data-taskid]').map((n) => n.attributes('data-taskid'))
            )}`
        )
    }
    return node
}

/**
 * 拖拽：卡片 `dragstart` → 列根 `drop`（两条 handler 都挂在列组件根元素上，事件冒泡到它）
 * @description 只走产品既有 DOM 事件链（`use-kanban-dragger`），不直接调内部函数 ⇒
 *              实现改动（如改用 pointer 事件）会被本用例暴露，而不是被绕过。
 */
export const dragTaskTo = async (
    wrapper: VueWrapper,
    taskId: string,
    category: string
): Promise<void> => {
    const card = cardNode(wrapper, taskId)
    const column = columnNode(wrapper, category)
    await card.trigger('dragstart')
    await column.trigger('drop')
    await flushPromises()
}

// --- AC1a：分组切换控件 ---

export const GROUP_BY_LABELS = { state: '按状态', priority: '按优先级' } as const

/** 控件候选：文本命中「按状态 / 按优先级」的最深元素 */
const labelNodes = (wrapper: VueWrapper, label: string): DOMWrapper<Element>[] =>
    wrapper.findAll('*').filter((n) => (n.text() ?? '').replace(/\s+/g, '').includes(label))

/**
 * 取「分段」的文本节点（最深、文本命中标签的元素）
 * @throws MissingImplementationError 控件不存在（= AC1a 红基线的「缺能力」形态）
 */
export const segmentNode = (wrapper: VueWrapper, label: string): DOMWrapper<Element> => {
    const [deepest] = labelNodes(wrapper, label).sort(
        (a, b) => a.element.querySelectorAll('*').length - b.element.querySelectorAll('*').length
    )
    if (!deepest) {
        throw new MissingImplementationError(
            `[缺实现] 看板未渲染分组切换控件「${label}」（PM A 规格：看板顶部两段切换）`
        )
    }
    return deepest
}

const CONTROL_SELECTOR = 'button, [role="tab"], [role="radio"], [aria-pressed]'

/** 文本所属的**可点击控件**（`button` / `role=tab|radio`），纯文本 ⇒ `null` */
export const controlOf = (node: DOMWrapper<Element>): HTMLElement | null =>
    (node.element.closest(CONTROL_SELECTOR) as HTMLElement | null) ?? null

/** 选中态（`aria-pressed` / `aria-selected`），无该属性 ⇒ `null` */
export const selectedState = (node: DOMWrapper<Element>): string | null => {
    let cursor: Element | null = node.element
    while (cursor) {
        const value =
            cursor.getAttribute('aria-pressed') ?? cursor.getAttribute('aria-selected') ?? null
        if (value !== null) return value
        cursor = cursor.parentElement
    }
    return null
}

/** 点击某个分段（AC1b 的前置动作） */
export const clickSegment = async (
    wrapper: VueWrapper,
    groupBy: keyof typeof GROUP_BY_LABELS
): Promise<void> => {
    const node = segmentNode(wrapper, GROUP_BY_LABELS[groupBy])
    await node.trigger('click')
    await flushPromises()
}

/** 断言用：优先级短标签（列头应写的就是它，而不是状态名） */
export const priorityLabel = (priority: string): string =>
    t(`task.priority.short.${priority}` as never)

export const stateLabel = (state: 'todo' | 'in-progress' | 'done'): string =>
    t(
        (
            {
                todo: 'task.state.todo',
                'in-progress': 'task.state.inProgress',
                done: 'task.state.done'
            } as const
        )[state] as never
    )