// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    DRAG_THRESHOLD_PX,
    dropDateKeyOf,
    ghostPointOf,
    isDragPastThreshold,
    useDragSchedule,
    type DragScheduleDeps
} from './use-drag-schedule'

/**
 * F1 拖拽排期可测逻辑（P3-2 / A1-F1-01/07/09）
 * @description 阈值判定、胶囊坐标、落点解析、busy 禁起、行源拖起收起抽屉、drop/cancel、点击抑制。
 */

const makeTask = (id = 't1'): TaskViewObject =>
    ({
        id,
        name: '任务 A',
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: '',
        createdAt: '2026-10-01T00:00:00'
    }) as unknown as TaskViewObject

describe('F1 纯逻辑', () => {
    it('阈值判定（DRAG_THRESHOLD_PX=5，欧氏距离）：4px 内为点击、5px 起为拖拽', () => {
        expect(DRAG_THRESHOLD_PX).toBe(5)
        expect(isDragPastThreshold(3, 3)).toBe(false) // ~4.24 < 5
        expect(isDragPastThreshold(4, 2)).toBe(false) // ~4.47 < 5
        expect(isDragPastThreshold(4, 3)).toBe(true) // = 5
        expect(isDragPastThreshold(0, 5)).toBe(true)
        expect(isDragPastThreshold(10, 0)).toBe(true)
    })

    it('胶囊定位 = 指针坐标 + 偏移（fixed 跟随，非克隆）', () => {
        expect(ghostPointOf(100, 80)).toEqual({ x: 108, y: 88 })
        expect(ghostPointOf(0, 0)).toEqual({ x: 8, y: 8 })
    })

    it('落点解析：命中 data-cal-drop 返回日期键；未命中/null 返回 null', () => {
        const cell = { closest: () => ({ dataset: { calDrop: '2026-10-05' } }) }
        expect(dropDateKeyOf(cell)).toBe('2026-10-05')
        expect(dropDateKeyOf({ closest: () => null })).toBeNull()
        expect(dropDateKeyOf(null)).toBeNull()
        expect(dropDateKeyOf({})).toBeNull()
    })
})

describe('useDragSchedule - 会话控制器', () => {
    let deps: DragScheduleDeps
    let scheduleOne: ReturnType<typeof vi.fn>
    let closeUnscheduled: ReturnType<typeof vi.fn>
    let busy: boolean
    let cell: HTMLElement

    const makeDeps = (): DragScheduleDeps => {
        scheduleOne = vi.fn()
        closeUnscheduled = vi.fn()
        busy = false
        return {
            isBusy: () => busy,
            closeUnscheduled: closeUnscheduled as unknown as DragScheduleDeps['closeUnscheduled'],
            scheduleOne: scheduleOne as unknown as DragScheduleDeps['scheduleOne']
        }
    }
    const press = (drag: ReturnType<typeof useDragSchedule>, x = 10, y = 10): boolean =>
        drag.startPossible(
            makeTask(),
            'row',
            new PointerEvent('pointerdown', { button: 0, clientX: x, clientY: y })
        )
    const moveTo = (x: number, y: number, over?: HTMLElement): void => {
        const target = over ?? window
        target.dispatchEvent(
            new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y })
        )
    }
    const release = (): void => {
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    }

    beforeEach(() => {
        deps = makeDeps()
        document.body.innerHTML = ''
        cell = document.createElement('div')
        cell.dataset.calDrop = '2026-10-08'
        document.body.appendChild(cell)
    })

    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('阈值内释放 = 纯点击：不激活、不收抽屉、不写库（F1-07 语义）', () => {
        const drag = useDragSchedule(deps)
        press(drag)
        moveTo(12, 11) // ~2.2px < 阈值
        release()
        expect(drag.session.active).toBe(false)
        expect(closeUnscheduled).not.toHaveBeenCalled()
        expect(scheduleOne).not.toHaveBeenCalled()
    })

    it('busy 禁起：不进入会话、无副作用（P3-1 互斥）', () => {
        busy = true
        const drag = useDragSchedule(deps)
        expect(press(drag)).toBe(false)
        moveTo(100, 100)
        release()
        expect(drag.session.active).toBe(false)
        expect(scheduleOne).not.toHaveBeenCalled()
    })

    it('行源超阈值激活：会话激活（胶囊名）、收起抽屉（F1-01）', () => {
        const drag = useDragSchedule(deps)
        press(drag)
        moveTo(10, 40) // 30px
        expect(drag.session.active).toBe(true)
        expect(drag.session.name).toBe('任务 A')
        expect(drag.session.kind).toBe('row')
        expect(closeUnscheduled).toHaveBeenCalledTimes(1)
    })

    it('拖到目标格释放 → scheduleOne(task, 落点键)（F1-02 直写落格语义）', () => {
        const drag = useDragSchedule(deps)
        const task = makeTask()
        drag.startPossible(
            task,
            'row',
            new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 })
        )
        moveTo(10, 60, cell)
        expect(drag.session.hoverKey).toBe('2026-10-08')
        release()
        expect(scheduleOne).toHaveBeenCalledTimes(1)
        expect(scheduleOne.mock.calls[0]![0]).toBe(task)
        expect(scheduleOne.mock.calls[0]![1]).toBe('2026-10-08')
        expect(drag.session.active).toBe(false)
    })

    it('释放于非目标区 = 取消：不写库（F1-09）', () => {
        const drag = useDragSchedule(deps)
        press(drag)
        moveTo(200, 200) // 非 data-cal-drop
        expect(drag.session.hoverKey).toBeNull()
        release()
        expect(scheduleOne).not.toHaveBeenCalled()
        expect(drag.session.active).toBe(false)
    })

    it('Esc 取消：不写库且后续释放不误触', () => {
        const drag = useDragSchedule(deps)
        press(drag)
        moveTo(10, 60, cell)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(drag.session.active).toBe(false)
        release()
        expect(scheduleOne).not.toHaveBeenCalled()
    })

    it('拖拽手势结束的 click 被抑制一次（防误开详情/日期格；点击语义零回归）', () => {
        const drag = useDragSchedule(deps)
        press(drag)
        moveTo(10, 60, cell)
        release()
        expect(scheduleOne).toHaveBeenCalledTimes(1)
        // 该手势的 click：被 capture 吞掉（preventDefault）
        const link = document.createElement('button')
        document.body.appendChild(link)
        const clickA = new MouseEvent('click', { bubbles: true, cancelable: true })
        link.dispatchEvent(clickA)
        expect(clickA.defaultPrevented).toBe(true)
        // 下一个普通 click 放行
        const clickB = new MouseEvent('click', { bubbles: true, cancelable: true })
        link.dispatchEvent(clickB)
        expect(clickB.defaultPrevented).toBe(false)
    })
})