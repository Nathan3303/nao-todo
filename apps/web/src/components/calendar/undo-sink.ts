import type { InjectionKey, Ref } from 'vue'
import type { ScheduleUndoAction } from './monthly/reschedule'

/**
 * C9 撤销呈现唯一：宿主唯一的 `schedule-undo-toast` 挂载点通过本注入通道接收
 * daily 时间轴专属撤销栈的上报（载荷 `{ action, busy, undo, dismiss }`），
 * 避免两 toast 在 `position: fixed` 同坐标下重叠遮挡。
 */
export type CalendarUndoPayload = {
    action: ScheduleUndoAction
    busy: Ref<boolean>
    undo: () => void
    dismiss: () => void
}

export type CalendarUndoSink = {
    report: (payload: CalendarUndoPayload) => void
    clear: () => void
}

export const CALENDAR_UNDO_SINK_KEY: InjectionKey<CalendarUndoSink> = Symbol('calendar-undo-sink')