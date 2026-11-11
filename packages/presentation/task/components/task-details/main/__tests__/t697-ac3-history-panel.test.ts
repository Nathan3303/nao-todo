// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, nextTick, provide, ref, type InjectionKey } from 'vue'
import {
    NueButton,
    NueCollapse,
    NueCollapseItem,
    NueContainer,
    NueContent,
    NueDiv,
    NueDivider,
    NueEmpty,
    NueFooter,
    NueHeader,
    NueIcon,
    NueInput,
    NueMain,
    NueProgress,
    NueText,
    NueTextarea
} from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../../stores'
import useTaskViewObject from '../../use-task-view-object'
import * as detailsContext from '../../context'
import DetailsMain from '../index.vue'

/**
 * T697 / A 档 M0 —— **AC3 界面真挂载**（⛔ stub 不算证据）+ AC10 部分（非表格式 / 无内部词）
 *
 * 纪律（AGENTS.md 前端验证纪律②）：真实挂载生产详情主面板 `task-details/main/index.vue`，
 * 只 stub 与「变更历史」无关的兄弟板块（评论 / 事件 / 番茄 / 子任务 / 标签栏）。
 *
 * provider 契约（PM T697 Q2 批准的最小形状，M5 按此实现）：
 * ```
 * provide(TASK_HISTORY_CONTEXT_KEY, {
 *   load(taskId, beforeSeq?) => Promise<{ items, hasMore, unavailable }>
 * })
 * item = { seq?, at, source, action, fields: [{ field, from, to }] }
 * ```
 * - ⚠️ `unavailable` 专门表示「老数据无历史 / 表不可用」，⛔ 不得用空数组冒充（UI 要能区分
 *   「没有历史」与「还没加载」）—— 对应本文件「老库 ⇒ 暂无记录，不报错」用例。
 * - 字段中文标签复用既有字段标签表（PM Q2 裁定：`field-label` 下沉 `packages/shared`，本档只报不选）。
 *
 * 不强断言（jsdom 无法量取，交用户视觉走查）：条目点击区 ≥40px 的实际高度、日期分组观感、
 * 三态颜色对比度 —— 报告「覆盖清单」已列为用户验收项。
 * @see docs/prds/2026-11-10-audit-log.md（AC3 / AC10 / R-7 / 指标 2）
 * @see docs/reports/T696-audit-log-arch-review.md（§9 界面 / §10.1 AC3·AC10）
 */

interface HistoryItem {
    seq?: number
    at: string
    source: 'local-edit' | 'pull' | 'push-merge' | 'conflict-retry'
    action: 'create' | 'update' | 'archive' | 'unarchive' | 'delete' | 'restore'
    fields: Array<{ field: string; from: unknown; to: unknown }>
}

interface HistoryPage {
    items: HistoryItem[]
    hasMore: boolean
    unavailable?: boolean
}

interface TaskHistoryProvider {
    load: (taskId: string, beforeSeq?: number) => Promise<HistoryPage>
}

/**
 * M5 才导出的注入键：本档用**命名空间取值**（缺失 ⇒ `undefined`）
 * @description 直接 `import { TASK_HISTORY_CONTEXT_KEY }` 会在 M0 变成「导出不存在」的**收集失败**，
 *              PM 明令禁止；命名空间取值缺失时 `provide` 一个无效键 ⇒ 面板不渲染 ⇒
 *              用例以「标题缺失」的 AC 级断言失败（强红因），M5 落地后自动转绿。
 */
const HISTORY_CONTEXT_KEY = (detailsContext as unknown as Record<string, unknown>)[
    'TASK_HISTORY_CONTEXT_KEY'
] as InjectionKey<TaskHistoryProvider> | undefined

/**
 * 取「变更历史」文案
 * @description M0 时这些键尚未声明进 `LocaleMessages` ⇒ 用参数放宽类型（键的**齐备性**由
 *              `packages/shared/locales/__tests__/t697-audit-history-locale-keys.test.ts` 守护）；
 *              M5 补键后本函数仍返回同一文案，无需改用例。
 */
const historyText = (key: string): string => t(key as never)

const NUE = {
    'nue-button': NueButton,
    'nue-collapse': NueCollapse,
    'nue-collapse-item': NueCollapseItem,
    'nue-container': NueContainer,
    'nue-content': NueContent,
    'nue-div': NueDiv,
    'nue-divider': NueDivider,
    'nue-empty': NueEmpty,
    'nue-footer': NueFooter,
    'nue-header': NueHeader,
    'nue-icon': NueIcon,
    'nue-input': NueInput,
    'nue-main': NueMain,
    'nue-progress': NueProgress,
    'nue-text': NueText,
    'nue-textarea': NueTextarea
}

