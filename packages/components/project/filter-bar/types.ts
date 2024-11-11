import type { GetProjectsOptions } from '@nao-todo/types'

export type ProjectFilterBarProps = {
    filterInfo: GetProjectsOptions
}

export type ProjectFilterBarEmits = {
    (event: 'filter', payload: GetProjectsOptions): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type FilterOptions<T> = Array<FilterOption<T>>
