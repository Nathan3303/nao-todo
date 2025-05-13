import type { IconNameType } from "nue-ui"

export type InnerDropdownProps = {
    title?: string
    icon?: IconNameType
    hideOnClicked?: boolean
    suffix?: number | boolean
    disabled?: boolean
    groupName?: string
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
