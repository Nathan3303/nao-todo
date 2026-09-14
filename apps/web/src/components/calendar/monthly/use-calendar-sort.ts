import type { TaskViewObject } from '@nao-todo/domain-task'
import { ref, watch } from 'vue'
import {
    readCalendarSort,
    sortCalendarTasks,
    writeCalendarSort,
    type CalendarSort
} from './calendar-sort'

/**
 * useCalendarSort —— 日历排序状态（TASK-08）
 * @description 月/周双视图共享的排序状态与排序入口：
 *              - 状态经 localStorage 独立键持久化（不与任务列表 getTasksOptions.sort 串扰）；
 *              - 仅影响日历展示顺序（月格/周列内任务重排），不写回服务端、不改 sortId；
 *              - 拖拽改期只改日期，显示始终按当前排序重排。
 */
export const useCalendarSort = () => {
    // @states 排序偏好（模块层读取：损坏/非法回退默认按名称升序）
    const sort = ref<CalendarSort>(readCalendarSort())

    // @watch 变更即持久化（独立键；写入失败静默）
    watch(
        sort,
        (value) => {
            writeCalendarSort(value)
        },
        { deep: true }
    )

    // @method 按当前排序重排任务快照（返回新数组，不改动原快照）
    const sortTasks = (tasks: TaskViewObject[]): TaskViewObject[] =>
        sortCalendarTasks(tasks, sort.value)

    return { sort, sortTasks }
}