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
import { t } from '@nao-todo/shared/locales'
import {
    TASK_DETAILS_CONTEXT_KEY,
    TASK_DETAILS_PRE_CONTEXT_KEY,
    TASK_HISTORY_CONTEXT_KEY,
    type TaskHistoryItem,
    type TaskHistoryPage
} from '../context'
import type { TaskDetailsViewObject } from '../types'
import DetailsMain from '../main/index.vue'
import TaskDetailsFooter from '../footer/index.vue'

/**
 * `T712` / `R-10` / `AC12` —— 变更历史：正文内联 → Footer「更多」菜单 + 对话框
 *
 * 纪律（AGENTS.md 前端验证纪律②）：**真实挂载生产组件**（main / footer / 对话框 / NueDialog），
 * ⛔ 不 stub 被测面；只 stub 与变更历史无关的兄弟板块。
 *
 * 覆盖（PM T712 验证清单）：
 * ① 正文不出现变更区块，且未打开对话框时**不取数**
 * ②「更多」菜单含「变更历史」项（与导出 / 复制同级，文案复用 `history.title`）
 * ③ 对话框出现；Esc / × / 底部按钮**三路关闭**都生效
 * ④ 关闭后 `activeElement` 回到「更多」触发按钮
 * ⑤ 打开期间一次数据刷新（`vo` 换新对象）⇒ 列表不被清空、不重新取数
 *
 * 说明：jsdom 无 CSS 动画 ⇒ `NueDialog` 的 `×` / Esc 关闭需补发 `animationend`
 * （库在动画结束后才 emit `update:modelValue`；既有 `conflict-ux` 用例同法）。
 * @see docs/prds/2026-11-10-audit-log.md（R-10 / AC12）
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

/** 与变更历史无关的兄弟板块（依赖评论 / 检查事项 / 番茄 / 子任务接线） */
const UNRELATED_STUBS = {
    'details-main-comments': true,
    'details-main-events': true,
    'details-main-pomodoro-info': true,
    'details-main-sub-tasks': true,
    'task-tag-bar': true
}

const historyText = (key: 'history.title' | 'history.empty' | 'history.more' | 'common.close') =>
    t(key)

const settle = async (): Promise<void> => {
    for (let index = 0; index < 8; index += 1) {
        await nextTick()
        await Promise.resolve()
    }
    await flushPromises()
}

const SAMPLE_PAGE: TaskHistoryPage = {
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

const makeLoad = (page: TaskHistoryPage = SAMPLE_PAGE) =>
    vi.fn(async (_taskId: string, _beforeSeq?: number): Promise<TaskHistoryPage> => page)

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

/** ① 真挂载生产详情主面板：正文不得再有变更区块，且在对话框打开前不取数 */
const mountDetailsMain = (load: ReturnType<typeof makeLoad>) => {
    const Host = defineComponent({
        components: { DetailsMain },
        setup() {
            provide(TASK_DETAILS_CONTEXT_KEY, {
                vo: ref(makeTask()),
                checkItems: computed(() => []),
                subTasks: computed(() => []),
                tags: ref([]),
                isCommenting: ref(false),
                commentHandler: { create: vi.fn(async () => null) },
                dialogManager: { open: vi.fn() },
                switchTaskDetails: vi.fn(),
                beginEdit: vi.fn(),
                updateTaskDetails: vi.fn(),
                checkItemProgress: computed(() => ({ percentage: 0, text: '0/0' })),
                subTaskProgress: computed(() => ({ percentage: 0, text: '0/0' }))
            } as never)
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

/** ②③④⑤ 真挂载生产 footer（真实 NueDropdown / NueDialog / 对话框） */
const mountFooter = (load: ReturnType<typeof makeLoad>) => {
    const vo = ref<TaskDetailsViewObject | null>(makeTask())

    wrapper = mount(TaskDetailsFooter, {
        attachTo: document.body,
        global: {
            components: NUE,
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
                    subTaskUseCase: { list: vi.fn(async () => [{ taskIds: [] }, null]) },
                    taskCheckItemUseCase: { listByTask: vi.fn(async () => [[], null]) },
                    getTag: () => undefined,
                    getProjectName: () => ''
                },
                [TASK_HISTORY_CONTEXT_KEY as symbol]: { load }
            } as never
        }
    })
    return { wrapper, vo, load }
}

const historyOption = (): HTMLElement | null =>
    document.body.querySelector<HTMLElement>('[data-executeid="history"]')

/** 「更多」触发按钮：按文案识别（项目选择器内部也有一层 `.nue-dropdown-wrapper`） */
const moreTrigger = (): HTMLButtonElement | null =>
    Array.from(
        document.body.querySelectorAll<HTMLButtonElement>('.nue-dropdown-wrapper button')
    ).find((button) => button.textContent?.includes(t('common.more'))) ?? null

const dialogEl = (): HTMLElement | null =>
    document.body.querySelector<HTMLElement>('.nue-dialog--task-history')

const openDialog = async (): Promise<void> => {
    const option = historyOption()
    expect(option, '「更多」菜单必须有「变更历史」项').toBeTruthy()
    option!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
    expect(dialogEl(), '点菜单项 ⇒ 对话框必须打开').toBeTruthy()
}

/** jsdom 无动画 ⇒ 关闭动画结束后库才 emit `update:modelValue`，测试补发 animationend */
const closeByDialogAnimation = async (): Promise<void> => {
    document
        .querySelector<HTMLElement>('.nue-dialog--task-history')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }))
    await settle()
}

