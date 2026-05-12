import type { Go } from '@nao-todo/types'

export class UpdateUserConfigValueObject {
    constructor(public appearance: string) {}

    validate(): Go<void> {
        if (!['auto', 'light', 'dark'].includes(this.appearance)) {
            return '外观设置值无效'
        }
        return null
    }
}
