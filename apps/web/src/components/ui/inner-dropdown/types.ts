import type { NueIconName } from 'nue-ui'

export type InnerDropdownProps = {
    title?: string
    icon?: NueIconName
    closeWhenExecuted?: boolean
    suffix?: number | boolean
    disabled?: boolean
    group?: string
    transparent?: boolean
}

export type InnerDropdownEmits = {
    (event: 'execute', payload: string): void
}

export type InnerDropdownOptionProps = {
    color?: string
    icon?: string
    title: string
    checked?: boolean
    executeId?: string
    disabled?: boolean
}

export type InnerDropdownOptionVO = {
    icon: string
    label: string
    value: string
    checked?: boolean
}
