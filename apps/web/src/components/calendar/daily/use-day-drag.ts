import { computed, inject, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { useCalendarSchedule } from '../monthly/use-calendar-schedule'
import { ghostPointOf, useDragSchedule } from '../monthly/use-drag-schedule'
import { CALENDAR_UNDO_SINK_KEY } from '../undo-sink'
import { DAY_SNAP_MINUTES, snapMinutes } from '../snap'
import { DAY_MINUTES } from './day-zoom'

/**
 * useDayDrag —— 日视图任务条手势与写回（TASK-16 C8/C9/C13 / TASK-19B C2·C3 / TASK-20 AC2·AC7）
 * @description **不新增第二套会话壳**（TASK-16 C8）：复用 `useDragSchedule` 手势壳，日视图仅注入
 *              `resolveDrop` 接管像素级落点；写回链路唯一（`useCalendarSchedule` 快照 + U2 撤销内核，C9）。
 *              - 三种手势：`move`（改 startAt、时长不变）/ `resize`（改 endAt）/ `resize-start`（改 startAt）；
 *              - 锚点 = **真实 `startAt` / `endAt` + Δ**（C13），`round` + 最短 `DAY_SNAP_MINUTES`，
 *                **不夹取可见日边界**（D2 / r2：左拉续接段可落在前一天、右拉可落在次日）；
 *              - 拖动反馈（AC2）：`is-drag-source`（源条区分，经 `drag.session` 下发）+ `.drag-ghost`（浮层）
 *                + `day-drag-preview`（吸附后起止 `HH:MM`）+ `day-drag-snap-line`（吸附刻度高亮线，松手即移除）。
 *              - **布局读取**：`pxPerMinute` 与 `originX` 在**起拖时一次性读取**（`pointermove` 不读布局，C8）。
 */

/** 手势类型（`move`=拖拽改时间 / `resize`=右缘改 endAt / `resize-start`=左缘改 startAt） */
export type DayGesture = 'move' | 'resize' | 'resize-start' | null

export const useDayDrag = () => {
    // —— T51 交互：拖拽改时间 / 拉伸改时长 / 撤销（C7–C10 / C13） ——
    const interactionTaskUseCase = useTaskUseCase(useTasksStore())
    const {
        rescheduleBusyId,
        scheduleBusy,
        undoAction,
        undoBusy,
        undoLast,
        dismissUndoAction,
        applyTimePatch
    } = useCalendarSchedule({ taskUseCase: interactionTaskUseCase })

    // —— C9 撤销呈现唯一：有宿主时经注入通道上报宿主渲染/转发（全节单 toast）；
    //        无宿主（单测/独立挂载）走自足回退（本地渲染 toast）⇒ daily-interactions.test.ts 零改动 ——
    const undoSink = inject(CALENDAR_UNDO_SINK_KEY, null)
    if (undoSink) {
        watch(
            undoAction,
            (action) => {
                if (action) {
                    undoSink.report({
                        action,
                        busy: undoBusy,
                        undo: undoLast,
                        dismiss: dismissUndoAction
                    })
                } else {
                    undoSink.clear()
                }
            },
            { immediate: true }
        )
        onUnmounted(() => undoSink.clear())
    }

    // @states 交互层容器（几何基准）、当前手势、起拖时一次性读取的像素基准
    const trackEl = ref<HTMLElement | null>(null)
    const gesture = ref<DayGesture>(null)
    const pxPerMinute = ref(0)
    const originX = ref(0)
    const dragTask = ref<TaskViewObject | null>(null)

    // @method 坐标基准：day-axis-track 的 rect（指针绝对位置换算；禁 offsetX）
    const trackRect = (): DOMRect | null => trackEl.value?.getBoundingClientRect() ?? null

    const drag = useDragSchedule({
        isBusy: () => rescheduleBusyId.value !== '' || scheduleBusy.value || undoBusy.value,
        closeUnscheduled: () => {},
        scheduleOne: () => {},
        // 日视图像素级落点（C8）：复用同一手势壳；round、真实值锚（C13）、不夹取可见日边界（D2）
        resolveDrop: async ({ task, clientX, originX: dropOriginX }) => {
            const rect = trackRect()
            const mode = gesture.value
            gesture.value = null
            dragTask.value = null
            pxPerMinute.value = 0
            if (!rect || rect.width <= 0 || !task.startAt || !task.endAt) return
            const perMin = rect.width / DAY_MINUTES
            const realStart = dayjs(task.startAt)
            const realEnd = dayjs(task.endAt)
            const deltaMin = (clientX - dropOriginX) / perMin
            if (mode === 'resize-start') {
                // 左缘（C2 r2 / C3）：改 startAt（endAt 不变）；锚真实 startAt + Δ
                const snapped = snapMinutes(
                    realStart.hour() * 60 + realStart.minute() + deltaMin,
                    DAY_SNAP_MINUTES,
                    'round'
                )
                let newStart = realStart.startOf('day').add(snapped, 'minute')
                const latest = realEnd.subtract(DAY_SNAP_MINUTES, 'minute')
                if (newStart.isAfter(latest)) newStart = latest
                await applyTimePatch(
                    task,
                    { startAt: newStart.toISOString(), endAt: realEnd.toISOString() },
                    '已调整开始时间'
                )
                return
            }
            if (mode === 'resize') {
                // 右缘：改 endAt（startAt 不变）；锚真实 endAt + Δ（禁以裁剪后的 24:00 反推）
                const snapped = snapMinutes(
                    realEnd.hour() * 60 + realEnd.minute() + deltaMin,
                    DAY_SNAP_MINUTES,
                    'round'
                )
                let newEnd = realEnd.startOf('day').add(snapped, 'minute')
                const earliest = realStart.add(DAY_SNAP_MINUTES, 'minute')
                if (newEnd.isBefore(earliest)) newEnd = earliest
                await applyTimePatch(
                    task,
                    { startAt: realStart.toISOString(), endAt: newEnd.toISOString() },
                    '已调整时长'
                )
                return
            }
            // 主体拖拽：改 startAt、时长不变（锚真实 startAt + Δ）
            const newStartMin = snapMinutes(
                realStart.hour() * 60 + realStart.minute() + deltaMin,
                DAY_SNAP_MINUTES,
                'round'
            )
            const durationMs = realEnd.valueOf() - realStart.valueOf()
            const newStart = realStart.startOf('day').add(newStartMin, 'minute')
            const newEnd = newStart.add(durationMs, 'ms')
            await applyTimePatch(
                task,
                { startAt: newStart.toISOString(), endAt: newEnd.toISOString() },
                '已调整时间'
            )
        }
    })

    // @method 起拖公共段：置手势 + 起会话（失败即清手势，避免陈旧手势污染写回分支）；
    //          布局（perMin）与 originX **仅在此一次性读取**（C8）
    const begin = (task: TaskViewObject, event: PointerEvent, mode: DayGesture): void => {
        gesture.value = mode
        if (!drag.startPossible(task, 'bar', event)) {
            gesture.value = null
            return
        }
        const rect = trackRect()
        pxPerMinute.value = rect && rect.width > 0 ? rect.width / DAY_MINUTES : 0
        originX.value = event.clientX
        dragTask.value = task
    }
    // @method 起拖（任务条主体）
    const startMove = (task: TaskViewObject, event: PointerEvent): void =>
        begin(task, event, 'move')
    // @method 起拉（右缘把手）：改 endAt（startAt 不变）
    const startResize = (task: TaskViewObject, event: PointerEvent): void =>
        begin(task, event, 'resize')
    // @method 起拉（左缘把手，C2 r2）：改 startAt（endAt 不变）——第三种手势，不复用 move 分支
    const startResizeStart = (task: TaskViewObject, event: PointerEvent): void =>
        begin(task, event, 'resize-start')

    /** 分钟 → 轴百分比（钳制在可见日内；仅用于吸附线定位） */
    const leftOf = (minutes: number): string =>
        `${(Math.min(DAY_MINUTES, Math.max(0, minutes)) / DAY_MINUTES) * 100}%`

    // @computed 拖动中的吸附预览（AC2）：与 `resolveDrop` **逐式同源**（round + 最短 30min + 同钳制）
    const dragPreview = computed<{ text: string; snapLeft: string } | null>(() => {
        const mode = gesture.value
        const task = dragTask.value
        if (!drag.session.active || !mode || !task || pxPerMinute.value <= 0) return null
        if (!task.startAt || !task.endAt) return null
        const realStart = dayjs(task.startAt)
        const realEnd = dayjs(task.endAt)
        if (!realStart.isValid() || !realEnd.isValid()) return null
        const deltaMin = (drag.session.x - originX.value) / pxPerMinute.value
        const startMin = realStart.hour() * 60 + realStart.minute()
        const endMin = realEnd.hour() * 60 + realEnd.minute()
        if (mode === 'resize') {
            const snapped = snapMinutes(endMin + deltaMin, DAY_SNAP_MINUTES, 'round')
            let newEnd = realEnd.startOf('day').add(snapped, 'minute')
            const earliest = realStart.add(DAY_SNAP_MINUTES, 'minute')
            if (newEnd.isBefore(earliest)) newEnd = earliest
            return { text: `→ ${newEnd.format('HH:mm')}`, snapLeft: leftOf(snapped) }
        }
        if (mode === 'resize-start') {
            const snapped = snapMinutes(startMin + deltaMin, DAY_SNAP_MINUTES, 'round')
            let newStart = realStart.startOf('day').add(snapped, 'minute')
            const latest = realEnd.subtract(DAY_SNAP_MINUTES, 'minute')
            if (newStart.isAfter(latest)) newStart = latest
            return { text: `${newStart.format('HH:mm')} →`, snapLeft: leftOf(snapped) }
        }
        const newStartMin = snapMinutes(startMin + deltaMin, DAY_SNAP_MINUTES, 'round')
        const newStart = realStart.startOf('day').add(newStartMin, 'minute')
        const newEnd = newStart.add(realEnd.valueOf() - realStart.valueOf(), 'ms')
        return {
            text: `${newStart.format('HH:mm')} → ${newEnd.format('HH:mm')}`,
            snapLeft: leftOf(newStartMin)
        }
    })

    // @method 浮空胶囊定位（fixed 跟随指针，非 DOM 克隆）
    const ghostStyle = (): { left: string; top: string } => {
        const point = ghostPointOf(drag.session.x, drag.session.y)
        return { left: `${point.x}px`, top: `${point.y}px` }
    }

    return {
        drag,
        trackEl,
        startMove,
        startResize,
        startResizeStart,
        dragPreview,
        ghostStyle,
        scheduleBusy,
        undoAction,
        undoBusy,
        undoLast,
        dismissUndoAction,
        hasHostUndoSink: undoSink !== null
    }
}