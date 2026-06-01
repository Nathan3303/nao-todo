import type { TableColumnConfig } from './types'

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

export { STORAGE_KEY_PREFIX, getStorageKey, readConfig, writeConfig, clearConfig }
export type { SavedTableConfig }
