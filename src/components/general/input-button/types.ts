import type { Ref } from 'vue'
import type { ButtonSize, IconNameType } from 'nue-ui'

export type OnButtonClickPayload = {
    inputValue: Ref<string>
}

export type InputButtonSubmitPayload = {
    value: string
}

export type InputButtonProps = {
    buttonText?: string
    icon?: IconNameType
    buttonTheme?: string | string[]
    inputTheme?: string | string[]
    theme?: string | string[]
    size?: ButtonSize
    submitOnBlur?: boolean
    disabled?: boolean
    onSubmit?: (payload: InputButtonSubmitPayload) => Promise<any>
    onButtonClick?: (event: MouseEvent, payload: OnButtonClickPayload) => void | Promise<any>
}

export type InputButtonEmits = {
    (event: 'submit', payload: InputButtonSubmitPayload): void
}
