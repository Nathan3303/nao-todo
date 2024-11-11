import type { ProjectFilterOptions } from '@/stores'

export type ProjectFilterBarProps = {
    filterInfo: ProjectFilterOptions
}

export type ProjectFilterBarEmits = {
    (event: 'filter', payload: ProjectFilterOptions): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type FilterOptions<T> = Array<FilterOption<T>>
