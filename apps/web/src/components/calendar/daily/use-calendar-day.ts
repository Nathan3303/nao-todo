import dayjs from 'dayjs'
import { computed, inject, ref } from 'vue'
import { TASK_CREATOR_DIALOG_KEY } from '@nao-todo/shared/constants'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { dateKeyOf, todayDateKey } from '../monthly/monthly-layout'
import { DAY_SNAP_MINUTES } from '../snap'
import { useCalendarTaskQuery } from '../monthly/use-calendar-task-query'
import { useCalendarSort } from '../monthly/use-calendar-sort'
import { CALENDAR_DAY_CONTEXT_KEY, type CalendarDayContext } from './context'

/**
 * 日视图上下文解析（TASK-16）
 * @description 优先复用组装点 provide 的 `CALENDAR_DAY_CONTEXT_KEY`（同一任务快照，切视图不重拉）；
 *              无 provider 时（独立挂载/单测）回退为自足实现：注入 `CALENDAR_VIEW_CONTEXT_KEY`
 *              + Pinia，自行拉取/排序，锚点默认今天。
 */
export const useCalendarDay = (): CalendarDayContext => {
    const provided = inject(CALENDAR_DAY_CONTEXT_KEY, null)
    if (provided) return provided

    // —— 自足回退（仅独立挂载时） ——
    const {
        dialogManager,
        showTaskDetails,
        subscriber,
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter
    } = inject(CALENDAR_VIEW_CONTEXT_KEY)!
    const tasksStore = useTasksStore()
    const taskUseCase = useTaskUseCase(tasksStore)
    const {
        loading,
        error,
        retry,
        tasks: queriedTasks
    } = useCalendarTaskQuery({
        tasksStore,
        taskUseCase
    })
    const { sort, sortTasks } = useCalendarSort()
    // 自足回退：叠加 store 已知任务（挂载即渲染）；真实应用由宿主 provide 日上下文，不经过此路径
    const tasks = computed<TaskViewObject[]>(() => {
        const merged = new Map<TaskViewObject['id'], TaskViewObject>()
        for (const task of tasksStore.tasks) merged.set(task.id, task)
        for (const task of queriedTasks.value) merged.set(task.id, task)
        return [...merged.values()]
    })
    const sortedTasks = computed(() => sortTasks(tasks.value))

    const anchorKey = ref(todayDateKey())
    const filterActive = computed(
        () => selectedProjectIds.value.length > 0 || selectedTagIds.value.length > 0
    )
    const unscheduledTasks = computed<TaskViewObject[]>(() =>
        sortedTasks.value.filter((task) => !task.endAt)
    )

    // @method 刻度新建（TASK-19B C5 自足回退；payload 口径与宿主桥一致）
    const prefillScope = (): { projectId?: string; tags?: string[] } => {
        if (selectedProjectIds.value.length === 1 && selectedTagIds.value.length === 0) {
            return { projectId: selectedProjectIds.value[0] }
        }
        if (selectedTagIds.value.length === 1 && selectedProjectIds.value.length === 0) {
            return { tags: [selectedTagIds.value[0]!] }
        }
        return {}
    }
    const onCreateTaskAt = (startMin: number): void => {
        const base = dayjs(anchorKey.value || todayDateKey()).startOf('day')
        const payload: { startAt: string; endAt: string } & Record<string, unknown> = {
            startAt: base.add(startMin, 'minute').toISOString(),
            endAt: base.add(startMin + DAY_SNAP_MINUTES, 'minute').toISOString()
        }
        const scope = prefillScope()
        if (scope.projectId) payload.projectId = scope.projectId
        if (scope.tags) payload.tags = scope.tags
        dialogManager.open(TASK_CREATOR_DIALOG_KEY, payload)
    }

    return {
        loading,
        error,
        onRetry: retry,
        anchorKey,
        todayKey: todayDateKey(),
        tasks: sortedTasks,
        sort,
        isDisplayAside: ref(true),
        switchDisplayAside: () => {},
        onOpenTask: showTaskDetails,
        onTaskCreated: (taskId) => subscriber.emit('AddNewTaskId', taskId),
        onOpenUnscheduled: () => {},
        onOpenDay: () => {},
        onCreateTaskAt,
        onPrevDay: () => {
            anchorKey.value = dateKeyOf(dayjs(anchorKey.value).subtract(1, 'day').valueOf())
        },
        onNextDay: () => {
            anchorKey.value = dateKeyOf(dayjs(anchorKey.value).add(1, 'day').valueOf())
        },
        onGoToday: () => {
            anchorKey.value = todayDateKey()
        },
        onGoMonth: () => {},
        onGoWeek: () => {},
        filterActive,
        hideCompleted,
        onClearFilter: clearFilter,
        onShowCompleted: () => (hideCompleted.value = false),
        unscheduledCount: computed(() => unscheduledTasks.value.length),
        unscheduledDisabled: computed(
            () => unscheduledTasks.value.length === 0 && !filterActive.value && !hideCompleted.value
        )
    }
}