// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { useTasksStore } from '@nao-todo/presentation/task'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { nueUI } from '@/nue-ui-register'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import type { PomodoroViewContext } from '@/views/index/pomodoro/context'
import FocusDependDropdown from '../focus-depend-dropdown.vue'

/**
 * DEF-131 · 番茄「专注依赖 → 任务专注」页签不得按截止时间过滤
 *
 * @description 缺陷成因（T638 端到端取证）：面板 options 曾带 `relativeDate: '-overdue'`，
 *              本地仓储 `matchRelativeDate('-overdue')` = `!dayjs(endAt).isBefore(now)` ⇒
 *              **所有 endAt 早于此刻的未完成任务被排除**（含今天 date-only：endAt = 当日 00:00）。
 *              当用户的未完成任务恰好都是逾期/今天任务时，页签恒为「暂无待办任务」。
 *              ⇒ 本用例挂载**真实下拉 + 真实 list-view-adapter + 真实 Pinia**，只把用例层换成
 *              fake 仓储（jsdom 无 IndexedDB；fake 的 `-overdue` 契约与 LocalTaskRepoImpl 一致，
 *              真实谓词由 `packages/infrastructure/.../local-task-repos.test.ts` 锁死）。
 *
 * **红基线**：把 `use-task-panel.ts` 的 options 改回带 `relativeDate: '-overdue'` ⇒
 *            fake 仓储只返回「未来 + 无截止」两条 ⇒ 逾期/今天任务断言与 `relativeDate` 缺席断言同时转红。
 */

const makeTask = (
    overrides: Partial<TaskViewObject> & { id: string; name: string }
): TaskViewObject =>
    ({
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: null,
        parentTaskId: null,
        userId: 'test-user',
        description: '',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt: null,
        projectId: 'inbox',
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
    }) as TaskViewObject

const TASKS: TaskViewObject[] = [
    makeTask({
        id: 'overdue-todo',
        name: '逾期-待办',
        state: 'todo',
        priority: 'high',
        endAt: dayjs().subtract(1, 'day').toISOString()
    }),
    makeTask({
        id: 'today-dateonly-todo',
        name: '今天-dateonly-待办',
        state: 'todo',
        priority: 'high',
        // 今天 date-only：本地仓储/浏览器会把纯日期解析为当日 00:00（早于「此刻」）
        endAt: dayjs().startOf('day').toISOString()
    }),
    makeTask({
        id: 'future-inprogress',
        name: '未来-进行中',
        state: 'in-progress',
        priority: 'medium',
        endAt: dayjs().add(1, 'day').toISOString()
    }),
    makeTask({
        id: 'no-end-todo',
        name: '无截止-待办',
        state: 'todo',
        priority: 'low'
    }),
    makeTask({
        id: 'overdue-inprogress',
        name: '逾期-进行中',
        state: 'in-progress',
        priority: 'medium',
        endAt: dayjs().subtract(1, 'day').toISOString()
    }),
    makeTask({
        id: 'done-future',
        name: '已完成-未来',
        state: 'done',
        priority: 'low',
        endAt: dayjs().add(1, 'day').toISOString()
    })
]

const EXPECTED_INCOMPLETE = [
    '逾期-待办',
    '今天-dateonly-待办',
    '未来-进行中',
    '无截止-待办',
    '逾期-进行中'
]

/**
 * fake 任务用例
 * @description 只实现 `list`；筛选契约与 LocalTaskRepoImpl 一致（state / 删除 / 归档 / 放弃 / -overdue）
 */
const createFakeTaskUseCase = (tasks: TaskViewObject[]) => {
    const list = vi.fn(async (options: Record<string, unknown>) => {
        const filtered = tasks.filter((task) => {
            if (options.isDeleted === false && task.isDeleted) return false
            if (options.isArchived === false && task.isArchived) return false
            if (options.isGivenUp === false && task.isGivenUp) return false
            const stateFilter = options.state
            if (typeof stateFilter === 'string' && stateFilter) {
                const states = stateFilter.split(',')
                if (!states.includes(task.state)) return false
            }
            // 与 task-repo-impl.matchRelativeDate('-overdue') 一致：endAt 早于此刻 ⇒ 排除；
            // 无 endAt ⇒ 保留（负向条件不误过滤）
            if (options.relativeDate === '-overdue' && task.endAt) {
                return !dayjs(task.endAt).isBefore(dayjs())
            }
            return true
        })
        return [
            {
                taskIds: filtered.map((task) => task.id),
                pagination: {
                    total: filtered.length,
                    page: 1,
                    limit: Number(options.limit) || 10,
                    maxPage: 1
                }
            },
            null
        ]
    })
    return { list } as unknown as TaskUseCase & { list: typeof list }
}

