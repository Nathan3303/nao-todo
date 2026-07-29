import type { TableColumnConfig, TableLayoutConfig } from './types'
import { columnLabels } from '@nao-todo/domain-task'

// @const 内置分类对应的固定列（固定列始终显示在 name 列之后）
const PINNED_COLUMN_MAP: Record<string, string> = {
    deleted: 'deletedAt',
    overdue: 'endAt',
    favourite: 'starMarkAt',
    givenup: 'givenUpAt'
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
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'starMarkAt',
        label: columnLabels.value.starMarkAt,
        visible: false,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'givenUpAt',
        label: columnLabels.value.givenUpAt,
        visible: false,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'archivedAt',
        label: columnLabels.value.archivedAt,
        visible: false,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'createdAt',
        label: columnLabels.value.createdAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'updatedAt',
        label: columnLabels.value.updatedAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'startAt',
        label: columnLabels.value.startAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'endAt',
        label: columnLabels.value.endAt,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    },
    {
        key: 'priority',
        label: columnLabels.value.priority,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 120,
        defaultWidth: 110
    },
    {
        key: 'state',
        label: columnLabels.value.state,
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 120,
        defaultWidth: 110
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

export { PINNED_COLUMN_MAP, enforcePinnedColumn }
