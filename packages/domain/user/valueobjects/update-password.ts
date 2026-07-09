import { USER_PASSWORD_REGEXP } from '../../shares/consts/auth'
import type { Go } from '@nao-todo/types'

/**
 * 更新用户密码值对象
 * @description 更新用户密码值对象，包含旧密码和新密码
 */
export class UpdateUserPasswordValueObject {
    /**
     * 加密后的密码
     * @description 加密后的密码 ，用于登录时校验密码是否正确
     */
    private encryptedPassword: string = ''

    /**
     * 更新用户密码值对象构造函数
     * @param oldPassword 旧密码
     * @param newPassword 新密码
     */
    constructor(
        public oldPassword: string,
        public newPassword: string
    ) {}

    /**
     * 更新用户密码值对象数据校验
     * @description 更新用户密码值对象数据校验，校验旧密码和新密码是否为空
     * @returns 错误信息
     */
    validate(): Go<void> {
        // 校验旧密码是否为空
        if (this.oldPassword === '') return '请输入旧密码'
        // 校验新密码是否为空
        if (this.newPassword === '') return '请输入新密码'
        // 校验新密码格式是否正确
        if (!USER_PASSWORD_REGEXP.test(this.newPassword)) return '新密码格式错误'
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