describe('T712 / AC12 变更历史：Footer「更多」+ 对话框', () => {
    it('① 详情正文不再内联变更区块，且未打开对话框前不取数', async () => {
        const load = makeLoad()
        const mounted = mountDetailsMain(load)
        await settle()

        expect(mounted.find('.task-history').exists(), '正文 ⛔ 不得内联变更区块').toBe(false)
        expect(mounted.text()).not.toContain(historyText('history.title'))
        expect(load, '内联块已移除 ⇒ 打开对话框前不应取数').not.toHaveBeenCalled()
    })

    it('②「更多」菜单含「变更历史」项（复用 history.title，与导出/复制同级）', async () => {
        mountFooter(makeLoad())
        await settle()

        const option = historyOption()
        expect(option, '菜单项缺失').toBeTruthy()
        expect(option!.textContent).toContain(historyText('history.title'))
        // 同级：与「导出」「复制任务」在同一个「更多操作」分组内
        const exportOption = document.body.querySelector('[data-executeid="export-task"]')
        const copyOption = document.body.querySelector('[data-executeid="copy-todo"]')
        expect(option!.parentElement).toBe(exportOption?.parentElement)
        expect(option!.parentElement).toBe(copyOption?.parentElement)
    })

    it('③+④ 打开 ⇒ 时间线可读；底部「关闭」⇒ 对话框消失、焦点归还触发按钮', async () => {
        const { load } = mountFooter(makeLoad())
        await settle()
        await openDialog()

        // 按 entityId 加载（打开才取第一页）
        expect(load).toHaveBeenCalledTimes(1)
        expect(load.mock.calls[0]?.[0]).toBe('task-1')

        const dialog = dialogEl()!
        const text = dialog.textContent ?? ''
        // 内容类断言与内联版一致：中文标签 + 旧值→新值 + 来源中文
        expect(text).toContain(t('sync.conflict.field.description'))
        expect(text).toContain(t('sync.conflict.field.priority'))
        expect(text).toContain('旧描述')
        expect(text).toContain('新描述')
        expect(text).toContain(t('history.source.local'))
        expect(text).toContain(t('history.source.pull'))
        // 非表格式 + 无内部词
        expect(dialog.innerHTML).not.toContain('<table')
        expect(dialog.innerHTML).not.toContain('nue-table')
        for (const term of [
            'local-edit',
            'push-merge',
            'conflict-retry',
            'fieldBase',
            'revision'
        ]) {
            expect(text, `不得裸露内部词 ${term}`).not.toContain(term)
        }

        // 底部「关闭」
        const closeButton = Array.from(
            dialog.querySelectorAll<HTMLButtonElement>('.nue-dialog__footer button')
        ).find((button) => button.textContent?.includes(historyText('common.close')))
        expect(closeButton, '底部必须有「关闭」按钮').toBeTruthy()
        closeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()

        expect(dialogEl(), '关闭后无残留').toBe(null)
        expect(document.activeElement, '焦点必须归还「更多」触发按钮').toBe(moreTrigger())
    })

    it('③+④ × 关闭 ⇒ 对话框消失、焦点归还触发按钮', async () => {
        mountFooter(makeLoad())
        await settle()
        await openDialog()

        document
            .querySelector<HTMLElement>('.nue-dialog__header__closebtn')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        await closeByDialogAnimation()

        expect(dialogEl(), '× 后无残留').toBe(null)
        expect(document.activeElement).toBe(moreTrigger())
    })

    it('③+④ Esc 关闭 ⇒ 对话框消失、焦点归还触发按钮', async () => {
        mountFooter(makeLoad())
        await settle()
        await openDialog()

        document
            .querySelector<HTMLElement>('.nue-dialog-overlay')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await nextTick()
        await closeByDialogAnimation()

        expect(dialogEl(), 'Esc 后无残留').toBe(null)
        expect(document.activeElement).toBe(moreTrigger())
    })

    it('⑤ 打开期间详情刷新（vo 换新对象）⇒ 列表不被清空、不重新取数', async () => {
        const { vo, load } = mountFooter(makeLoad())
        await settle()
        await openDialog()
        expect(load).toHaveBeenCalledTimes(1)

        const entriesBefore = dialogEl()!.querySelectorAll('.task-history__entry').length
        expect(entriesBefore).toBe(2)

        // 模拟详情页自动刷新：同一任务的视图对象整体替换
        vo.value = makeTask({ name: '刷新后的名字' })
        await settle()

        const dialog = dialogEl()
        expect(dialog, '刷新不得关闭对话框（R-10 硬要求③）').toBeTruthy()
        expect(
            dialog!.querySelectorAll('.task-history__entry').length,
            '刷新不得清空/重挂列表'
        ).toBe(entriesBefore)
        expect(dialog!.textContent).toContain('旧描述')
        expect(load, '刷新不得触发重新取数').toHaveBeenCalledTimes(1)
    })

    it('分页：「更早」按最旧一条的 seq 续页（移动后行为保持）', async () => {
        const page: TaskHistoryPage = { ...SAMPLE_PAGE, hasMore: true }
        const load = vi.fn(async (_taskId: string, beforeSeq?: number) =>
            beforeSeq === undefined
                ? page
                : ({
                      items: [
                          {
                              seq: 0,
                              at: new Date(Date.now() - 120_000).toISOString(),
                              source: 'push-merge' as TaskHistoryItem['source'],
                              action: 'update',
                              fields: [{ field: 'name', from: '旧名', to: '新名' }]
                          }
                      ],
                      hasMore: false
                  } as TaskHistoryPage)
        )

        mountFooter(load as ReturnType<typeof makeLoad>)
        await settle()
        await openDialog()

        const moreButton = Array.from(
            dialogEl()!.querySelectorAll<HTMLButtonElement>('button')
        ).find((button) => button.textContent?.includes(historyText('history.more')))
        expect(moreButton, 'hasMore ⇒ 必须有「更早」入口').toBeTruthy()

        moreButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()

        expect(load).toHaveBeenCalledTimes(2)
        expect(load.mock.calls[1]?.[1], '「更早」必须用 seq 游标').toBe(1)
        expect(dialogEl()!.querySelectorAll('.task-history__entry').length).toBe(3)
        expect(dialogEl()!.textContent).toContain('旧名')
    })

    it('无 provider（未接线端）⇒ 不出现「变更历史」入口（不出死入口）', async () => {
        mountFooter(makeLoad())
        await settle()
        expect(historyOption()).toBeTruthy()

        wrapper?.unmount()
        wrapper = mount(TaskDetailsFooter, {
            attachTo: document.body,
            global: {
                components: NUE,
                provide: {
                    [TASK_DETAILS_CONTEXT_KEY as symbol]: {
                        vo: ref(makeTask()),
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
                        subTaskUseCase: { list: vi.fn(async () => [{ taskIds: [] }, null]) },
                        taskCheckItemUseCase: { listByTask: vi.fn(async () => [[], null]) },
                        getTag: () => undefined,
                        getProjectName: () => ''
                    }
                } as never
            }
        })
        await settle()
        // 上一棵树已卸载；重新挂载后仍不出现入口
        expect(document.body.querySelector('[data-executeid="history"]')).toBe(null)
    })
})