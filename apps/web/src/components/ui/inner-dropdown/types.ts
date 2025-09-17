import type { NueIconName } from "nue-ui"

export type InnerDropdownProps = {
    title?: string
    icon?: NueIconName
    hideOnClicked?: boolean
    suffix?: number | boolean
    disabled?: boolean
    group?: string
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
}

export type InnerDropdownOptionVO = {
    icon: string
    label: string
    value: string
    checked?: boolean
}
