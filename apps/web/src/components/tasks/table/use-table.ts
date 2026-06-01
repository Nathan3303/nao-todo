import { computed, provide, watch } from 'vue'
import type { TaskTableContext, TaskTableEmits, TaskTableProps } from './types'
import type { GetTasksSortOptions, TaskColumnOptions, TaskViewObject } from '@nao-todo/types'
import useMultiSelect from './use-multi-select'
import useColumnConfig from './use-column-config'
import dayjs from 'dayjs'

export const TASK_TABLE_CONTEXT_KEY = Symbol('TASK_TABLE_CONTEXT_KEY')

export default (props: TaskTableProps, emit: TaskTableEmits) => {
    // @hook 多选配置
    const { selectRange, showMultiSelectPanel, clearMultiSelect, isInMultiSelectRange } =
        useMultiSelect(props, emit)

    // @hook 列配置
    const tableId = props.layoutConfig?.tableId

    // @computed 在当前内置分类视图中抑制对应的状态样式
    const suppressDeletedStyle = computed(() => tableId === 'deleted')
    const suppressGivenUpLabel = computed(() => tableId === 'givenup')
    const initialConfig = props.layoutConfig?.columns?.length ? props.layoutConfig : undefined
    const {
        layoutConfig,
        visibleColumns,
        reorderColumns,
        resizeColumn,
        resetConfig,
        syncFromProps,
        pinnedColumn
    } = useColumnConfig(initialConfig, tableId)

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
        selectRange.original = selectRange.start = selectRange.end = idx
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

    // @method 处理列排序
    const handleColumnReorder = (payload: any) => {
        reorderColumns(payload)
        emit('columnReorder', payload)
        emit('updateLayoutConfig', layoutConfig.value)
    }

    // @method 处理列宽调整
    const handleColumnResize = (payload: any) => {
        resizeColumn(payload)
        emit('columnResize', payload)
        emit('updateLayoutConfig', layoutConfig.value)
    }

    // @method 重置表格配置
    const handleResetTableConfig = () => {
        resetConfig()
        emit('updateLayoutConfig', layoutConfig.value)
    }

    // @watch 同步列配置到 props
    watch(
        () => props.columns,
        (newColumns) => syncFromProps(newColumns),
        { immediate: true, deep: true }
    )

    // @provide 任务表格上下文
    provide<TaskTableContext>(TASK_TABLE_CONTEXT_KEY, {
        tasks: computed(() => props.tasks),
        columns: computed(() => props.columns),
        getOptions: computed(() => props.getOptions),
        tags: computed(() => props.tags),
        tagBarClamped,
        layoutConfig: computed(() => layoutConfig.value),
        visibleColumns: computed(() => visibleColumns.value),
        pinnedColumn,
        suppressDeletedStyle,
        suppressGivenUpLabel,
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
        deleteTaskPermanently: handleDeleteTaskPermanently,
        getColumnLabel: props.columnLabelGetter,
        isTaskExpired,
        isInMultiSelectRange,
        showMultiSelectPanel,
        clearMultiSelect,
        getProjectName: props.projectNameGetter,
        deleteOrRestore,
        columnReorder: handleColumnReorder,
        columnResize: handleColumnResize,
        resetTableConfig: handleResetTableConfig
    })
}

