import type { Go } from '@nao-todo/types'

/**
 * 更新用户配置值对象
 * @description 用于更新用户配置，包括外观设置
 */
export class UpdateUserConfigValueObject {
    /**
     * 外观设置值
     */
    public appearance: string | null = null

    /**
     * 更新用户配置值对象构造函数
     */
    constructor() {}

    /**
     * 验证更新用户配置值对象
     * @returns 验证结果
     */
    validate(): Go<void> {
        if (this.appearance === null) return '外观设置值不能为空'
        if (!['system', 'light', 'dark'].includes(this.appearance)) return '外观设置值无效'
        return null
    }
}

