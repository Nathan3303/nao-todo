import { translateTaskError } from '@nao-todo/presentation/task'
import { isArchivedReadOnlyError } from '@nao-todo/presentation/task/archive-gate'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import { useTaskUseCase } from '@/hooks'
import { NueMessage } from 'nue-ui'
import dayjs from 'dayjs'
import { onUnmounted, ref, watch } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    closeScheduleUndo,
    holdScheduleUndo,
    presentScheduleUndo,
    UNDO_FAILED_DURATION,
    UNDO_TERMINAL_DURATION,
    type ScheduleUndoPresentation,
    type ScheduleUndoStatus
} from '../undo-message'
import { todayDateKey } from './monthly-layout'
import {
    shiftTaskDates,
    snapshotTaskDates,
    type BatchScheduleResult,
    type ScheduleUndoAction,
    type TaskScheduleSnapshot
} from './reschedule'

/**
 * useCalendarSchedule —— 排期/改期/批量/撤销（O12 拆分）
 * @description 单条安排（B7 抽屉行/F4 菜单/F1 拖拽共用）、延期到今天（A3）、
 *              批量安排（F3）与 U2 最近一次撤销（M2/F4、M3/F1 复用）；
 *              同任务/批量/撤销各自 busy 防连点，撤销与批量互斥（P3-1）。
 * @param deps.taskUseCase 由组装点（useCalendarMonthly）创建注入，DI 入口单一
 */
