import dayjs from 'dayjs'
import { computed, inject, ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { dateKeyOf, todayDateKey } from '../monthly/monthly-layout'
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
        showTaskDetails,
        subscriber,
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter
    } = inject(CALENDAR_VIEW_CONTEXT_KEY)!
    const tasksStore = useTasksStore()
    const taskUseCase = useTaskUseCase(tasksStore)
    const { loading, error, retry, tasks } = useCalendarTaskQuery({ tasksStore, taskUseCase })
    const { sort, sortTasks } = useCalendarSort()
    const sortedTasks = computed(() => sortTasks(tasks.value))

    const anchorKey = ref(todayDateKey())
    const filterActive = computed(
        () => selectedProjectIds.value.length > 0 || selectedTagIds.value.length > 0
    )
    const unscheduledTasks = computed<TaskViewObject[]>(() =>
        sortedTasks.value.filter((task) => !task.endAt)
    )

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