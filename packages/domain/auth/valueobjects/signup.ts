import { USER_PASSWORD_REGEXP } from '@nao-todo/infrastructure/consts/auth'
import type { Go } from '@nao-todo/types'

/**
 * 注册值对象
 * @description 注册值对象，包含邮箱、密码、确认密码和昵称
 */
export class SignUpValueObject {
    /**
     * 加密后的密码
     * @description 加密后的密码 ，用于登录时校验密码是否正确
     */
    private encryptedPassword: string = ''

    /**
     * 注册值对象构造函数
     * @param email 邮箱
     * @param password 密码
     * @param confirmPassword 确认密码
     * @param nickname 昵称
     */
    constructor(
        public email: string,
        public password: string,
        public confirmPassword: string,
        public nickname: string
    ) {}

    /**
     * 注册值对象数据校验
     * @description 注册值对象数据校验，校验邮箱、密码、确认密码和昵称是否为空
     * @returns 错误信息
     */
    validate(): Go<void> {
        if (this.email === '') return '请输入邮箱'
        if (this.password === '') return '请输入密码'
        if (this.confirmPassword === '') return '请确认密码'
        if (this.password !== this.confirmPassword) return '两次密码不一致'
        if (this.password.length < 8 || this.password.length > 24) {
            return '密码格式有误，需要 8 至 24 位的长度'
        }
        if (
            !USER_PASSWORD_REGEXP.test(this.password) ||
            !USER_PASSWORD_REGEXP.test(this.confirmPassword)
        ) {
            return '密码格式错误'
        }
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