export const useCalendarSchedule = (deps: { taskUseCase: ReturnType<typeof useTaskUseCase> }) => {
    const { taskUseCase } = deps

    // ===== U2 最近一次撤销（单条/批量共用内核；M2/F4、M3/F1 复用此机制） =====

    // @states 最近一次成功写回动作（仅保留最近一个：新成功动作替换旧快照）；撤销/超时后失效
    const undoAction = ref<ScheduleUndoAction | null>(null)
    const undoBusy = ref(false) // 撤销写回防连点
    const undoStatus = ref<ScheduleUndoStatus>('idle') // 状态机：idle→busy→undone/failed（T364）
    const scheduleBusy = ref(false) // 批量排期防连点

    // @method 「X 月 X 日」日期标签（按日期键直接拆分，无时区偏移；月/日文案随语言）
    const monthDayLabelOf = (dateKey: string): string => {
        const [, month, day] = dateKey.split('-')
        return t('calendar.undo.dateLabel', { month: Number(month), day: Number(day) })
    }

    // @method 弹出/刷新撤销入口（替换最近一次；约 5s 自动超时失效）
    //             新动作一律重置状态机为 idle（终态不跨动作残留）；
    //             实际呈现由下方 watch 交给 `undo-message`（NueMessage extension 单入口）
    const showUndoAction = (action: ScheduleUndoAction): void => {
        undoStatus.value = 'idle'
        undoAction.value = action
    }
    const dismissUndoAction = (): void => {
        undoAction.value = null
    }

    // @method 单次写回尝试：成功返回 true 并记录前值快照（供批量撤销整体回写）
    const writeScheduleOnce = async (
        task: TaskViewObject,
        dateKey: string,
        snapshots: TaskScheduleSnapshot[]
    ): Promise<{ ok: boolean; err: Error | string | null }> => {
        const snapshot = snapshotTaskDates(task)
        const patch = shiftTaskDates(task, dateKey)
        if (patch === null) return { ok: false, err: null } // dateKey 非法防御（UI 键均合法，不可达）
        const err = await taskUseCase.update(task.id, {
            ...patch,
            updatedAt: dayjs().toISOString()
        })
        if (err !== null) return { ok: false, err }
        snapshots.push(snapshot)
        return { ok: true, err: null }
    }

    // @method 单条安排到某日（B7 抽屉行/F4 菜单/F1 共用；成功提供「撤销」入口）
    //              同任务 busy 防连点（不同任务可并行，与 B7 逐行语义一致）
    const rescheduleBusyId = ref<TaskViewObject['id']>('')
    const scheduleToDay = async (task: TaskViewObject, dateKey: string): Promise<void> => {
        if (rescheduleBusyId.value === task.id) return
        rescheduleBusyId.value = task.id
        try {
            const snapshots: TaskScheduleSnapshot[] = []
            const { ok, err } = await writeScheduleOnce(task, dateKey, snapshots)
            if (!ok) {
                // T191：归档只读码静默（守卫已提示）
                if (err !== null && !isArchivedReadOnlyError(err)) {
                    NueMessage.error(translateTaskError(err))
                }
                return
            }
            showUndoAction({
                text: t('calendar.undo.movedTo', { date: monthDayLabelOf(dateKey) }),
                tone: 'success',
                snapshots
            })
        } finally {
            rescheduleBusyId.value = ''
        }
    }

    // @method 延期到今天（A3 别名）：scheduleToDay 的今日特例
    const deferToToday = async (task: TaskViewObject): Promise<void> =>
        scheduleToDay(task, todayDateKey())

    // @method 批量安排到某日（F3）：对选中任务串行小步写回；busy 防连点；
    //              全成/部分失败弹撤销 toast（部分失败仅还原成功项）；全败无撤销、错误 toast
    const runBatchSchedule = async (
        tasks: TaskViewObject[],
        dateKey: string
    ): Promise<BatchScheduleResult> => {
        const allIds = tasks.map((t) => t.id)
        if (scheduleBusy.value || tasks.length === 0)
            return { ok: 0, fail: allIds.length, failedIds: allIds }
        scheduleBusy.value = true
        const snapshots: TaskScheduleSnapshot[] = []
        const failedIds: TaskViewObject['id'][] = []
        try {
            for (const task of tasks) {
                const { ok } = await writeScheduleOnce(task, dateKey, snapshots)
                if (!ok) failedIds.push(task.id)
            }
            const fail = failedIds.length
            const ok = tasks.length - fail
            if (ok > 0 && fail > 0) {
                showUndoAction({
                    text: t('calendar.undo.partialFailed', { ok, fail }),
                    tone: 'warning',
                    snapshots
                })
            } else if (ok > 0) {
                showUndoAction({
                    text: t('calendar.undo.scheduledCount', { count: ok }),
                    tone: 'success',
                    snapshots
                })
            } else {
                NueMessage.error(t('calendar.undo.allFailed', { fail }))
            }
            return { ok, fail, failedIds }
        } finally {
            scheduleBusy.value = false
        }
    }

    // @method 分钟级时间写回（日视图横向拖拽/拉伸，C9）：快照 + 单次 update；
    //              失败 toast（无乐观脏状态）、成功入 U2 撤销栈。
    const applyTimePatch = async (
        task: TaskViewObject,
        patch: { startAt?: string; endAt?: string },
        labelKey: LocaleKey = 'calendar.undo.timeAdjusted'
    ): Promise<boolean> => {
        const snapshot = snapshotTaskDates(task)
        const err = await taskUseCase.update(task.id, {
            ...patch,
            updatedAt: dayjs().toISOString()
        })
        if (err !== null) {
            // T191：归档只读码静默（守卫已提示）
            if (!isArchivedReadOnlyError(err)) NueMessage.error(translateTaskError(err))
            return false
        }
        showUndoAction({ text: t(labelKey), tone: 'success', snapshots: [snapshot] })
        return true
    }

    // @method 撤销最近一次动作：以快照原值回写（串行、busy 防连点）
    //             ≻ 全部成功 ⇒ 进入 **undone 终态**（不关闭消息：按钮不可再点 + 文案变更，直至既有超时）
    //             ≻ 任一失败 ⇒ **failed**（不显示已撤销；保留入口仍可重试 + 原错误提示）
    //             P3-1：与批量排期互斥——批量写回进行中不执行撤销（慢网批量中入口禁用/串行化）
    const undoLast = async (): Promise<void> => {
        const action = undoAction.value
        if (!action || undoBusy.value) return
        if (undoStatus.value === 'undone') return // 终态：成功撤销后不可再执行（幂等，连点/键盘连击最多一次）
        if (scheduleBusy.value) return // 批量串行写回中：撤销延迟到批结束后（新动作将替换旧快照）
        if (action.snapshots.length === 0) {
            dismissUndoAction()
            return
        }
        undoBusy.value = true
        undoStatus.value = 'busy'
        try {
            let firstErr: Error | string | null = null
            for (const snap of action.snapshots) {
                const err = await taskUseCase.update(snap.id, {
                    startAt: snap.prevStartAt,
                    endAt: snap.prevEndAt,
                    updatedAt: dayjs().toISOString()
                })
                if (err !== null && firstErr === null) firstErr = err
            }
            if (firstErr === null) {
                // 仅确认全部写回成功后才置终态（禁止乐观置位）；并重置消失计时，保证「已撤销」可见
                undoStatus.value = 'undone'
                holdScheduleUndo(UNDO_TERMINAL_DURATION)
                return
            }
            undoStatus.value = 'failed'
            // 失败态同样重置计时：用户要看得清失败文案并有机会重试
            holdScheduleUndo(UNDO_FAILED_DURATION)
            if (!isArchivedReadOnlyError(firstErr)) {
                NueMessage.error(translateTaskError(firstErr))
            }
        } finally {
            undoBusy.value = false
        }
    }

    // @states 呈现状态（终态优先 ⇒ 成功后即使批量 busy 也不回退为可点；其余按 busy 收敛）
    const undoEntryStatus = (): ScheduleUndoStatus => {
        if (undoStatus.value === 'undone') return 'undone'
        if (undoBusy.value || scheduleBusy.value) return 'busy'
        if (undoStatus.value === 'failed') return 'failed'
        return 'idle'
    }

    // @states 本实例当前呈现的载荷（按实例身份，用于「只关自己那条」）
    let undoPresentation: ScheduleUndoPresentation | null = null

    // @watch 呈现层（T362）：动作出现 ⇒ 经 NueMessage 扩展插槽呈现撤销入口
    //        （全节单一入口由 `undo-message` 的模块级句柄注册表保证）；
    //        动作被清除（超时 / 卸载）⇒ 关闭自己那一条（成功终态仍保留至超时，不在此关闭）
    watch(undoAction, (action) => {
        if (action) {
            undoPresentation = {
                action,
                status: undoEntryStatus,
                undo: undoLast,
                dismiss: dismissUndoAction
            }
            presentScheduleUndo(undoPresentation)
            return
        }
        closeScheduleUndo(undoPresentation ?? undefined)
        undoPresentation = null
    })
    // @lifecycle 视图卸载/页面切换 → 撤销快照失效（U2 同视图生命周期约束）＋ 关闭自己那条撤销入口
    //              （消息挂在应用根下、不在本组件树内 ⇒ 必须显式收口，避免残留）
    onUnmounted(() => {
        undoAction.value = null
        closeScheduleUndo(undoPresentation ?? undefined)
        undoPresentation = null
    })

    return {
        // —— 单条排期/改期（F4）busy 标识（逐任务防连点，月/周条 + 抽屉行共用） ——
        rescheduleBusyId,
        // —— 批量排期（F3）+ U2 最近一次撤销（M2/F4、M3/F1 复用） ——
        scheduleBusy,
        runBatchSchedule,
        undoAction,
        undoBusy,
        undoStatus,
        undoLast,
        dismissUndoAction,
        scheduleToDay,
        deferToToday,
        // —— 分钟级时间写回（日视图 T51；复用同一 U2 撤销栈） ——
        applyTimePatch
    }
}