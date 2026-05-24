import type { NueDialog } from 'nue-ui'
import type { Ref } from 'vue'

export type DialogWrapperProps = {
    title?: string
    theme?: string
    modelValue: boolean
}

export type DialogWrapperEmits = {
    (e: 'update:modelValue', value: boolean): void
}

export type DialogPayload = Record<string, any>

export type DialogInstanceType = InstanceType<typeof NueDialog>

export type DialogRef = Ref<DialogInstanceType | undefined>
