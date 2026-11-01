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
import { ref, type Ref } from 'vue'
import { vi } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    defaultColumns,
    type GetTasksOptions,
    type GetTasksSortOptions,
    type TaskColumnOptions
} from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
// 走桶导入（而非 `../kanban.vue`）：与页面/适配器侧**同一模块入口**。若两处入口混用，
// 测试环境里桶的 `export const TaskKanban = <SFC 默认导出>` 会因模块求值顺序变成空对象（组件渲染为空）。
import { TaskKanban } from '..'
import { KANBAN_GROUP_BY_KEY } from '../use-kanban-group'
import {
    createFakeTaskRepository,
    type FakeTaskRepository,
    type UpdateCall
} from './t620-fake-task-repository'

/**
 * T608 / T620 看板用例 harness
 *
 * @description **真实挂载** `TaskKanban`（真身 `nue-*` 组件，仅 `$route` 用 mock，因为列内部
 *              用 `$route.params.taskId` 标记激活卡片）⇒ 断言落在**用户可见的列头文本 / 列内卡片 /
 *              仓储 `list` `update` 入参**，不依赖 RD 内部实现形状（除下方「接缝」）。
 *
 * **接缝（`T620` 升级；`DEF-126` 看板列内分页）**
 *   ① 数据面：列不再吃父级传入的 `tasks`，而是**每列自持 loader ⇒ `taskUseCase.list`**
 *      ⇒ harness 注入 fake `list`（内存分页 + 列条件过滤，见 `t620-fake-task-repository.ts`）。
 *      **兼容过渡**：`tasks` prop 仍按组件**是否声明**自动注入（RD 移除后自动停投），
 *      使 `T608` / `T612` / `T614` 既有用例在改造前后都可用（断言逐字未动）。
 *   ② 新契约（ADR `2026-11-01-kanban-column-paging.md` 决策 2）：`getTasksOptions` /
 *      `getTask(id)` / `refreshToken` 一并注入；`getTasksOptions` 变化 = 筛选变化，
 *      `refreshToken` 递增 = `RefreshData`（`AC5`/`AC6` 的触发口）。
 *   ③ 触底：**不直接 emit `load-more`**，而是给 `IntersectionObserver` 装可控桩，
 *      对列内触底哨兵派发 `isIntersecting` ⇒ 与用户滚动同路径，`disabled` 由组件自己拦
 *      （`AC4`「到底后零请求」才作数）。
 *   ④ 分组状态仍经注入键 `KANBAN_GROUP_BY_KEY`（实现单点 `../use-kanban-group.ts`）；
 *      列元素仍带 `data-category`；列头容器仍为 `.kanban-column__header`；卡片仍带 `data-taskid`。
 */

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void

type IntersectionRecord = { callback: IntersectionCallback; targets: Set<Element> }

/** 当前文档内注册的观察者（可控桩；只为「把某列滚到底」服务） */
const intersectionObservers = new Set<IntersectionRecord>()

/**
 * jsdom 缺 `IntersectionObserver` / `requestIdleCallback`：前者换成**可控桩**
 * （`triggerIntersection` 可对该元素派发触底），后者换成无害桩（`useMinuteTask` 用）。
 */
const installDomStubs = () => {
    const scope = globalThis as unknown as Record<string, unknown>
    scope.IntersectionObserver = class {
        root = null
        rootMargin = ''
        thresholds: number[] = []
        private record: IntersectionRecord = {
            callback: () => {},
            targets: new Set<Element>()
        }
        constructor(callback: IntersectionCallback) {
            this.record.callback = callback
            intersectionObservers.add(this.record)
        }
        observe(target: Element) {
            this.record.targets.add(target)
        }
        unobserve(target: Element) {
            this.record.targets.delete(target)
        }
        disconnect() {
            intersectionObservers.delete(this.record)
        }
        takeRecords() {
            return []
        }
    }
    if (typeof scope.requestIdleCallback === 'undefined') {
        scope.requestIdleCallback = (cb: (deadline: unknown) => void) =>
            setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0)
    }
}

