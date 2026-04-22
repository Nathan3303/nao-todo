import type {
    TableColumnConfig,
    TableLayoutConfig,
    ColumnReorderPayload,
    ColumnResizePayload
} from './types'
import type { TaskColumnOptions } from '@nao-todo/types'
import { ref, computed } from 'vue'
import { columnLabels } from '@nao-todo/infrastructure/consts/tasks'

export const DEFAULT_TABLE_COLUMNS: TableColumnConfig[] = [
    {
        key: 'name',
        label: columnLabels.name,
        visible: true,
        width: null,
        minWidth: 200,
        maxWidth: 600,
        defaultWidth: 300
    },
    {
        key: 'createdAt',
        label: columnLabels.createdAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'updatedAt',
        label: columnLabels.updatedAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'startAt',
        label: columnLabels.startAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'endAt',
        label: columnLabels.endAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'priority',
        label: columnLabels.priority,
        visible: true,
        width: null,
        minWidth: 80,
        maxWidth: 150,
        defaultWidth: 100
    },
    {
        key: 'state',
        label: columnLabels.state,
        visible: true,
        width: null,
        minWidth: 80,
        maxWidth: 150,
        defaultWidth: 100
    },
    {
        key: 'project',
        label: columnLabels.project,
        visible: true,
        width: null,
        minWidth: 80,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'deletedAt',
        label: columnLabels.deletedAt,
        visible: false,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    }
]

export const createDefaultTableConfig = (tableId: string): TableLayoutConfig => ({
    columns: DEFAULT_TABLE_COLUMNS,
    tableId,
    version: '1.0.0',
    updatedAt: new Date().toISOString()
})

export default (initialConfig?: TableLayoutConfig, tableId: string = 'default') => {
    const layoutConfig = ref<TableLayoutConfig>(initialConfig || createDefaultTableConfig(tableId))

    const visibleColumns = computed(() => {
        return layoutConfig.value.columns.filter((col) => col.visible)
    })

    const getColumnByKey = (key: keyof TaskColumnOptions) => {
        return layoutConfig.value.columns.find((col) => col.key === key)
    }

    const getColumnWidth = (key: keyof TaskColumnOptions) => {
        const col = getColumnByKey(key)
        if (!col) return 'auto'
        return col.width ?? col.defaultWidth
    }

    const reorderColumns = (payload: ColumnReorderPayload) => {
        const { fromIndex, toIndex } = payload
        if (fromIndex === toIndex) return

        const visibleCols = visibleColumns.value
        if (
            fromIndex < 0 ||
            fromIndex >= visibleCols.length ||
            toIndex < 0 ||
            toIndex >= visibleCols.length
        )
            return

        const fromColumn = visibleCols[fromIndex]
        const toColumn = visibleCols[toIndex]

        if (fromColumn.key === 'name' || toColumn.key === 'name') return

        const newColumns = [...layoutConfig.value.columns]
        const fromColumnIndex = newColumns.findIndex((c) => c.key === fromColumn.key)
        const toColumnIndex = newColumns.findIndex((c) => c.key === toColumn.key)

        const [removed] = newColumns.splice(fromColumnIndex, 1)
        newColumns.splice(toColumnIndex, 0, removed)

        layoutConfig.value = {
            ...layoutConfig.value,
            columns: newColumns,
            updatedAt: new Date().toISOString()
        }
    }

    const resizeColumn = (payload: ColumnResizePayload) => {
        const { columnKey, newWidth } = payload
        const col = getColumnByKey(columnKey)
        if (!col) return

        const clampedWidth = Math.max(col.minWidth, Math.min(col.maxWidth, newWidth))

        const newColumns = layoutConfig.value.columns.map((c) =>
            c.key === columnKey ? { ...c, width: clampedWidth } : c
        )

        layoutConfig.value = {
            ...layoutConfig.value,
            columns: newColumns,
            updatedAt: new Date().toISOString()
        }
    }

    const updateColumnVisibility = (key: keyof TaskColumnOptions, visible: boolean) => {
        const newColumns = layoutConfig.value.columns.map((c) =>
            c.key === key ? { ...c, visible } : c
        )

        layoutConfig.value = {
            ...layoutConfig.value,
            columns: newColumns,
            updatedAt: new Date().toISOString()
        }
    }

    const resetConfig = () => {
        layoutConfig.value = createDefaultTableConfig(tableId)
    }

    const syncFromProps = (propsColumns: TaskColumnOptions) => {
        const newColumns = layoutConfig.value.columns.map((col) => ({
            ...col,
            visible: propsColumns[col.key] !== undefined ? propsColumns[col.key] : col.visible
        }))

        layoutConfig.value = {
            ...layoutConfig.value,
            columns: newColumns as TableColumnConfig[]
        }
    }

    return {
        layoutConfig,
        visibleColumns,
        getColumnByKey,
        getColumnWidth,
        reorderColumns,
        resizeColumn,
        updateColumnVisibility,
        resetConfig,
        syncFromProps
    }
}

