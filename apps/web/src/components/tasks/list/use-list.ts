import { computed, provide } from 'vue'
import type { GetTasksSortOptions, TaskColumnOptions, TaskVO } from '@nao-todo/types'
import type { TaskListContext, TaskListEmits, TaskListProps } from './types'
import useMultiSelect from './use-multi-select'
import dayjs from 'dayjs'
import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-tasks-loader'

export const TASK_LIST_CONTEXT_KEY = Symbol('TASK_LIST_CONTEXT_KEY')

export const useTaskList = (props: TaskListProps, emit: TaskListEmits) => {
    // @hook Use multi select
    const { selectRange, showMultiSelectPanel, clearMultiSelect, isInMultiSelectRange } =
        useMultiSelect(props, emit)

    // @hook Use tasks loader
    const {
        states: loaderStates,
        loadAndPush: fetchTasks,
        loadNextPage: loadMore,
        reset
    } = useTasksLoader(props.taskLister)

    // @computed 计算标签显示数量 - 用于响应式变化时变化标签显示个数
    const tagBarClamped = computed(() => {
        if (!props.columns) return 2
        let trueCount = 0
        Object.keys(props.columns).forEach((key: string) => {
            if (props.columns[key as keyof TaskColumnOptions]) trueCount += 1
        })
        return Math.max(Math.ceil(5 / trueCount), 2)
    })

    // @method 检测当前待办任务是否过期
    const isTaskExpired = (task: TaskVO) => {
        const now = dayjs()
        const endAt = dayjs(task.endAt)
        return now.isAfter(endAt) && task.state !== 'done'
    }

    // @method 显示待办详情
    const showTaskDetails = (taskId: TaskVO['id'], idx: number) => {
        // 恢复多选参数 - 取消多选
        selectRange.original = selectRange.start = selectRange.end = idx
        // 显示详情
        emit('showTaskDetails', taskId)
    }

    // @method 删除/恢复按钮处理
    const deleteOrRestore = (taskId: TaskVO['id'], isDeleted: boolean) => {
        if (isDeleted) {
            emit('restoreTask', taskId)
        } else {
            emit('deleteTask', taskId)
        }
    }

    // @provide 任务列表上下文
    provide<TaskListContext>(TASK_LIST_CONTEXT_KEY, {
        columns: computed(() => props.columns),
        sortOptions: computed(() => props.sortOptions),
        tags: computed(() => props.tags),
        tasks: computed(() => props.tasks),
        tagBarClamped,
        showTaskDetails,
        updateColumns: (key: string, value: boolean) => emit('updateColumns', key, value),
        updateSortOptions: (options: GetTasksSortOptions) => emit('updateSortOptions', options),
        clearSortOptions: () => emit('clearSortOptions'),
        deleteTask: (taskId: TaskVO['id']) => emit('deleteTask', taskId),
        restoreTask: (taskId: TaskVO['id']) => emit('restoreTask', taskId),
        getColumnLabel: props.columnLabelGetter,
        isTaskExpired,
        isInMultiSelectRange,
        showMultiSelectPanel,
        clearMultiSelect,
        getProjectName: props.projectNameGetter,
        deleteOrRestore
    })

    // @returns
    return { states: loaderStates, loadMore, reset, fetchTasks }
}
