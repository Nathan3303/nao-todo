import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { TaskColumnOptions } from '@nao-todo/shared'
import type { TaskListContext, TaskListEmits, TaskListProps } from './types'
import useMultiSelect from './use-multi-select'
import { isTaskExpired, useMinuteTask } from '@nao-todo/shared'

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

    // @method 处理任务点击事件
    const handleClickTask = (task: TaskViewObject, taskIdx: number) => {
        showTaskDetails(task.id, taskIdx)
        emit('task-clicked', task)
    }

    // @watch 多选清除信号 - 外部（批量编辑面板）递增时清空多选范围
    watch(
        () => props.multiSelectClearSignal,
        (newSignal, oldSignal) => {
            if (oldSignal !== undefined && newSignal !== oldSignal) clearMultiSelect(true)
        }
    )

    // @hook 刷新 key
    const refreshKey = ref(1)
    const { run: startRefreshKeyIncrement, stop: stopRefreshKeyIncrement } = useMinuteTask(
        () => (refreshKey.value += 1)
    )

    // @onmounted
    onMounted(() => {
        startRefreshKeyIncrement()
    })

    // @onunmounted
    onUnmounted(() => {
        stopRefreshKeyIncrement()
    })

    // @provide 任务列表上下文
    provide<TaskListContext>(TASK_LIST_CONTEXT_KEY, {
        columns: computed(() => props.columns),
        sortOptions: computed(() => props.sortOptions),
        tags: computed(() => props.tags),
        tasks: computed(() => props.tasks),
        tagBarClamped,
        small: computed(() => props.small || false),
        showTaskDetails,
        deleteTask: (taskId: TaskViewObject['id']) => emit('deleteTask', taskId),
        restoreTask: (taskId: TaskViewObject['id']) => emit('restoreTask', taskId),
        deleteTaskPermanently: handleDeleteTaskPermanently,
        isTaskExpired,
        isInMultiSelectRange,
        showMultiSelectPanel,
        clearMultiSelect,
        getProjectName: props.projectNameGetter,
        deleteOrRestore,
        handleClickTask,
        refreshKey,
        startRefreshKeyIncrement,
        stopRefreshKeyIncrement
    })
}