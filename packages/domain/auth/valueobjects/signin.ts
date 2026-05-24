import { USER_PASSWORD_REGEXP } from '@nao-todo/infrastructure/consts/auth'
import type { Go } from '@nao-todo/types'

/**
 * 登录值对象
 * @description 登录值对象，包含邮箱和密码
 */
export class SignInValueObject {
    /**
     * 加密后的密码
     * @description 加密后的密码 ，用于登录时校验密码是否正确
     */
    private encryptedPassword: string = ''

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
        // 校验邮箱是否为空
        if (this.email === '') return '请输入邮箱'
        // 校验密码是否为空
        if (this.password === '') return '请输入密码'
        // 校验密码格式是否正确
        if (!USER_PASSWORD_REGEXP.test(this.password)) return '密码格式错误'
        return null
    }

    /**
     * 设置加密后的密码
     * @param encryptedPassword 加密后的密码
     */
    setEncryptedPassword(encryptedPassword: string): void {
        this.encryptedPassword = encryptedPassword
    }

    /**
     * 获取加密后的密码
     * @returns 加密后的密码
     */
    getEncryptedPassword(): Go<string> {
        // 校验加密后的密码是否为空
        if (this.encryptedPassword === '') return [null, '请先加密密码']
        // 返回加密后的密码
        return [this.encryptedPassword, null]
    }
}
