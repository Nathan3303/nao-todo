import type {
    TableColumnConfig,
    TableLayoutConfig,
    ColumnReorderPayload,
    ColumnResizePayload
} from './types'
import type { TaskColumnOptions } from '@nao-todo/usecases/task'
import { ref, computed } from 'vue'
import { PINNED_COLUMN_MAP, enforcePinnedColumn, createDefaultTableConfig } from './column-defaults'
import { readConfig, writeConfig, clearConfig } from './column-storage'

/**
 * 表格列配置管理
 * @param initialConfig 初始表格布局配置
 * @param tableId 表格唯一标识符
 * @returns 表格列配置管理对象
 */
export default (initialConfig?: TableLayoutConfig, tableId: string = 'default') => {
    // @init 初始化表格布局
    const layoutConfig = ref<TableLayoutConfig>(initialConfig || createDefaultTableConfig(tableId))

    // @init 从 localStorage 恢复已保存的列宽和列排序
    const savedConfig = readConfig(tableId)
    if (savedConfig) {
        const columns = [...layoutConfig.value.columns]
        // 恢复列宽：仅在合法范围内应用已保存的宽度
        for (const col of columns) {
            const savedWidth = savedConfig.widths[col.key]
            if (
                savedWidth !== undefined &&
                savedWidth >= col.minWidth &&
                savedWidth <= col.maxWidth
            ) {
                col.width = savedWidth
            }
        }
        // 恢复列排序：按已保存的顺序重排，未知列和缺失列保持默认位置
        if (savedConfig.order?.length) {
            const keyOrderMap = new Map(savedConfig.order.map((key, idx) => [key, idx]))
            columns.sort((a, b) => {
                const orderA = keyOrderMap.get(a.key)
                const orderB = keyOrderMap.get(b.key)
                if (orderA !== undefined && orderB !== undefined) return orderA - orderB
                if (orderA !== undefined) return -1
                if (orderB !== undefined) return 1
                return 0
            })
        }
        layoutConfig.value = { ...layoutConfig.value, columns }
    }

    // 强制执行固定列排序
    layoutConfig.value = {
        ...layoutConfig.value,
        columns: enforcePinnedColumn(layoutConfig.value.columns, tableId)
    }

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

        if (fromColumn?.key === 'name' || toColumn?.key === 'name') return

        const pinnedKey = PINNED_COLUMN_MAP[tableId]
        if (pinnedKey && (fromColumn?.key === pinnedKey || toColumn?.key === pinnedKey)) return

        const newColumns = [...layoutConfig.value.columns]
        const fromColumnIndex = newColumns.findIndex((c) => c.key === fromColumn?.key)
        const toColumnIndex = newColumns.findIndex((c) => c.key === toColumn?.key)

        const [removed] = newColumns.splice(fromColumnIndex, 1)
        newColumns.splice(toColumnIndex, 0, removed as TableColumnConfig)

        layoutConfig.value = {
            ...layoutConfig.value,
            columns: newColumns,
            updatedAt: new Date().toISOString()
        }
        // 持久化列排序到 localStorage
        writeConfig(tableId, newColumns)
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
        // 持久化列宽到 localStorage
        writeConfig(tableId, newColumns)
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
        // 同步清除 localStorage 中已保存的表格配置
        clearConfig(tableId)
    }

    const syncFromProps = (propsColumns: TaskColumnOptions) => {
        const newColumns = layoutConfig.value.columns.map((col) => ({
            ...col,
            visible: propsColumns[col.key] !== undefined ? propsColumns[col.key] : col.visible
        }))

        layoutConfig.value = {
            ...layoutConfig.value,
            columns: enforcePinnedColumn(newColumns as TableColumnConfig[], tableId)
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
        syncFromProps,
        pinnedColumn: computed(() => PINNED_COLUMN_MAP[tableId] || undefined)
    }
}

