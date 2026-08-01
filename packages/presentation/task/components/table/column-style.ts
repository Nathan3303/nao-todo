import type { TableColumnConfig } from './types'

export const getColumnStyle = (column: TableColumnConfig) => {
    const width = column.width ?? column.defaultWidth
    return {
        width: `${width}px`,
        minWidth: `${column.minWidth}px`,
        maxWidth: `${column.maxWidth}px`
    }
}