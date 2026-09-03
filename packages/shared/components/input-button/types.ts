import type { Ref } from 'vue'
import type { NueButtonSize } from 'nue-ui'

export type OnButtonClickPayload = { inputValue: Ref<string> }

export type InputButtonSubmitPayload = { value: string }

export type InputButtonProps = {
    buttonText?: string
    icon?: string
    buttonTheme?: string | string[]
    inputTheme?: string | string[]
    theme?: string | string[]
    size?: NueButtonSize
    submitOnBlur?: boolean
    disabled?: boolean
    placeholder?: string
    onSubmit?: (payload: InputButtonSubmitPayload) => Promise<void>
    onButtonClick?: (event: MouseEvent, payload: OnButtonClickPayload) => void | Promise<void>
}

export type InputButtonEmits = {
    (event: 'submit', payload: InputButtonSubmitPayload): void
}