/** 与「变更历史」无关、依赖评论/检查事项/番茄接线的板块 ⇒ stub */
const UNRELATED_STUBS = {
    'details-main-comments': true,
    'details-main-events': true,
    'details-main-pomodoro-info': true,
    'details-main-sub-tasks': true,
    'task-tag-bar': true
}

const flush = async (): Promise<void> => {
    for (let index = 0; index < 8; index += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 'task-1',
        userId: 'u1',
        parentTaskId: '',
        name: '买菜',
        description: '带购物袋',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt: null,
        projectId: null,
        tags: [],
        createdAt: '2026-11-05T00:00:00.000Z',
        updatedAt: '2026-11-05T00:00:00.000Z',
        deletedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        archivedAt: null,
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
    }) as TaskViewObject

const makeDetailsContext = (
    vo: ReturnType<typeof useTaskViewObject>['task'],
    api: ReturnType<typeof useTaskViewObject>
) => ({
    dialogManager: { open: vi.fn(), close: vi.fn() },
    vo,
    refreshKey: ref(1),
    projects: ref([]),
    tags: ref([]),
    checkItems: ref([]),
    comments: ref([]),
    subTasks: ref([]),
    taskHandler: { updateTaskState: vi.fn(async () => null) },
    subTaskHandler: { updateTaskState: vi.fn(async () => null) },
    checkItemHandler: { create: vi.fn(async () => null), update: vi.fn(async () => null) },
    commentHandler: { create: vi.fn(async () => null) },
    checkItemProgress: computed(() => ({ percentage: 0, text: '0/0' })),
    subTaskProgress: computed(() => ({ percentage: 0, text: '暂无子任务' })),
    isCommenting: ref(false),
    pomodoroCurrentTaskId: ref(null),
    pomodoroTimerStatus: ref(''),
    pomodoroFocusStatus: ref(''),
    checkItemsLoading: ref(false),
    checkItemsError: ref(''),
    commentsLoading: ref(false),
    commentsError: ref(''),
    subTasksLoading: ref(false),
    subTasksError: ref(''),
    subTasksRefreshError: computed(() => null),
    beginEdit: vi.fn(),
    updateTaskDetails: api.updateTaskDetails,
    deleteTask: api.deleteTask,
    restoreTask: api.restoreTask,
    giveUpTask: api.giveUpTask,
    ungiveUpTask: api.ungiveUpTask,
    switchTaskDetails: vi.fn(),
    closeDetails: vi.fn(),
    retryCheckItems: vi.fn(),
    retryComments: vi.fn(),
    retrySubTasks: vi.fn(),
    createSubTask: vi.fn(async () => null),
    detachSubTask: vi.fn(async () => null),
    resortSubTasks: vi.fn(async () => null),
    resortCheckItems: vi.fn(),
    makeCheckItemToTask: vi.fn(),
    selectTaskAndStartTimer: vi.fn(),
    selectTaskAndStartFocus: vi.fn(),
    resetTimer: vi.fn(),
    resetFocus: vi.fn()
})

let wrapper: VueWrapper | null = null

