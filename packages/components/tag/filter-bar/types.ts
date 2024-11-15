import type { GetTagsOptions } from '@nao-todo/types'

export type TagFilterBarProps = {
    filterOptions: GetTagsOptions
}

export type TagFilterBarEmits = {
    (event: 'filter', payload: GetTagsOptions): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type FilterOptions<T> = Array<FilterOption<T>>
