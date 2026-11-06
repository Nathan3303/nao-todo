// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, nextTick, provide, ref } from 'vue'
import { useSubscriber } from '@nao-todo/shared/hooks'
import {
    NueButton,
    NueContainer,
    NueContent,
    NueDiv,
    NueDropdown,
    NueEmpty,
    NueIcon,
    NueInput,
    NueLink,
    NueMain,
    NueProgress,
    NueSeparator,
    NueText,
    NueTextarea
} from 'nue-ui'
import { useTasksStore } from '@nao-todo/presentation/task'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { CALENDAR_MONTHLY_CONTEXT_KEY } from '../../monthly-context'
import { useCalendarTaskQuery } from '../use-calendar-task-query'
import { buildGridModel } from '../monthly-layout'
import MonthGrid from '../month-grid.vue'

/**
 * `T663` 追加复验 · `DEF-144` 日历落点 + `DEF-148`（`T664` 提交 `214d7223` / `66daf286`）
 *
 * @description **真挂载**生产组件 `month-grid.vue`（不是只测 hook）：`loading / error / refreshError /
 *              tasks` 来自**真** `useCalendarTaskQuery`，`model` 由**真** `buildGridModel` 从同一份快照
 *              算出；`taskUseCase.list` 用可控桩（可挂起 / 可失败）。断言全部落在用户可见 DOM：
 *              `.cal-body-state`（加载/错误/空态整块占位）、`.cal-row` 节点身份、`.task-refresh-warning`。
 *
 * 口径：jsdom 无布局 ⇒ 用「加载/错误整块占位是否出现 + 网格行节点身份是否变化」代表「整块不被替换」。
 */

const YEAR = 2026
const MONTH_INDEX = 10 // 2026-11

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const TICK = async (): Promise<void> => {
    await nextTick()
    await Promise.resolve()
    await nextTick()
}

type Deferred = { promise: Promise<void>; release: () => void }
const makeDeferred = (): Deferred => {
    let release: () => void = () => {}
    const promise = new Promise<void>((r) => (release = () => r()))
    return { promise, release }
}

const makeTask = (id: string, name: string): TaskViewObject =>
    ({
        id,
        userId: 'u1',
        parentTaskId: '',
        name,
        description: '',
        state: 'todo',
        priority: 'medium',
        startAt: `${YEAR}-11-10 09:00:00`,
        endAt: `${YEAR}-11-10 10:00:00`,
        projectId: null,
        tags: [],
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
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
        isGivenUp: false
    }) as unknown as TaskViewObject

type Mode = 'ok' | 'fail'

type Harness = {
    wrapper: VueWrapper
    emit: (event: string) => void
    setMode: (m: Mode) => void
    setSeed: (tasks: TaskViewObject[]) => void
    parkNext: () => Deferred
    listCalls: () => number
    snapshot: () => string[]
}

const NUE = {
    'nue-button': NueButton,
    'nue-container': NueContainer,
    'nue-content': NueContent,
    'nue-div': NueDiv,
    'nue-dropdown': NueDropdown,
    'nue-empty': NueEmpty,
    'nue-icon': NueIcon,
    'nue-input': NueInput,
    'nue-link': NueLink,
    'nue-main': NueMain,
    'nue-progress': NueProgress,
    'nue-separator': NueSeparator,
    'nue-text': NueText,
    'nue-textarea': NueTextarea
}

/** jsdom 无 ResizeObserver（`useCalendarGrid` 量行高用） */
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
)

