// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import dayjs from 'dayjs'
import { NueMessage } from 'nue-ui'
import { TASK_CREATOR_DIALOG_KEY } from '@nao-todo/shared/constants'
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
 *         空白点击区 `[data-testid="day-axis-track"]`；共享撤销条 `[data-testid="schedule-undo"]`。
 *  - 新建入口（T84 契约变更 A，取代 TASK-16 D5 内联新建）：点击**带文本刻度标签**
 *         （`.day-col-label`，原生 button）⇒ `dialogManager.open(TASK_CREATOR_DIALOG_KEY, { startAt, endAt })`；
 *         空白不再新建（无 `day-quick-create`）；空文本列无 button / 不可 Tab。
 *  - 坐标基准：`day-axis-track` 的 `getBoundingClientRect()` + 指针绝对位置；mock 宽度 1440 ⇒ 1px = 1 分钟。
 *  - 写回：拖拽/拉伸 `useCalendarSchedule` 内核 + `update`；撤销 `undoLast`（新建改走对话框，不在本文件）。
 */

const hoisted = vi.hoisted(() => ({
    list: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    open: vi.fn()
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

const buildContext = (dayZoom?: Ref<number>) => ({
    dialogManager: { open: hoisted.open },
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
    applyScope: () => {},
    ...(dayZoom ? { dayZoom } : {})
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

const mountDaily = async (dayZoom?: Ref<number>): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore().addTasks(TASKS)
    wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(dayZoom) }
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
    hoisted.open.mockReset()
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

describe('TASK-19B AC1 刻度标签 → 创建对话框（契约变更 A，取代 TASK-16 D5）', () => {
    it('点空白（day-axis-track）不再新建：无 day-quick-create、open/create 均未调用', async () => {
        const w = await mountDaily()
        mouseClick(920, trackOf(w).element)
        await flushPromises()

        expect(w.find('[data-testid="day-quick-create"]').exists()).toBe(false)
        expect(hoisted.open).not.toHaveBeenCalled()
        expect(hoisted.create).not.toHaveBeenCalled()
    })

    it('点 14:30 刻度标签 ⇒ dialogManager.open(TASK_CREATOR_DIALOG_KEY, { startAt 14:30, endAt 15:00 })', async () => {
        const w = await mountDaily(ref(2)) // ×2 = 15min 档 ⇒ 14:30 带文本
        const label = w
            .findAll('.day-col-label')
            .find((btn) => btn.attributes('aria-label') === '在 14:30 创建任务')
        expect(label, '应存在 14:30 刻度按钮').toBeTruthy()

        await label!.trigger('click')
        await flushPromises()

        expect(hoisted.open).toHaveBeenCalledTimes(1)
        const [key, payload] = hoisted.open.mock.calls[0] as [
            unknown,
            { startAt: string; endAt: string }
        ]
        expect(key).toBe(TASK_CREATOR_DIALOG_KEY)
        expect(hhmm(payload.startAt)).toBe('14:30')
        expect(hhmm(payload.endAt)).toBe('15:00')
        expect(dayjs(payload.endAt).diff(dayjs(payload.startAt), 'minute')).toBe(30)
    })

    it('刻度标签为原生 button：仅带文本列有 .day-col-label，aria-label 「在 HH:MM 创建任务」', async () => {
        const w = await mountDaily() // ×1 ⇒ 24 个整点标签
        const labels = w.findAll('.day-col-label')
        expect(labels).toHaveLength(24)
        for (const btn of labels) {
            expect(btn.element.tagName).toBe('BUTTON')
            expect(btn.attributes('type')).toBe('button')
            expect(btn.attributes('aria-label')).toMatch(/^在 \d{2}:\d{2} 创建任务$/)
        }
        // 冻结契约：列头直接子节点数仍 === 列数（button 是孙节点）
        const container = w.find('[data-testid="day-columns"]')
        expect(container.element.children).toHaveLength(48)

        // r3：首/末带文本列边界类名（类可落在 .day-col-head 或 .day-col-label 上）
        const heads = Array.from(container.element.children)
        const textHeads = heads.filter((el) => (el.textContent ?? '').trim().length > 0)
        const hasTickClass = (el: Element, cls: string): boolean =>
            el.classList.contains(cls) || !!el.querySelector(`.${cls}`)
        expect(hasTickClass(textHeads[0]!, 'is-first-tick')).toBe(true)
        expect(hasTickClass(textHeads[textHeads.length - 1]!, 'is-last-tick')).toBe(true)
    })

    it('空文本列无 button（不可点 / 不参与 Tab）', async () => {
        const w = await mountDaily() // ×1 ⇒ 24 空文本列
        const heads = Array.from(w.find('[data-testid="day-columns"]').element.children)
        const empty = heads.filter((el) => (el.textContent ?? '').trim().length === 0)
        expect(empty).toHaveLength(24)
        for (const head of empty) expect(head.querySelector('.day-col-label')).toBeNull()
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