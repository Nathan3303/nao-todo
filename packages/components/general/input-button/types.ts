import type { Ref } from 'vue'
import type { NueButtonSize, NueIconName } from 'nue-ui'

type OnButtonClickPayload = {
    inputValue: Ref<string>
}

type InputButtonSubmitPayload = {
    value: string
}

type InputButtonProps = {
    buttonText?: string
    icon?: NueIconName
    buttonTheme?: string | string[]
    inputTheme?: string | string[]
    theme?: string | string[]
    size?: NueButtonSize
    submitOnBlur?: boolean
    disabled?: boolean
    onSubmit?: (payload: InputButtonSubmitPayload) => Promise<any>
    onButtonClick?: (event: MouseEvent, payload: OnButtonClickPayload) => void | Promise<any>
}

type InputButtonEmits = {
    (event: 'submit', payload: InputButtonSubmitPayload): void
}

export type { InputButtonProps, InputButtonEmits, InputButtonSubmitPayload }