const mountCalendar = (
    seed: TaskViewObject[],
    options: { mode?: Mode; parkInitial?: boolean } = {}
): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const tasksStore = useTasksStore(pinia)
    tasksStore.addTasks(seed.map((t) => ({ ...t })))

    let mode: Mode = options.mode ?? 'ok'
    let parked: Deferred | null = options.parkInitial ? makeDeferred() : null
    let current = seed
    let calls = 0

    const list = vi.fn(async () => {
        calls += 1
        if (parked) {
            const gate = parked
            parked = null
            await gate.promise
        }
        if (mode === 'fail') return [null, '10051 请求过于频繁，请稍后再试']
        tasksStore.addTasks(current.map((t) => ({ ...t })))
        return [
            {
                taskIds: current.map((t) => t.id),
                pagination: { total: current.length, page: 1, limit: 200, maxPage: 1 }
            },
            null
        ]
    })
    const taskUseCase = { list } as unknown as TaskUseCase
    const subscriber = useSubscriber()

    // Provider：与生产同构（`use-calendar-monthly` 的位置）——`inject` 只能取祖先，故必须分层：
    // Host 提供「日历视图上下文 / 应用视图上下文」⇒ Provider 内取用并构造真实拉取组合式，
    // 再把 `CALENDAR_MONTHLY_CONTEXT_KEY` provide 给子组件 `MonthGrid`。
    const Provider = defineComponent({
        components: { MonthGrid },
        setup() {
            // 真实拉取/订阅组合式（生产依赖：store + usecase）
            const { loading, error, refreshError, retry, tasks } = useCalendarTaskQuery({
                tasksStore,
                taskUseCase
            })
            const laneLimit = ref(3)
            const selectedKey = ref<string | null>(null)

            provide(CALENDAR_MONTHLY_CONTEXT_KEY, {
                loading,
                error,
                refreshError,
                retry,
                model: computed(() =>
                    buildGridModel(YEAR, MONTH_INDEX, tasks.value, selectedKey.value, 3, 'sunday')
                ),
                monthTitle: computed(() => '2026 年 11 月'),
                year: computed(() => YEAR),
                selectedKey,
                selectedProjectIds: ref<string[]>([]),
                selectedTagIds: ref<string[]>([]),
                hideCompleted: ref(false),
                filterActive: computed(() => false),
                weekStart: ref<'sunday' | 'monday'>('sunday'),
                sort: ref('name:asc'),
                unscheduledTasks: computed(() => []),
                unscheduledDisabled: computed(() => false),
                badgeLabel: () => '',
                laneLimit,
                rescheduleBusyId: ref<string | null>(null),
                scheduleToDay: vi.fn(),
                drag: {
                    isTarget: () => false,
                    session: { active: false, kind: 'bar', taskId: '' },
                    startPossible: vi.fn()
                },
                quickCreateDate: ref<string | null>(null),
                quickCreatePending: computed(() => false),
                openQuickCreate: vi.fn(),
                closeQuickCreate: vi.fn(),
                inlineCreateTask: vi.fn(),
                openTaskDetails: vi.fn(),
                onOpenDay: vi.fn(),
                onOpenUnscheduled: vi.fn(),
                onCloseUnscheduled: vi.fn(),
                onGoWeekView: vi.fn(),
                onGoDayView: vi.fn(),
                goPrevMonth: vi.fn(),
                goNextMonth: vi.fn(),
                goToToday: vi.fn(),
                jumpToMonth: vi.fn(),
                jumpToWeekOfMonthFirst: vi.fn(),
                clearFilter: vi.fn()
            } as never)
            return {}
        },
        template: `<month-grid />`
    })

    const Host = defineComponent({
        components: { Provider },
        setup() {
            provide(CALENDAR_VIEW_CONTEXT_KEY, {
                dialogManager: { open: vi.fn(), close: vi.fn() },
                subscriber,
                showTaskDetails: vi.fn(),
                selectedProjectIds: ref<string[]>([]),
                selectedTagIds: ref<string[]>([]),
                hideCompleted: ref(false),
                clearFilter: vi.fn(),
                weekStart: ref<'sunday' | 'monday'>('sunday')
            } as never)
            provide(INDEX_VIEW_CONTEXT_KEY, {
                isDisplayAside: ref(false),
                switchDisplayAside: vi.fn()
            } as never)
            return {}
        },
        template: `<provider />`
    })

    const wrapper = mount(Host, {
        attachTo: document.body,
        global: { components: NUE }
    })

    return {
        wrapper,
        emit: (event: string) => subscriber.emit(event as never),
        setMode: (m) => (mode = m),
        setSeed: (tasks) => (current = tasks),
        parkNext: () => (parked = makeDeferred()),
        listCalls: () => calls,
        snapshot: () =>
            Array.from(wrapper.element.querySelectorAll('.cal-row')).map(
                (el) =>
                    `${(el as Element).className}:${(el as Element).textContent?.slice(0, 12) ?? ''}`
            )
    }
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((w) => w.unmount())
    mounted = []
    document.body.innerHTML = ''
})

/** 加载/错误/空态整块占位（`.cal-body-state`）；出现即「内容被替换」 */
const stateBlocks = (wrapper: VueWrapper): number => wrapper.findAll('.cal-body-state').length
const warn = (wrapper: VueWrapper): string =>
    wrapper.find('.task-refresh-warning').exists()
        ? wrapper.find('.task-refresh-warning').text()
        : ''
const rowNodes = (wrapper: VueWrapper): Element[] =>
    Array.from(wrapper.element.querySelectorAll('.cal-row'))

