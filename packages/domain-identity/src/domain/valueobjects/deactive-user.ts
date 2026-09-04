import type { Go } from '@nao-todo/shared/types'
import { USER_PASSWORD_REGEXP } from '../constants'

export class DeactiveUserValueObject {
    constructor(public password: string) {}

    validate(): Go<void> {
        if (this.password === '') return '请输入密码'
        if (!USER_PASSWORD_REGEXP.test(this.password)) return '密码格式错误'
        return null
    }
}