// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, nextTick, provide, ref } from 'vue'
import {
    NueButton,
    NueButtonGroup,
    NueContainer,
    NueContent,
    NueDialog,
    NueDiv,
    NueDivider,
    NueDropdown,
    NueDropdownItem,
    NueEmpty,
    NueFooter,
    NueHeader,
    NueIcon,
    NueMain,
    NueProgress,
    NueSelect,
    NueSelectOption,
    NueText,
    NueTextarea
} from 'nue-ui'
import { messages, t } from '@nao-todo/shared/locales'
import {
    TASK_DETAILS_CONTEXT_KEY,
    TASK_DETAILS_PRE_CONTEXT_KEY,
    TASK_HISTORY_CONTEXT_KEY,
    type TaskHistoryPage
} from '../context'
import type { TaskDetailsViewObject } from '../types'
import DetailsMain from '../main/index.vue'
import DetailsFooter from '../footer/index.vue'

/**
 * `T713` · 独立复核 `T712`（⛔ **不复用 `t712-*` 夹具**、不把它当证据）
 *
 * 载体：用户 2026-11-11 决定（PRD `R-10` / `AC12` / `D8`）—— 变更记录从**正文内联**改为
 * Footer「更多」菜单项「变更历史」→ **对话框**。本文件按 PM 的复核清单自建夹具：
 *
 * ① 正文无区块且**不取数**（取数调用数 = 0，不是「不报错」这类行为等价）
 * ② 入口在「更多」菜单内，与「导出 / 复制任务」**同组**
 * ③ 三路关闭（底部按钮 / × / Esc）各关一次，焦点回到「更多」按钮
 * ④ 打开期间详情自动刷新（`vo` 换新对象）⇒ 不重挂、不清空、`load` 只 1 次
 * ⑤ 无 provider ⇒ 不出死入口（`v-if` 守卫口径）
 * ⑥ i18n 仍 **恰 13 键**（无第 14 个；中英键集一致）
 *
 * 纪律：真挂载生产组件（main / footer / 对话框 / `NueDialog`）；只 stub 与变更历史无关的兄弟板块。
 */

const NUE = {
    'nue-button': NueButton,
    'nue-button-group': NueButtonGroup,
    'nue-container': NueContainer,
    'nue-content': NueContent,
    'nue-dialog': NueDialog,
    'nue-div': NueDiv,
    'nue-divider': NueDivider,
    'nue-dropdown': NueDropdown,
    'nue-dropdown-item': NueDropdownItem,
    'nue-empty': NueEmpty,
    'nue-footer': NueFooter,
    'nue-header': NueHeader,
    'nue-icon': NueIcon,
    'nue-main': NueMain,
    'nue-progress': NueProgress,
    'nue-select': NueSelect,
    'nue-select-option': NueSelectOption,
    'nue-text': NueText,
    'nue-textarea': NueTextarea
}

const UNRELATED_STUBS = {
    'details-main-comments': true,
    'details-main-events': true,
    'details-main-pomodoro-info': true,
    'details-main-sub-tasks': true,
    'task-tag-bar': true
}

const settle = async (): Promise<void> => {
    for (let index = 0; index < 8; index += 1) {
        await nextTick()
        await Promise.resolve()
    }
    await flushPromises()
}

const PAGE: TaskHistoryPage = {
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

const makeTask = (overrides: Record<string, unknown> = {}): TaskDetailsViewObject =>
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
        tagList: [],
        isDone: false,
        ...overrides
    }) as TaskDetailsViewObject

const makeLoad = (page: TaskHistoryPage = PAGE) =>
    vi.fn(async (_taskId: string, _beforeSeq?: number): Promise<TaskHistoryPage> => page)

const makeDetailsContext = (vo: ReturnType<typeof ref<TaskDetailsViewObject | null>>) =>
    ({
        vo,
        projects: ref([]),
        checkItems: computed(() => []),
        subTasks: computed(() => []),
        tags: ref([]),
        isCommenting: ref(false),
        taskHandler: { update: vi.fn(), copyTask: vi.fn(), unarchiveTask: vi.fn() },
        commentHandler: { create: vi.fn(async () => null) },
        switchTaskDetails: vi.fn(),
        dialogManager: { open: vi.fn() },
        beginEdit: vi.fn(),
        updateTaskDetails: vi.fn(),
        deleteTask: vi.fn(),
        restoreTask: vi.fn(),
        giveUpTask: vi.fn(),
        ungiveUpTask: vi.fn(),
        checkItemProgress: computed(() => ({ percentage: 0, text: '0/0' })),
        subTaskProgress: computed(() => ({ percentage: 0, text: '0/0' }))
    }) as never

