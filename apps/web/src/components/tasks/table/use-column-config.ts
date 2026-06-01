import type {
    TableColumnConfig,
    TableLayoutConfig,
    ColumnReorderPayload,
    ColumnResizePayload
} from './types'
import type { TaskColumnOptions } from '@nao-todo/types'
import { ref, computed } from 'vue'
import { columnLabels } from '@nao-todo/infrastructure/consts/tasks'

// @const 内置分类对应的固定列（固定列始终显示在 name 列之后）
const PINNED_COLUMN_MAP: Record<string, string> = {
    deleted: 'deletedAt',
    overdue: 'endAt',
    favourite: 'starMarkAt',
    givenup: 'givenUpAt'
}

// @const localStorage 存储键前缀
const STORAGE_KEY_PREFIX = 'TABLE_CONFIG'

// @helper 获取完整 localStorage 键名
const getStorageKey = (tableId: string) => `${STORAGE_KEY_PREFIX}_${tableId}`

// @type 已保存的表格配置
type SavedTableConfig = {
    widths: Record<string, number>
    order: string[]
}

// @helper 从 localStorage 读取已保存的表格配置
const readConfig = (tableId: string): SavedTableConfig | null => {
    try {
        const raw = localStorage.getItem(getStorageKey(tableId))
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

// @helper 将当前列配置写入 localStorage（仅保存宽度和排序）
const writeConfig = (tableId: string, columns: TableColumnConfig[]): void => {
    const widths: Record<string, number> = {}
    for (const col of columns) {
        if (col.width !== null) widths[col.key] = col.width
    }
    const config: SavedTableConfig = {
        widths,
        order: columns.map((c) => c.key)
    }
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(config))
}

// @helper 清除 localStorage 中已保存的表格配置
const clearConfig = (tableId: string): void => {
    localStorage.removeItem(getStorageKey(tableId))
}

// @helper 将固定列移动到 name 列之后的固定位置
const enforcePinnedColumn = (
    columns: TableColumnConfig[],
    tableId: string
): TableColumnConfig[] => {
    const pinnedKey = PINNED_COLUMN_MAP[tableId]
    if (!pinnedKey) return columns

    const nameIndex = columns.findIndex((c) => c.key === 'name')
    const pinnedIndex = columns.findIndex((c) => c.key === pinnedKey)
    if (pinnedIndex === -1) return columns

    // 固定列应在 name 之后（索引 1）；若缺失 name 列则退到索引 0
    const targetIndex = nameIndex === -1 ? 0 : 1
    if (pinnedIndex === targetIndex) return columns

    const newColumns = [...columns]
    const [removed] = newColumns.splice(pinnedIndex, 1)
    newColumns.splice(targetIndex, 0, removed as TableColumnConfig)
    return newColumns
}

export const DEFAULT_TABLE_COLUMNS: TableColumnConfig[] = [
    {
        key: 'name',
        label: columnLabels.value.name,
        visible: true,
        width: null,
        minWidth: 300,
        maxWidth: 600,
        defaultWidth: 400
    },
    {
        key: 'deletedAt',
        label: columnLabels.value.deletedAt,
        visible: false,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 180
    },
    {
        key: 'starMarkAt',
        label: columnLabels.value.starMarkAt,
        visible: false,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 180
    },
    {
        key: 'givenUpAt',
        label: columnLabels.value.givenUpAt,
        visible: false,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 180
    },
    {
        key: 'archivedAt',
        label: columnLabels.value.archivedAt,
        visible: false,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 180
    },
    {
        key: 'createdAt',
        label: columnLabels.value.createdAt,
        visible: true,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 200
    },
    {
        key: 'updatedAt',
        label: columnLabels.value.updatedAt,
        visible: true,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 200
    },
    {
        key: 'startAt',
        label: columnLabels.value.startAt,
        visible: true,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 200
    },
    {
        key: 'endAt',
        label: columnLabels.value.endAt,
        visible: true,
        width: null,
        minWidth: 160,
        maxWidth: 240,
        defaultWidth: 200
    },
    {
        key: 'priority',
        label: columnLabels.value.priority,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 150,
        defaultWidth: 120
    },
    {
        key: 'state',
        label: columnLabels.value.state,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 150,
        defaultWidth: 120
    },
    {
        key: 'project',
        label: columnLabels.value.project,
        visible: true,
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