beforeEach(() => {
    setActivePinia(createPinia())
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountDetails = async (
    page: HistoryPage,
    load = vi.fn(async (_taskId: string, _beforeSeq?: number) => page)
) => {
    const seed = makeTask()
    const store = useTasksStore()
    store.addTask({ ...seed })
    const taskUseCase = {
        get: vi.fn(async () => [{ ...seed }, null]),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
        restore: vi.fn(async () => null)
    } as unknown as TaskUseCase

    const Host = defineComponent({
        components: { DetailsMain },
        setup() {
            const api = useTaskViewObject(
                taskUseCase,
                () => undefined,
                () => ''
            )
            void api.getTaskDetails(seed.id)
            provide(
                detailsContext.TASK_DETAILS_CONTEXT_KEY,
                makeDetailsContext(api.task, api) as never
            )
            // 缺失键时 provide 一个无效键 ⇒ 面板不渲染（M5 后自动生效）
            provide((HISTORY_CONTEXT_KEY ?? '') as never, { load } as never)
            return {}
        },
        template: `<details-main />`
    })

    wrapper = mount(Host, {
        attachTo: document.body,
        global: { components: NUE, stubs: UNRELATED_STUBS }
    })
    await flush()
    return { wrapper, load }
}

/** 展开折叠面板（默认折叠，arch §9）：优先驱动 `NueCollapse`，其次点标题 */
const expandHistory = async (target: VueWrapper): Promise<void> => {
    const collapse = target.findComponent(NueCollapse)
    if (collapse.exists()) {
        collapse.vm.$emit('update:modelValue', ['history'])
        await flush()
        return
    }
    const header = target
        .findAll('*')
        .find((node) => node.text().includes(historyText('history.title')))
    if (header) {
        await header.trigger('click')
        await flush()
    }
}

/**
 * 前置：面板必须真的挂载（否则「不含内部词 / 非表格式」这类否定断言会在空壳上假绿）
 * @description 与 `0 条审计` 同型的陷阱：否定式断言必须配一个肯定式存在断言。
 */
const expectPanelMounted = (target: VueWrapper): void => {
    expect(target.text(), '详情面板必须出现「变更历史」区块（AC3）').toContain(
        historyText('history.title')
    )
}

const TASK_ID = 'task-1'
const SAMPLE_PAGE: HistoryPage = {
    items: [
        {
            seq: 2,
            at: new Date().toISOString(),
            source: 'local-edit',
            action: 'update',
            fields: [{ field: 'description', from: '旧描述', to: '新描述' }]
        },
        {
            seq: 1,
            at: new Date(Date.now() - 60_000).toISOString(),
            source: 'pull',
            action: 'update',
            fields: [{ field: 'priority', from: 'medium', to: 'high' }]
        }
    ],
    hasMore: false,
    unavailable: false
}

describe('T697 / AC3 变更历史面板（真实挂载生产详情面板）', () => {
    it('面板挂载 ⇒ 出现「变更历史」标题，并按 taskId 调 load', async () => {
        const { wrapper: mounted, load } = await mountDetails(SAMPLE_PAGE)

        expectPanelMounted(mounted)
        expect(load).toHaveBeenCalled()
        expect(load.mock.calls[0]?.[0]).toBe(TASK_ID)
    })

    it('展开后时间线可读：字段用中文标签、旧值→新值可见、来源用中文（⛔ 裸露 source 值）', async () => {
        const { wrapper: mounted } = await mountDetails(SAMPLE_PAGE)
        expectPanelMounted(mounted)
        await expandHistory(mounted)

        const text = mounted.text()
        // 字段中文标签（复用既有字段标签表 ⇒ 与冲突面板同一份文案）
        expect(text).toContain(t('sync.conflict.field.description'))
        expect(text).toContain(t('sync.conflict.field.priority'))
        // 值可见（旧值 → 新值）
        expect(text).toContain('旧描述')
        expect(text).toContain('新描述')
        // 来源标记说人话（本机修改 / 同步自云端），⛔ 裸 source 值
        expect(text).toContain(historyText('history.source.local'))
        expect(text).toContain(historyText('history.source.pull'))
    })

    it('不出现内部词与技术键名（C 端红线 / R-7 / AC3）', async () => {
        const { wrapper: mounted } = await mountDetails(SAMPLE_PAGE)
        expectPanelMounted(mounted)
        await expandHistory(mounted)

        const html = mounted.html()
        for (const term of [
            'fieldBase',
            'revision',
            'plain:',
            'local-edit',
            'push-merge',
            'conflict-retry',
            'syncedServerUpdatedAt'
        ]) {
            expect(html, `界面不得裸露内部词 ${term}`).not.toContain(term)
        }
        // 字段键名不得裸露（description / priority 作为技术键名的情况）
        expect(html).not.toContain('>description<')
        expect(html).not.toContain('>priority<')
    })

    it('非表格式排版（AC10）：面板内无 nue-table / <table> / grid 类名', async () => {
        const { wrapper: mounted } = await mountDetails(SAMPLE_PAGE)
        expectPanelMounted(mounted)
        await expandHistory(mounted)

        const html = mounted.html()
        expect(html).not.toContain('nue-table')
        expect(html).not.toContain('<table')
        expect(html).not.toMatch(/class="[^"]*\bgrid\b[^"]*"/)
    })

    it('老数据 / 表不可用（unavailable）⇒ 显示「暂无变更记录」，不报错、不显示错误态', async () => {
        const { wrapper: mounted } = await mountDetails({
            items: [],
            hasMore: false,
            unavailable: true
        })
        expectPanelMounted(mounted)
        await expandHistory(mounted)

        const text = mounted.text()
        expect(text, '老数据无历史 ⇒ 必须显示「暂无变更记录」空态').toContain(
            historyText('history.empty')
        )
        expect(text, '老数据无历史 ⇒ ⛔ 不得显示「加载失败」').not.toContain(
            historyText('history.loadFailed')
        )
    })

    it('空历史（可用但 0 条）⇒ 同样显示「暂无变更记录」', async () => {
        const { wrapper: mounted } = await mountDetails({
            items: [],
            hasMore: false,
            unavailable: false
        })
        expectPanelMounted(mounted)
        await expandHistory(mounted)

        expect(mounted.text(), '0 条历史 ⇒ 必须显示「暂无变更记录」空态').toContain(
            historyText('history.empty')
        )
    })

    it('有更多 ⇒ 显示「更早」入口（分页不丢入口）', async () => {
        const { wrapper: mounted } = await mountDetails({ ...SAMPLE_PAGE, hasMore: true })
        expectPanelMounted(mounted)
        await expandHistory(mounted)

        expect(mounted.text(), 'hasMore ⇒ 必须给出「更早」分页入口').toContain(
            historyText('history.more')
        )
    })
})