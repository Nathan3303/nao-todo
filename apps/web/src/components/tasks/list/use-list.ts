import { computed, provide } from 'vue'
import type { TaskColumnOptions, TaskViewObject } from '@nao-todo/types'
import type { TaskListContext, TaskListEmits, TaskListProps } from './types'
import useMultiSelect from './use-multi-select'
import { isTaskExpired } from '@nao-todo/infrastructure/utils/date-checker'

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

    // @method 处理永久删除任务
    const handleDeleteTaskPermanently = (taskId: TaskViewObject['id']) => {
        emit('deleteTaskPermanently', taskId)
    }

    // @provide 任务列表上下文
    provide<TaskListContext>(TASK_LIST_CONTEXT_KEY, {
        columns: computed(() => props.columns),
        sortOptions: computed(() => props.sortOptions),
        tags: computed(() => props.tags),
        tasks: computed(() => props.tasks),
        tagBarClamped,
        showTaskDetails,
        deleteTask: (taskId: TaskViewObject['id']) => emit('deleteTask', taskId),
        restoreTask: (taskId: TaskViewObject['id']) => emit('restoreTask', taskId),
        deleteTaskPermanently: handleDeleteTaskPermanently,
        isTaskExpired,
        isInMultiSelectRange,
        showMultiSelectPanel,
        clearMultiSelect,
        getProjectName: props.projectNameGetter,
        deleteOrRestore
    })
}

