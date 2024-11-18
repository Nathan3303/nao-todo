import type { Ref } from 'vue'
import type { ButtonSize, IconNameType } from 'nue-ui'

type OnButtonClickPayload = {
    inputValue: Ref<string>
}

type InputButtonSubmitPayload = {
    value: string
}

type InputButtonProps = {
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

type InputButtonEmits = {
    (event: 'submit', payload: InputButtonSubmitPayload): void
}

export type {
    InputButtonProps,
    InputButtonEmits,
    InputButtonSubmitPayload
}