installDomStubs()

/**
 * 触发「该元素滚进视口」
 * @returns 命中的观察者数量（0 = 该元素没有被任何 infinite-scroll 观察 ⇒ 分页未接线）
 */
const triggerIntersection = (target: Element): number => {
    let fired = 0
    for (const observer of intersectionObservers) {
        if (!observer.targets.has(target)) continue
        fired += 1
        observer.callback([{ isIntersecting: true, target }])
    }
    return fired
}

export class MissingImplementationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'MissingImplementationError'
    }
}

export const NUE_COMPONENTS = {
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

export type { UpdateCall }

export type KanbanGroupBy = 'state' | 'priority'

/**
 * 分组状态注入键（`T612` 接缝）
 * @description 真实实现 = `../use-kanban-group.ts` 导出的 `KANBAN_GROUP_BY_KEY`；
 *              `mountKanban(..., { groupBy })` 通过 `global.provide` 注入，看板与菜单读同一份 ref。
 */
export { KANBAN_GROUP_BY_KEY }

/** 每个挂载实例的分组 ref（`clickSegment` 需要按 wrapper 找回注入的那一份） */
const groupByRefs = new WeakMap<VueWrapper, Ref<KanbanGroupBy>>()

/** 每个挂载实例的 fake 仓储（`AC4`/`AC11` 的查询计数、`AC4②` 的原值判据） */
const repositories = new WeakMap<VueWrapper, FakeTaskRepository>()

export type KanbanHarness = {
    wrapper: VueWrapper
    /** 仓储 `update` 的 spy（**写载荷判据**：抓实际写入参数） */
    update: ReturnType<typeof vi.fn>
    calls: () => UpdateCall[]
    /** 仓储 `list` 的 spy（**分页 / 求交判据**） */
    list: ReturnType<typeof vi.fn>
    /** `list` 实际入参（按调用顺序） */
    listCalls: () => GetTasksOptions[]
    /** 本地库当前内容（`getTask` 数据源；拖拽 / 新增后为最新值） */
    db: () => TaskViewObject[]
    /** 注入给看板的分组状态（单一来源；看板与菜单读同一份 ref） */
    groupBy: Ref<KanbanGroupBy>
    /** 触发 `RefreshData`（`AC5`）：`refreshToken` 递增 */
    refresh: () => Promise<void>
    /** 改用户基础筛选（`AC6` / `AC11`）：`getTasksOptions` 换新对象 */
    setFilters: (next: GetTasksOptions) => Promise<void>
    /** 改排序（`AC6`）：`sortOptions` 换新对象 */
    setSort: (next: GetTasksSortOptions) => Promise<void>
}

export type MountKanbanOptions = {
    groupBy?: KanbanGroupBy
    /** 用户基础筛选（默认 `{}`；`AC11` 传 `{ priority: 'high' }`） */
    getTasksOptions?: GetTasksOptions
    /** 排序（默认 `createdAt desc`，与页面一致） */
    sortOptions?: GetTasksSortOptions
}

/** 组件是否仍声明 `tasks` prop（`D5` 移除后自动停投，避免把大数组塞进 DOM attr） */
const kanbanPropNames = new Set(
    Object.keys((TaskKanban as unknown as { props?: Record<string, unknown> }).props ?? {})
)
const declaresProp = (name: string): boolean =>
    kanbanPropNames.size === 0 ? true : kanbanPropNames.has(name)

/**
 * 等异步 loader 收敛（`list` → store → 渲染）
 * @description 列内 loader 是异步的 ⇒ 断言前必须让微任务与渲染队列清空；两轮覆盖
 *              「查询 → 列渲染 → 子项渲染」的链式 tick。
 */
export const settle = async (): Promise<void> => {
    await flushPromises()
    await flushPromises()
}

/**
 * 挂载真实看板
 * @param tasks 初始任务（= 本地库初始内容）
 * @param updateResult `taskUseCase.update` 的返回码（`null` = 成功；错误码 = 离线/只读等失败路径）
 * @param options 分组 / 基础筛选 / 排序
 */
export const mountKanban = (
    tasks: TaskViewObject[],
    updateResult: string | null = null,
    options: MountKanbanOptions = {}
): KanbanHarness => {
    const groupBy = ref<KanbanGroupBy>(options.groupBy ?? 'state')
    const repository = createFakeTaskRepository(tasks, updateResult)
    const refreshToken = ref(0)

    const props: Record<string, unknown> = {
        tags: [],
        columns: { ...defaultColumns } as TaskColumnOptions,
        sortOptions: options.sortOptions ?? { field: 'createdAt', order: 'desc' },
        taskUseCase: repository.taskUseCase,
        columnLabelGetter: (key: string) => key,
        projectNameGetter: () => '',
        // --- 新契约（ADR 决策 2）：`tasks` 退役后的数据面 ---
        getTasksOptions: options.getTasksOptions ?? {},
        getTask: (taskId: string) => repository.db().find((task) => task.id === taskId),
        refreshToken: refreshToken.value
    }
    // 过渡期兼容：组件仍声明 `tasks` 时照旧注入（RD 移除后自动不再投）
    if (declaresProp('tasks')) props.tasks = repository.db()

    const wrapper = mount(TaskKanban, {
        attachTo: document.body,
        props: props as unknown as InstanceType<typeof TaskKanban>['$props'],
        global: {
            components: NUE_COMPONENTS,
            mocks: { $route: { params: {} } },
            provide: { [KANBAN_GROUP_BY_KEY]: groupBy }
        }
    })

    groupByRefs.set(wrapper, groupBy)
    repositories.set(wrapper, repository)

    const refresh = async () => {
        refreshToken.value += 1
        await wrapper.setProps({ refreshToken: refreshToken.value } as never)
        await settle()
    }

    const setFilters = async (next: GetTasksOptions) => {
        await wrapper.setProps({ getTasksOptions: next } as never)
        await settle()
    }

    const setSort = async (next: GetTasksSortOptions) => {
        await wrapper.setProps({ sortOptions: next } as never)
        await settle()
    }

    return {
        wrapper,
        update: repository.update,
        calls: repository.updateCalls,
        list: repository.list,
        listCalls: repository.listCalls,
        db: repository.db,
        groupBy,
        refresh,
        setFilters,
        setSort
    }
}

/** 本地库当前内容（**原值判据**：如「归类不改写库中原值」） */
export const tasksInStore = (wrapper: VueWrapper): TaskViewObject[] =>
    repositories.get(wrapper)?.db() ?? []

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

/**
 * 列头数字（**必须是该列总数 `pagination.total`**，不是已加载数 —— PRD R-D / AC3）
 * @description 列头形如「待办 45」；取第一段数字。缺失 ⇒ 抛缺实现。
 */
export const columnTotal = (node: DOMWrapper<Element>): number => {
    const text = headerText(node)
    const matched = text.match(/(\d+)/)
    if (!matched) {
        throw new MissingImplementationError(`[缺实现] 列头未渲染数字；实测「${text}」`)
    }
    return Number(matched[1])
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

/** 到底文案（PRD R-B：用户已定口径） */
export const NO_MORE_TEXT = '没有更多了'

/** 列内 `nue-infinite-scroll` 的「到底」条（`R-L` 要求它必须可见） */
export const disableBarNode = (node: DOMWrapper<Element>): Element | null =>
    node.element.querySelector('.nue-infinite-scroll__disable-bar')

/**
 * 列内「没有更多了」是否**可见**
 * @description 三重判据（缺一即判定不可见）：① 文案命中；② 自身/祖先没有 `display:none`
 *              `visibility:hidden` `hidden`；③ `getComputedStyle` 不是 `none`/`hidden`。
 *              组件样式被 SFC 隐藏（`R-L` 的现状）时 ① / ② 之外还有一条**源码级**守卫，
 *              见 `t620-ac4-no-more-visible.test.ts`（jsdom 不解析 SFC scoped 样式）。
 */
export const isNoMoreVisible = (node: DOMWrapper<Element>): boolean => {
    const bar = disableBarNode(node)
    if (!bar) return false
    if (!(bar.textContent ?? '').replace(/\s+/g, '').includes(NO_MORE_TEXT)) return false
    let cursor: Element | null = bar
    while (cursor) {
        const element = cursor as HTMLElement
        if (element.style?.display === 'none') return false
        if (element.style?.visibility === 'hidden') return false
        if (element.hasAttribute?.('hidden')) return false
        cursor = cursor.parentElement
    }
    const style = globalThis.getComputedStyle(bar)
    return style.display !== 'none' && style.visibility !== 'hidden'
}

/** 某列的查询次数（按分组维度归属：`state` / `priority`） */
export const listCallsFor = (
    harness: KanbanHarness,
    groupBy: KanbanGroupBy,
    category: string
): GetTasksOptions[] =>
    harness.listCalls().filter((options) => (options[groupBy] ?? undefined) === category)

/**
 * 把某列滚到底（派发触底哨兵的 `isIntersecting`）
 * @description 与用户滚动**同一条路径**：`nue-infinite-scroll` 自己的 `disabled` 守卫决定是否发
 *              `load-more` ⇒ 「到底后零请求」才是真实结论（不是靠手工 emit 绕过守卫）。
 */
export const scrollToBottom = async (wrapper: VueWrapper, category: string): Promise<void> => {
    await settle()
    const node = columnNode(wrapper, category)
    const trigger = node.element.querySelector('.nue-infinite-scroll__trigger-bar')
    if (!trigger) {
        throw new MissingImplementationError(
            `[缺实现] 「${category}」列内没有触底哨兵（.nue-infinite-scroll__trigger-bar）`
        )
    }
    const fired = triggerIntersection(trigger)
    if (fired === 0) {
        throw new MissingImplementationError(
            `[缺实现] 「${category}」列的触底哨兵未注册 IntersectionObserver（列内分页未接线）`
        )
    }
    await settle()
}

/** 反复触底直到该列条数不再增长（或达上限） */
export const scrollUntilStable = async (
    wrapper: VueWrapper,
    category: string,
    maxRounds = 8
): Promise<string[]> => {
    let previous = -1
    for (let round = 0; round < maxRounds; round += 1) {
        const ids = taskIdsIn(columnNode(wrapper, category))
        if (ids.length === previous) return ids
        previous = ids.length
        await scrollToBottom(wrapper, category)
    }
    return taskIdsIn(columnNode(wrapper, category))
}

/**
 * 拖拽：卡片 `dragstart` → 列根 `drop`（两条 handler 都挂在列组件根元素上，事件冒泡到它）
 * @description 只走产品既有 DOM 事件链（`use-kanban-dragger`），不直接调内部函数 ⇒
 *              实现改动（如改用 pointer 事件）会被本用例暴露，而不是被绕过。
 *              （`T620`：先 `settle`，因为列内数据是异步加载的）
 */
export const dragTaskTo = async (
    wrapper: VueWrapper,
    taskId: string,
    category: string
): Promise<void> => {
    await settle()
    const card = cardNode(wrapper, taskId)
    const column = columnNode(wrapper, category)
    await card.trigger('dragstart')
    await column.trigger('drop')
    await settle()
}

// --- AC1a（已作废）：分组切换控件 ---

/**
 * 分段两段文案
 * @description 唯一仍在用的消费者 = `clickSegment` 的键类型（`t608-ac1a` 内部自带副本，
 *              该组已整组作废、`describe.skip` 不执行）
 */
export const GROUP_BY_LABELS = { state: '按状态', priority: '按优先级' } as const

/**
 * 切换分组（`T612` 接缝）
 * @description 控件搬入菜单后，看板侧用例的等价动作 = 改**注入的那一份 ref**（菜单与看板同源）。
 */
export const clickSegment = async (
    wrapper: VueWrapper,
    groupBy: keyof typeof GROUP_BY_LABELS
): Promise<void> => {
    await settle()
    const injected = groupByRefs.get(wrapper)
    if (injected) injected.value = groupBy
    await settle()
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