describe('T663 追加 · DEF-144 日历：自动刷新不整块换加载态（AC-C1）', () => {
    it('首进：数据未到时整块显示加载态（不得「永不显示 loading」）', async () => {
        const harness = mountCalendar([makeTask('c1', '月会')], { parkInitial: true })
        mounted.push(harness.wrapper)
        await SETTLE()

        console.log(
            '[T663/probeCal:first]',
            JSON.stringify({ stateBlocks: stateBlocks(harness.wrapper) })
        )
        expect(stateBlocks(harness.wrapper), '首进必须有加载态').toBe(1)
        expect(harness.wrapper.text(), '首进加载态文案应可见').toContain('正在加载')
    })

    it('RefreshData 在飞期间：不出现整块占位、网格行节点身份不变', async () => {
        const harness = mountCalendar([makeTask('c1', '月会')])
        mounted.push(harness.wrapper)
        await SETTLE()

        const before = { rows: rowNodes(harness.wrapper), blocks: stateBlocks(harness.wrapper) }
        expect(before.rows.length, '前置：网格已渲染').toBeGreaterThan(0)
        expect(before.blocks).toBe(0)

        harness.parkNext()
        harness.emit('RefreshData')
        await TICK()

        const during = { rows: rowNodes(harness.wrapper), blocks: stateBlocks(harness.wrapper) }
        console.log(
            '[T663/probeCal:during]',
            JSON.stringify({
                blocks: during.blocks,
                rows: during.rows.length,
                text: harness.wrapper.text().slice(0, 20)
            })
        )
        expect(during.blocks, '在飞期间不得出现整块加载占位').toBe(0)
        expect(during.rows, '在飞期间网格行节点身份不变').toEqual(before.rows)

        await SETTLE()
        expect(stateBlocks(harness.wrapper)).toBe(0)
    })

    it('刷新确实带来新内容（不得用「不刷新」换「不抖」）', async () => {
        const harness = mountCalendar([makeTask('c1', '旧会议')])
        mounted.push(harness.wrapper)
        await SETTLE()
        expect(harness.wrapper.text()).toContain('旧会议')

        harness.setSeed([makeTask('c1', '新会议')])
        harness.emit('RefreshData')
        await SETTLE()
        console.log(
            '[T663/probeCal:update]',
            JSON.stringify({ text: harness.wrapper.text().slice(0, 30) })
        )
        expect(harness.wrapper.text(), '刷新后应反映新内容').toContain('新会议')
    })
})

describe('T663 追加 · DEF-148 日历：刷新失败保留内容 + 提示条', () => {
    it('静默刷新失败：不放整块错误占位、网格保留、提示条可见', async () => {
        const harness = mountCalendar([makeTask('c1', '月会')])
        mounted.push(harness.wrapper)
        await SETTLE()
        const before = rowNodes(harness.wrapper)
        expect(before.length).toBeGreaterThan(0)

        harness.setMode('fail')
        harness.emit('RefreshData')
        await SETTLE()

        console.log(
            '[T663/probeCal:fail]',
            JSON.stringify({
                blocks: stateBlocks(harness.wrapper),
                rows: rowNodes(harness.wrapper).length,
                warn: warn(harness.wrapper).slice(0, 30)
            })
        )
        expect(stateBlocks(harness.wrapper), '失败不得整块换成错误/加载占位').toBe(0)
        expect(rowNodes(harness.wrapper), '网格行身份不得变化').toEqual(before)
        expect(warn(harness.wrapper), '失败必须可见（提示条）').toMatch(/刷新失败/)
    })

    it('下一轮成功 ⇒ 提示条消除', async () => {
        const harness = mountCalendar([makeTask('c1', '月会')])
        mounted.push(harness.wrapper)
        await SETTLE()

        harness.setMode('fail')
        harness.emit('RefreshData')
        await SETTLE()
        expect(warn(harness.wrapper)).toMatch(/刷新失败/)

        harness.setMode('ok')
        harness.emit('RefreshData')
        await SETTLE()
        expect(warn(harness.wrapper), '成功后提示条必须消失').toBe('')
    })

    it('首进即失败（无内容）⇒ 整块错误态 + 重试可点（不得降级成提示条）', async () => {
        const harness = mountCalendar([], { mode: 'fail' })
        mounted.push(harness.wrapper)
        await SETTLE()

        console.log(
            '[T663/probeCal:firstfail]',
            JSON.stringify({
                blocks: stateBlocks(harness.wrapper),
                hasRetry: harness.wrapper.text().includes('重试'),
                warn: warn(harness.wrapper).slice(0, 20)
            })
        )
        expect(stateBlocks(harness.wrapper), '首进失败必须是整块错误态').toBe(1)
        expect(harness.wrapper.text()).toContain('重试')
        expect(warn(harness.wrapper), '无内容可保时不得只用提示条').toBe('')
    })
})