const PRE_CONTEXT = {
    subTaskUseCase: { list: vi.fn(async () => [{ taskIds: [] }, null]) },
    taskCheckItemUseCase: { listByTask: vi.fn(async () => [[], null]) },
    getTag: () => undefined,
    getProjectName: () => ''
} as never

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

/** ① 只挂生产详情正文（footer 不挂）⇒ 正文无区块 + 未取数 */
const mountMainOnly = (load: ReturnType<typeof makeLoad>): VueWrapper => {
    const Host = defineComponent({
        components: { DetailsMain },
        setup() {
            provide(TASK_DETAILS_CONTEXT_KEY, makeDetailsContext(ref(makeTask())))
            provide(TASK_HISTORY_CONTEXT_KEY, { load } as never)
            return {}
        },
        template: '<details-main />'
    })
    wrapper = mount(Host, {
        attachTo: document.body,
        global: { components: NUE, stubs: UNRELATED_STUBS }
    })
    return wrapper
}

/** ②③④⑤ 真挂载生产 footer（真实 `NueDropdown` / `NueDialog` / 对话框） */
const mountFooter = (
    load: ReturnType<typeof makeLoad>,
    withHistory = true
): {
    vo: ReturnType<typeof ref<TaskDetailsViewObject | null>>
    load: ReturnType<typeof makeLoad>
} => {
    const vo = ref<TaskDetailsViewObject | null>(makeTask())
    const provideMap: Record<symbol, unknown> = {
        [TASK_DETAILS_CONTEXT_KEY as symbol]: makeDetailsContext(vo),
        [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: PRE_CONTEXT
    }
    if (withHistory) provideMap[TASK_HISTORY_CONTEXT_KEY as symbol] = { load }
    wrapper = mount(DetailsFooter, {
        attachTo: document.body,
        global: { components: NUE, provide: provideMap }
    })
    return { vo, load }
}

const historyOption = (): HTMLElement | null =>
    document.body.querySelector<HTMLElement>('[data-executeid="history"]')

const moreTrigger = (): HTMLButtonElement | null =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
        (button.textContent ?? '').includes(t('common.more'))
    ) ?? null

const dialogEl = (): HTMLElement | null =>
    document.body.querySelector<HTMLElement>('.nue-dialog--task-history')

const openDialog = async (): Promise<HTMLElement> => {
    const option = historyOption()
    expect(option, '「更多」菜单必须有「变更历史」入口').toBeTruthy()
    option!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
    const dialog = dialogEl()
    expect(dialog, '点入口 ⇒ 对话框必须打开').toBeTruthy()
    return dialog!
}

/** jsdom 无动画 ⇒ 库在动画结束后才 emit；`×` / Esc 关闭需补发 `animationend` */
const finishCloseAnimation = async (): Promise<void> => {
    dialogEl()?.dispatchEvent(new Event('animationend', { bubbles: true }))
    await settle()
}

