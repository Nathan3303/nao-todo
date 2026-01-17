import { computed, provide } from 'vue'
import type { TaskTableContext, TaskTableEmits, TaskTableProps } from './types'
import type { GetTasksSortOptions, TaskColumnOptions, TaskVO } from '@nao-todo/types'
import useMultiSelect from './use-multi-select'
import dayjs from 'dayjs'

export const TASK_TABLE_CONTEXT_KEY = Symbol('TASK_TABLE_CONTEXT_KEY')

export default (props: TaskTableProps, emit: TaskTableEmits) => {
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

    // @method 更新页码
    // const handleUpdatePage = (page: number) => {
    //     loaderStates.pagination.page = page
    //     fetchTasks()
    // }

    // @method 更新每页显示数量
    // const handleUpdatePerPage = (limit: number) => {
    //     loaderStates.pagination.limit = limit
    //     handleUpdatePage(1)
    // }

    // @provide 任务表格上下文
    provide<TaskTableContext>(TASK_TABLE_CONTEXT_KEY, {
        tasks: computed(() => props.tasks),
        columns: computed(() => props.columns),
        getOptions: computed(() => props.getOptions),
        tags: computed(() => props.tags),
        tagBarClamped,
        // states: computed(() => loaderStates),
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
        deleteOrRestore,
        // handleUpdatePage,
        // handleUpdatePerPage
    })

    // @returns 返回值
    return {
        // states: loaderStates, fetchTasks
    }
}
