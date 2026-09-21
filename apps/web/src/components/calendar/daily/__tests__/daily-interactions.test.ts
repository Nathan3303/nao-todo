// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import dayjs from 'dayjs'
import { NueMessage } from 'nue-ui'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import ScheduleUndoToast from '../../monthly/undo-toast.vue'
import DailyView from '../index.vue'

/**
 * TASK-16 日视图交互组件级行为断言（PRD §5.5 / §5.7 DOM 契约 / ADR C7·C9 / AC4·AC5）
 *
 * 冻结口径：
 *  - DOM：任务条 `[data-testid="day-task"][data-task-id]`、右缘把手 `[data-testid="day-task-resize"]`、
 *         空白点击区 `[data-testid="day-axis-track"]`；内联新建 `[data-testid="day-quick-create"]`
 *         + 输入框 `[data-testid="day-quick-create-input"]`；共享撤销条 `[data-testid="schedule-undo"]`。
 *  - 快速新建（D5）：点击空白**先出现内联命名编辑器**（Enter 提交 / Esc·失焦取消 / 空名忽略），
 *         提交时 `create` 收到 floor 时间与**用户输入名**；点击不直接建。
 *  - 坐标基准：`day-axis-track` 的 `getBoundingClientRect()` + 指针绝对位置；mock 宽度 1440 ⇒ 1px = 1 分钟。
 *  - 写回：新建 `create`；拖拽/拉伸 `useCalendarSchedule` 内核 + `update`；撤销 `undoLast`。
 */

const hoisted = vi.hoisted(() => ({
    list: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
}))

vi.mock('@/hooks', () => ({
    useTaskUseCase: () => ({
        list: hoisted.list,
        update: hoisted.update,
        create: hoisted.create
    })
}))

const TODAY = dayjs().format('YYYY-MM-DD')
const at = (hhmm: string) => `${TODAY} ${hhmm}:00`

const makeTask = (id: string, start: string, end: string): TaskViewObject =>
    ({
        id,
        name: `任务 ${id}`,
        state: 'todo',
        priority: 'low',
        startAt: at(start),
        endAt: at(end),
        createdAt: '2026-09-01 00:00:00',
        tags: []
    }) as unknown as TaskViewObject

const TASKS: TaskViewObject[] = [makeTask('a', '09:00', '10:00')]

const buildContext = () => ({
    dialogManager: { open: () => {} },
    subscriber: { subscribe: () => {}, unsubscribe: () => {}, emit: () => {} },
    isDisplayAside: ref(false),
    isUseFloatAside: ref(false),
    switchDisplayAside: () => {},
    showTaskDetails: () => {},
    selectedProjectIds: ref<string[]>([]),
    selectedTagIds: ref<string[]>([]),
    hideCompleted: ref(false),
    weekStart: ref<'sunday' | 'monday'>('monday'),
    setWeekStart: () => {},
    pomodoroBadge: ref(true),
    setPomodoroBadge: () => {},
    clearFilter: () => {},
    applyScope: () => {}
})

const stubRect = (el: Element, left: number, width: number): void => {
    el.getBoundingClientRect = () =>
        ({
            left,
            top: 0,
            width,
            height: 100,
            right: left + width,
            bottom: 100,
            x: left,
            y: 0,
            toJSON: () => ({})
        }) as DOMRect
}

const pointer = (type: string, x: number, target: EventTarget): void => {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: x,
            clientY: 50,
            pointerId: 1
        })
    )
}

const mouseClick = (x: number, target: EventTarget): void => {
    target.dispatchEvent(
        new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: x,
            clientY: 50
        })
    )
}

let wrapper: VueWrapper | null = null

const mountDaily = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore().addTasks(TASKS)
    wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext() }
        }
    })
    await flushPromises()
    // 坐标基准：day-axis-track（冻结）；1px = 1 分钟
    const track = wrapper.find('[data-testid="day-axis-track"]')
    if (track.exists()) stubRect(track.element, 0, 1440)
    const bar = wrapper.find('[data-testid="day-task"][data-task-id="a"]')
    if (bar.exists()) stubRect(bar.element, 540, 60)
    const handle = wrapper.find('[data-testid="day-task-resize"]')
    if (handle.exists()) stubRect(handle.element, 600, 8)
    return wrapper
}

const barOf = (w: VueWrapper) => w.find('[data-testid="day-task"][data-task-id="a"]')
const trackOf = (w: VueWrapper) => w.find('[data-testid="day-axis-track"]')

const lastPatch = () => {
    const call = hoisted.update.mock.calls.at(-1)
    return call?.[1] as { startAt?: string | null; endAt?: string | null } | undefined
}