describe('T713 / 独立复核：变更历史入口（「更多」→ 对话框）', () => {
    it('① 正文不再内联变更区块，且未打开对话框前不取数（调用数 = 0）', async () => {
        const load = makeLoad()
        const mounted = mountMainOnly(load)
        await settle()

        expect(mounted.find('.task-history').exists(), '正文 ⛔ 不得出现变更历史区块').toBe(false)
        expect(mounted.text()).not.toContain(t('history.title'))
        expect(load, '未打开对话框 ⇒ 取数调用数必须为 0').toHaveBeenCalledTimes(0)
    })

    it('②「变更历史」在「更多」菜单内，与「导出 / 复制任务」同组', async () => {
        mountFooter(makeLoad())
        await settle()

        const option = historyOption()
        expect(option, '菜单项缺失').toBeTruthy()
        expect(option!.textContent).toContain(t('history.title'))

        const exportOption = document.body.querySelector('[data-executeid="export-task"]')
        const copyOption = document.body.querySelector('[data-executeid="copy-todo"]')
        expect(exportOption, '「导出」项缺失（同级基准）').toBeTruthy()
        expect(copyOption, '「复制任务」项缺失（同级基准）').toBeTruthy()
        expect(option!.parentElement, '必须与「导出」同组').toBe(exportOption!.parentElement)
        expect(option!.parentElement, '必须与「复制任务」同组').toBe(copyOption!.parentElement)
    })

    it('③a 底部按钮关闭 ⇒ 无残留，焦点回到「更多」按钮', async () => {
        mountFooter(makeLoad())
        await settle()
        const dialog = await openDialog()

        const closeButton = Array.from(
            dialog.querySelectorAll<HTMLButtonElement>('.nue-dialog__footer button')
        ).find((button) => (button.textContent ?? '').includes(t('common.close')))
        expect(closeButton, '底部必须有「关闭」按钮').toBeTruthy()
        closeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()

        expect(dialogEl(), '关闭后对话框无残留').toBe(null)
        expect(document.activeElement, '焦点必须回到「更多」触发按钮').toBe(moreTrigger())
    })

    it('③b × 关闭 ⇒ 无残留，焦点回到「更多」按钮', async () => {
        mountFooter(makeLoad())
        await settle()
        await openDialog()

        const closeX = document.body.querySelector<HTMLElement>('.nue-dialog__header__closebtn')
        expect(closeX, '右上角必须有 × 关闭').toBeTruthy()
        closeX!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        await finishCloseAnimation()

        expect(dialogEl(), '× 关闭后无残留').toBe(null)
        expect(document.activeElement).toBe(moreTrigger())
    })

    it('③c Esc 关闭 ⇒ 无残留，焦点回到「更多」按钮', async () => {
        mountFooter(makeLoad())
        await settle()
        await openDialog()

        document.body
            .querySelector<HTMLElement>('.nue-dialog-overlay')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await nextTick()
        await finishCloseAnimation()

        expect(dialogEl(), 'Esc 关闭后无残留').toBe(null)
        expect(document.activeElement).toBe(moreTrigger())
    })

    it('④ 打开期间详情自动刷新（vo 换新对象）⇒ 不重挂、不清空、load 仍 1 次', async () => {
        const { vo, load } = mountFooter(makeLoad())
        await settle()
        const before = await openDialog()
        expect(load).toHaveBeenCalledTimes(1)

        const entriesBefore = before.querySelectorAll('.task-history__entry').length
        expect(entriesBefore, '夹具自检：两页条目应在').toBe(2)

        vo.value = makeTask({ name: '刷新后的名字' })
        await settle()

        const after = dialogEl()
        expect(after, '自动刷新不得关闭对话框').toBeTruthy()
        expect(after, '自动刷新不得重挂对话框（同一 DOM 节点）').toBe(before)
        expect(after!.querySelectorAll('.task-history__entry').length, '不得清空列表').toBe(
            entriesBefore
        )
        expect(after!.textContent).toContain('旧描述')
        expect(load, '自动刷新不得触发重新取数').toHaveBeenCalledTimes(1)
    })

    it('⑤ 无 provider（未接线端）⇒ 不出现「变更历史」入口，也不挂载对话框', async () => {
        mountFooter(makeLoad(), false)
        await settle()

        expect(historyOption(), '未接线端 ⛔ 不得出现死入口').toBe(null)
        expect(dialogEl(), '未接线端不得挂载对话框').toBe(null)
    })

    it('⑥ i18n 仍恰 13 个 history.* 键（无第 14 个，中英键集一致）', () => {
        const expected = [
            'history.title',
            'history.empty',
            'history.loadFailed',
            'history.more',
            'history.source.local',
            'history.source.pull',
            'history.source.pushMerge',
            'history.source.conflictRetry',
            'history.action.create',
            'history.action.archive',
            'history.action.unarchive',
            'history.action.delete',
            'history.action.restore'
        ].sort()
        const zh = Object.keys(messages['zh-CN'] as unknown as Record<string, string>)
            .filter((key) => key.startsWith('history.'))
            .sort()
        const en = Object.keys(messages['en-US'] as unknown as Record<string, string>)
            .filter((key) => key.startsWith('history.'))
            .sort()

        expect(zh, 'history.* 键集必须恰为既有 13 键（新增第 14 个 ⇒ 红）').toEqual(expected)
        expect(en, 'en-US 键集必须与 zh-CN 一致').toEqual(expected)
    })
})