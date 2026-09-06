import type { Go } from '@nao-todo/shared/types'
import { USER_PASSWORD_REGEXP } from '../constants'

/**
 * 登录值对象
 * @description 登录值对象，包含邮箱和密码
 */
export class SignInValueObject {
    /**
     * 登录值对象构造函数
     * @param email 邮箱
     * @param password 密码
     */
    constructor(
        public email: string,
        public password: string
    ) {}

    /**
     * 登录值对象数据校验
     * @description 登录值对象数据校验，校验邮箱和密码是否为空
     * @returns 错误信息
     */
    validate(): Go<void> {
        if (this.email === '') return '请输入邮箱'
        if (this.password === '') return '请输入密码'
        if (!USER_PASSWORD_REGEXP.test(this.password)) return '密码格式错误'
        return null
    }
}