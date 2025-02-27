import type { Component } from 'vue'

export type DialogId = string

export type DialogComponent = Component

export type DialogComponentInfo = [string, DialogComponent]

export type DialogPayload = Record<string, any> & {
    confirmHandler?: () => Promise<any>
    onDialogOpened?: () => void
}

export type DialogInfo = {
    title: string
    component: DialogComponent
    payload?: DialogPayload
}

export type DialogManagerProps = {
    useClassicButtons?: boolean
}
