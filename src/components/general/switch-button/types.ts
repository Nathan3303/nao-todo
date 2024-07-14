import type { IconNameType } from 'nue-ui'

export type SwitchButtonProps = {
    modelValue: boolean
    icon?: IconNameType
    activeIcon?: IconNameType
    text?: string
    activeText?: string
}

export type SwitchButtonEmits = {
    (event: 'update:modelValue', value: boolean): void
    (event: 'change', value: boolean): void
}
