import type { Columns } from '../table'

export type ListColumnSwitcherProps = {
    modelValue: Columns
}

export type ListColumnSwitcherEmits = {
    (event: 'update:modelValue', value: Columns): void
}
