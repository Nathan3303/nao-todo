import { Go } from '@nao-todo/types'

/**
 * 更新用户昵称值对象
 * @description 更新用户昵称值对象，包含新昵称
 */
export class UpdateNicknameValueObject {
    /**
     * 更新用户昵称值对象构造函数
     * @param nickname 新昵称
     */
    constructor(public nickname: string) {}

    /**
     * 验证新昵称是否符合要求
     * @returns 验证结果，符合要求时返回null，不符合要求时返回错误信息
     */
    validate(): Go<void> {
        if (!this.nickname) return '新昵称不能为空'
        if (this.nickname.length > 32) return '新昵称长度不能超过32个字符'
        return null
    }
}
