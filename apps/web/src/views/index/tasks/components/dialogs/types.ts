import type { Component } from 'vue'

export type DialogId = string

export type DialogComponent = Component

export type DialogComponentInfo = [string, DialogComponent]

export type DialogPayload = Record<string, any> & {
    confirmHandler?: (...args: any[]) => Promise<any>
    onDialogOpened?: () => void
    dialogSize?: 'large' | 'normal' | 'small'
    props?: Record<string, any>
}

export type DialogInfo = {
    title: string
    component: DialogComponent
    payload?: DialogPayload
}

export type DialogManagerProps = {
    useClassicButtons?: boolean
}