const hhmm = (value: string | null | undefined) => (value ? dayjs(value).format('HH:mm') : null)

/** 拖任务条主体：originX → targetX（1px = 1 分钟） */
const dragBar = async (w: VueWrapper, originX: number, targetX: number): Promise<void> => {
    pointer('pointerdown', originX, barOf(w).element)
    await nextTick()
    pointer('pointermove', targetX, window)
    pointer('pointerup', targetX, window)
    await flushPromises()
}

/** 拖右缘把手 */
const dragResize = async (w: VueWrapper, originX: number, targetX: number): Promise<void> => {
    const handle = w.find('[data-testid="day-task-resize"]')
    pointer('pointerdown', originX, handle.element)
    await nextTick()
    pointer('pointermove', targetX, window)
    pointer('pointerup', targetX, window)
    await flushPromises()
}

/** 打开内联新建编辑器（点空白 15:20） */
const openQuickCreate = async (w: VueWrapper): Promise<void> => {
    mouseClick(920, trackOf(w).element)
    await flushPromises()
}

beforeEach(() => {
    hoisted.list.mockReset().mockResolvedValue([
        {
            taskIds: TASKS.map((t) => t.id),
            pagination: { total: TASKS.length, page: 1, limit: 100, maxPage: 1 }
        },
        null
    ])
    hoisted.update.mockReset().mockResolvedValue(null)
    hoisted.create.mockReset().mockResolvedValue([{ id: 'new' }, null])
    vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
    vi.spyOn(NueMessage, 'success').mockImplementation(() => {})
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('TASK-16 交互 DOM 契约（§5.7）', () => {
    it('任务条含 day-task + data-task-id、右缘 day-task-resize、空白区 day-axis-track', async () => {
        const w = await mountDaily()
        expect(barOf(w).exists()).toBe(true)
        expect(w.find('[data-testid="day-task-resize"]').exists()).toBe(true)
        expect(trackOf(w).exists()).toBe(true)
    })
})

describe('TASK-16 快速新建：内联命名（floor，D5 / §5.5 / AC4③）', () => {
    it('点 15:20 空白 ⇒ 出现内联编辑器，且此时 create 未被调用', async () => {
        const w = await mountDaily()
        await openQuickCreate(w)

        expect(w.find('[data-testid="day-quick-create"]').exists()).toBe(true)
        expect(w.find('[data-testid="day-quick-create-input"]').exists()).toBe(true)
        expect(hoisted.create).not.toHaveBeenCalled()
    })

    it('键入名称 + Enter ⇒ create startAt=15:00 / endAt=15:30 且名称=输入值', async () => {
        const w = await mountDaily()
        await openQuickCreate(w)
        const input = w.find('[data-testid="day-quick-create-input"]')
        await input.setValue('周会')
        await input.trigger('keydown', { key: 'Enter' })
        await flushPromises()

        const payload = hoisted.create.mock.calls.at(-1)?.[0] as {
            name?: string
            startAt?: string
            endAt?: string
        }
        expect(payload).toBeTruthy()
        expect(payload!.name).toBe('周会')
        expect(hhmm(payload!.startAt)).toBe('15:00')
        expect(hhmm(payload!.endAt)).toBe('15:30')
    })

    it('Esc 取消 ⇒ create 未被调用，编辑器关闭', async () => {
        const w = await mountDaily()
        await openQuickCreate(w)
        await w.find('[data-testid="day-quick-create-input"]').trigger('keydown', { key: 'Escape' })
        await flushPromises()

        expect(hoisted.create).not.toHaveBeenCalled()
        expect(w.find('[data-testid="day-quick-create"]').exists()).toBe(false)
    })

    it('空名回车 ⇒ create 未被调用（B6 语义）', async () => {
        const w = await mountDaily()
        await openQuickCreate(w)
        const input = w.find('[data-testid="day-quick-create-input"]')
        await input.setValue('   ')
        await input.trigger('keydown', { key: 'Enter' })
        await flushPromises()

        expect(hoisted.create).not.toHaveBeenCalled()
    })
})

describe('TASK-16 拖拽改时间（round + 时长不变，§5.5 / AC4①④）', () => {
    it('拖到 13:10 ⇒ startAt=13:00 / endAt=14:00（时长 60 分不变）', async () => {
        const w = await mountDaily()
        await dragBar(w, 540, 790)

        const patch = lastPatch()
        expect(patch).toBeTruthy()
        expect(hhmm(patch!.startAt)).toBe('13:00')
        expect(hhmm(patch!.endAt)).toBe('14:00')
        expect(dayjs(patch!.endAt!).diff(dayjs(patch!.startAt!), 'minute')).toBe(60)
    })

    it('拖到 13:16 ⇒ startAt=13:30（round 取最近 30 分）', async () => {
        const w = await mountDaily()
        await dragBar(w, 540, 796)

        expect(hhmm(lastPatch()?.startAt)).toBe('13:30')
    })
})

describe('TASK-16 拉伸改时长（round + 下限，§5.5 / AC4②）', () => {
    it('拖右缘到 11:07 ⇒ endAt=11:00', async () => {
        const w = await mountDaily()
        await dragResize(w, 600, 667)

        expect(hhmm(lastPatch()?.endAt)).toBe('11:00')
    })

    it('拖到小于 30 分钟处 ⇒ endAt 不低于 startAt+30，且不得 endAt<startAt', async () => {
        const w = await mountDaily()
        // 目标 09:10（550）→ round 09:00，低于 startAt(09:00)+30 ⇒ 下限 09:30
        await dragResize(w, 600, 550)

        const patch = lastPatch()
        expect(hhmm(patch!.endAt)).toBe('09:30')
        expect(dayjs(patch!.endAt!).isBefore(dayjs(patch!.startAt!))).toBe(false)
    })
})

describe('TASK-16 撤销并入（§5.5 / AC4⑤ / C9）', () => {
    it('拖拽后点 schedule-undo ⇒ 恢复原值（09:00–10:00）', async () => {
        const w = await mountDaily()
        await dragBar(w, 540, 790)
        expect(hhmm(lastPatch()?.startAt)).toBe('13:00')

        const toast = w.findComponent(ScheduleUndoToast)
        expect(toast.exists(), '应出现共享撤销条').toBe(true)
        // teleport 到 body：组件级断言「撤销动作」链路（按钮→emit 由 undo-toast 自身用例覆盖）
        expect(
            document.querySelectorAll('[data-testid="schedule-undo"] .utoast__undo').length
        ).toBeGreaterThan(0)
        toast.vm.$emit('undo')
        await flushPromises()

        const restore = lastPatch()
        expect(hhmm(restore?.startAt)).toBe('09:00')
        expect(hhmm(restore?.endAt)).toBe('10:00')
    })
})

describe('TASK-16 拖出当日（A5′ / D2）', () => {
    it('拖到次日时间点 ⇒ startAt 为真实时间（不夹取），重渲染后离开日视图', async () => {
        const w = await mountDaily()
        // 让写回真正落到 store，便于观察重渲染移除
        hoisted.update.mockImplementation(async (id: string, patch: object) => {
            useTasksStore().updateTask(id, patch as never)
            return null
        })

        // 位移 +1440 分钟 = 次日同时刻
        await dragBar(w, 540, 540 + 1440)

        const patch = lastPatch()!
        const tomorrow = dayjs(TODAY).add(1, 'day').format('YYYY-MM-DD')
        expect(dayjs(patch.startAt).format('YYYY-MM-DD')).toBe(tomorrow)
        expect(hhmm(patch.startAt)).toBe('09:00')
        expect(hhmm(patch.endAt)).toBe('10:00')
        await flushPromises()
        expect(barOf(w).exists()).toBe(false)
    })
})

describe('TASK-16 失败回退（AC5① / C9）', () => {
    it('写回失败 ⇒ toast + 条回到提交前位置（style 不变）+ 无脏 store 写入', async () => {
        hoisted.update.mockResolvedValue('boom')
        const w = await mountDaily()
        const styleBefore = barOf(w).attributes('style')
        const before = useTasksStore().getTask('a')!

        await dragBar(w, 540, 790)

        expect(hoisted.update).toHaveBeenCalledTimes(1)
        expect(NueMessage.error).toHaveBeenCalled()
        expect(barOf(w).attributes('style')).toBe(styleBefore)
        expect(useTasksStore().getTask('a')!.startAt).toBe(before.startAt)
        expect(useTasksStore().getTask('a')!.endAt).toBe(before.endAt)
    })
})

describe('TASK-16 拖动期不触发数据刷新（C7）', () => {
    it('pointermove 期间 list 未被再次调用，松手才写回', async () => {
        const w = await mountDaily()
        const listCalls = hoisted.list.mock.calls.length
        pointer('pointerdown', 540, barOf(w).element)
        await nextTick()
        pointer('pointermove', 790, window)
        pointer('pointermove', 830, window)
        await flushPromises()
        expect(hoisted.list.mock.calls.length).toBe(listCalls)

        pointer('pointerup', 830, window)
        await flushPromises()
        expect(hoisted.update).toHaveBeenCalled()
    })
})