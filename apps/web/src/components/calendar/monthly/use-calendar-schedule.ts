import { translateTaskError } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { NueMessage } from 'nue-ui'
import dayjs from 'dayjs'
import { onUnmounted, ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
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
    const scheduleBusy = ref(false) // 批量排期防连点

    // @method 「X 月 X 日」日期标签（按日期键直接拆分，无时区偏移）
    const monthDayLabelOf = (dateKey: string): string => {
        const [, month, day] = dateKey.split('-')
        return `${Number(month)} 月 ${Number(day)} 日`
    }

    // @method 弹出/刷新撤销 toast（替换最近一次；约 5s 自动超时失效由 undo-toast 内部计时并 dismiss）
    const showUndoAction = (action: ScheduleUndoAction): void => {
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
                if (err !== null) NueMessage.error(translateTaskError(err))
                return
            }
            showUndoAction({
                text: `已移至 ${monthDayLabelOf(dateKey)}`,
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
                    text: `成功 ${ok} · 失败 ${fail}，失败项已保留选中`,
                    tone: 'warning',
                    snapshots
                })
            } else if (ok > 0) {
                showUndoAction({ text: `已安排 ${ok} 个任务`, tone: 'success', snapshots })
            } else {
                NueMessage.error(`成功 0 · 失败 ${fail}，已保留选中`)
            }
            return { ok, fail, failedIds }
        } finally {
            scheduleBusy.value = false
        }
    }

    // @method 撤销最近一次动作：以快照原值回写（串行、busy 防连点、失败 toast）；成功/失败均不再保留入口
    //              P3-1：与批量排期互斥——批量写回进行中不执行撤销（慢网批量中入口禁用/串行化）
    const undoLast = async (): Promise<void> => {
        const action = undoAction.value
        if (!action || undoBusy.value) return
        if (scheduleBusy.value) return // 批量串行写回中：撤销延迟到批结束后（新动作将替换旧快照）
        if (action.snapshots.length === 0) {
            dismissUndoAction()
            return
        }
        undoBusy.value = true
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
            dismissUndoAction()
            if (firstErr !== null) NueMessage.error(translateTaskError(firstErr))
        } finally {
            undoBusy.value = false
        }
    }

    // @lifecycle 视图卸载/页面切换 → 撤销快照失效（U2 同视图生命周期约束）
    onUnmounted(() => {
        undoAction.value = null
    })

    return {
        // —— 单条排期/改期（F4）busy 标识（逐任务防连点，月/周条 + 抽屉行共用） ——
        rescheduleBusyId,
        // —— 批量排期（F3）+ U2 最近一次撤销（M2/F4、M3/F1 复用） ——
        scheduleBusy,
        runBatchSchedule,
        undoAction,
        undoBusy,
        undoLast,
        dismissUndoAction,
        scheduleToDay,
        deferToToday
    }
}