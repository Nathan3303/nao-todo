import { computed, provide } from 'vue'
import type { GetTasksSortOptions, TaskColumnOptions, TaskViewObject } from '@nao-todo/types'
import type { TaskListContext, TaskListEmits, TaskListProps } from './types'
import useMultiSelect from './use-multi-select'
import dayjs from 'dayjs'

export const TASK_LIST_CONTEXT_KEY = Symbol('TASK_LIST_CONTEXT_KEY')

export const useTaskList = (props: TaskListProps, emit: TaskListEmits) => {
    // @hook Use multi select
    const { selectRange, showMultiSelectPanel, clearMultiSelect, isInMultiSelectRange } =
        useMultiSelect(props, emit)

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
    const isTaskExpired = (task: TaskViewObject) => {
        const now = dayjs()
        const endAt = dayjs(task.endAt)
        return now.isAfter(endAt) && task.state !== 'done'
    }

    // @method 显示待办详情
    const showTaskDetails = (taskId: TaskViewObject['id'], idx: number) => {
        // 恢复多选参数 - 取消多选
        selectRange.original = selectRange.start = selectRange.end = idx
        // 显示详情
        emit('showTaskDetails', taskId)
    }

    // @method 删除/恢复按钮处理
    const deleteOrRestore = (taskId: TaskViewObject['id'], isDeleted: boolean) => {
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
        updateColumns: (key: keyof TaskColumnOptions, value: boolean) =>
            emit('updateColumns', key, value),
        updateSortOptions: (
            field: GetTasksSortOptions['field'],
            order: GetTasksSortOptions['order']
        ) => emit('updateSortOptions', field, order),
        clearSortOptions: () => emit('clearSortOptions'),
        deleteTask: (taskId: TaskViewObject['id']) => emit('deleteTask', taskId),
        restoreTask: (taskId: TaskViewObject['id']) => emit('restoreTask', taskId),
        getColumnLabel: props.columnLabelGetter,
        isTaskExpired,
        isInMultiSelectRange,
        showMultiSelectPanel,
        clearMultiSelect,
        getProjectName: props.projectNameGetter,
        deleteOrRestore
    })
}

