import type { TodoCountInfo, TodoFilter } from '@/stores'

export type TodoFilterBarProps = {
    filterInfo: TodoFilter
    countInfo: TodoCountInfo
}

export type TodoFilterBarEmits = {
    (event: 'filter', payload: TodoFilter): void
}
