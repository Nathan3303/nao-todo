export type TaskSelectorOptionValue = string | number

export type TaskSelectorOption = {
    label: string
    value: TaskSelectorOptionValue
    disabled?: boolean
}

export type TaskSelectorProps = {
    value?: TaskSelectorOptionValue
    options?: TaskSelectorOption[]
    placeholder?: string
}

export type TaskSelectorEmits = {
    (event: 'change', value?: TaskSelectorOptionValue): void
}
