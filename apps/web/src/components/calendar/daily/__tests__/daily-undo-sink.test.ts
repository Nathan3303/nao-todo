// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { CALENDAR_UNDO_SINK_KEY, type CalendarUndoPayload } from '../../undo-sink'
import DailyView from '../index.vue'

/**
 * TASK-18 / T71 C9 撤销呈现唯一（新增用例，另起文件）
 * @description 有宿主注入通道时，daily 时间轴撤销栈经 `report` 上报宿主渲染，
 *              本地**不**渲染第二个 `schedule-undo-toast`（禁两 toast 并存）；
 *              撤销/超时后经 `clear` 回收。无宿主回退由 daily-interactions.test.ts 覆盖。
 */

const hoisted = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), create: vi.fn() }))

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

let wrapper: VueWrapper | null = null
const report = vi.fn<(payload: CalendarUndoPayload) => void>()
const clear = vi.fn()

const mountDailyWithSink = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore().addTasks(TASKS)
    wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            provide: {
                [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(),
                [CALENDAR_UNDO_SINK_KEY as symbol]: { report, clear }
            }
        }
    })
    await flushPromises()
    const track = wrapper.find('[data-testid="day-axis-track"]')
    if (track.exists()) stubRect(track.element, 0, 1440)
    const bar = wrapper.find('[data-testid="day-task"][data-task-id="a"]')
    if (bar.exists()) stubRect(bar.element, 540, 60)
    return wrapper
}

const dragBar = async (w: VueWrapper): Promise<void> => {
    const bar = w.find('[data-testid="day-task"][data-task-id="a"]')
    pointer('pointerdown', 540, bar.element)
    await nextTick()
    pointer('pointermove', 790, window)
    pointer('pointerup', 790, window)
    await flushPromises()
}

beforeEach(() => {
    report.mockReset()
    clear.mockReset()
    hoisted.list.mockReset().mockResolvedValue([
        {
            taskIds: TASKS.map((t) => t.id),
            pagination: { total: TASKS.length, page: 1, limit: 100, maxPage: 1 }
        },
        null
    ])
    hoisted.update.mockReset().mockResolvedValue(null)
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('T71 C9 撤销呈现唯一（有宿主）', () => {
    it('时间轴拖拽成功后经注入通道上报宿主，且本地不渲染第二个 toast', async () => {
        const w = await mountDailyWithSink()
        expect(document.querySelectorAll('[data-testid="schedule-undo"]')).toHaveLength(0)

        await dragBar(w)

        expect(report).toHaveBeenCalledTimes(1)
        const payload = report.mock.calls[0]![0]
        expect(payload.action.text).toBe('已调整时间')
        expect(payload.action.snapshots).toHaveLength(1)
        // C9：本地不再挂载 toast（全节唯一挂载点 = 宿主）
        expect(document.querySelectorAll('[data-testid="schedule-undo"]')).toHaveLength(0)
    })

    it('撤销后经 clear 回收（宿主侧 toast 消失）', async () => {
        const w = await mountDailyWithSink()
        // immediate watch 在挂载时已 clear 一次（清理陈旧上报）；此处只关注后续回收
        clear.mockClear()
        await dragBar(w)
        expect(report).toHaveBeenCalledTimes(1)

        const payload = report.mock.calls[0]![0]
        payload.dismiss()
        await flushPromises()

        expect(clear).toHaveBeenCalledTimes(1)
    })
})