const buildContext = (taskUseCase: TaskUseCase) =>
    ({
        dialogManager: { open: vi.fn(), close: vi.fn() },
        pomodoroUseCase: { loadPomodoros: vi.fn(async () => null) },
        taskUseCase,
        subscriber: useSubscriber(),
        getProjectName: () => '',
        showTaskDetails: vi.fn(),
        isDisplayAside: ref(true),
        isUseFloatAside: ref(false),
        switchDisplayAside: vi.fn(),
        todayRecords: ref([]),
        recordLoading: ref(false),
        recordIsDone: ref(false),
        handleNextPage: vi.fn()
    }) as unknown as PomodoroViewContext

let wrapper: VueWrapper | null = null

beforeAll(() => {
    // nue-infinite-scroll 依赖 IntersectionObserver（jsdom 不提供）
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return []
            }
        }
    )
})

beforeEach(() => {
    setActivePinia(createPinia())
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

/** 打开下拉 → 切到「任务专注」页签 */
const mountAndOpenTaskTab = async (tasks: TaskViewObject[]) => {
    useTasksStore().addTasks(tasks)
    const fakeTaskUseCase = createFakeTaskUseCase(tasks)

    wrapper = mount(FocusDependDropdown, {
        attachTo: document.body,
        props: { type: 1 },
        global: {
            plugins: [nueUI],
            provide: {
                [POMODORO_VIEW_CONTEXT_KEY as symbol]: buildContext(
                    fakeTaskUseCase as unknown as TaskUseCase
                )
            }
        }
    })
    await flushPromises()

    // 触发入口（原生 button 复用 .nue-link，DEF-128）
    const trigger = wrapper
        .findAll('*')
        .filter((n) => (n.text() ?? '').trim() === '专注' && n.element.children.length === 0)
        .pop()
    expect(trigger?.element.closest('button'), '未找到「专注」触发入口').toBeTruthy()
    ;(trigger!.element.closest('button') as HTMLElement).click()
    await flushPromises()

    // 下拉内容由 nue-dropdown teleport 到 body ⇒ 只能从 document 取（VTU wrapper 不覆盖 teleport）
    const taskTab = [...document.querySelectorAll('#pomodoro-focus-depend-selector *')]
        .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() === '任务专注')
        .pop() as HTMLElement | undefined
    expect(taskTab, '未找到「任务专注」页签').toBeTruthy()
    taskTab!.click()
    await flushPromises()
    await flushPromises()

    return { fakeTaskUseCase }
}

describe('DEF-131 · 任务专注页签列出全部未完成任务', () => {
    it('① 逾期 / 今天 date-only / 未来 / 无截止的未完成任务全部渲染（不再「暂无待办任务」）', async () => {
        await mountAndOpenTaskTab(TASKS)

        const text = document.body.textContent ?? ''
        for (const name of EXPECTED_INCOMPLETE) {
            expect(text, `页面缺少任务「${name}」`).toContain(name)
        }
        expect(text, '未完成任务不应被判为空态').not.toContain('暂无待办任务')
        expect(text, '已完成任务不应出现在专注选择列表').not.toContain('已完成-未来')
    })

    it('② 面板查询不带 relativeDate（回归闸门：加回 `-overdue` 即红）', async () => {
        const { fakeTaskUseCase } = await mountAndOpenTaskTab(TASKS)

        expect(fakeTaskUseCase.list).toHaveBeenCalled()
        const options = fakeTaskUseCase.list.mock.calls[0]![0] as Record<string, unknown>
        expect(options.state).toBe('todo,in-progress')
        expect(options.limit).toBe(10)
        expect(options.isDeleted).toBe(false)
        expect(options.isArchived).toBe(false)
        expect(options.isGivenUp).toBe(false)
        expect(options, '任务专注列表不得按截止时间过滤').not.toHaveProperty('relativeDate')
    })
})