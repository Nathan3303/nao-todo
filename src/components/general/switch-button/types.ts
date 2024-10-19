import type { IconNameType } from 'nue-ui'

export type SwitchButtonProps = {
    modelValue: boolean
    icon?: IconNameType | string
    activeIcon?: IconNameType | string
    text?: string
    activeText?: string
    theme?: string | string[]
}

export type SwitchButtonEmits = {
    (event: 'update:modelValue', value: boolean): void
    (event: 'change', value: boolean): void
}
