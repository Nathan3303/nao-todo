import type { Go } from '@nao-todo/shared'

/**
 * 更新 Pomodoro 值对象
 * @description 用于更新已存在 Pomodoro，包含字段验证
 */
export class UpdatePomodoroValueObject {
    public type?: number // Pomodoro 类型
    public name?: string // Pomodoro 名称
    public description?: string // Pomodoro 描述
    public duration?: number // Pomodoro 持续时间

    // 构造函数
    constructor(public readonly id: string) {}

    /**
     * 验证值对象
     */
    validate(): Go<void> {
        if (this.type !== void 0 && this.type <= 0) return 'Pomodoro 类型无效'
        if (this.name !== void 0 && !this.name) return 'Pomodoro 名称不能为空'
        if (this.description !== void 0 && !this.description) return 'Pomodoro 描述不能为空'
        if (this.duration !== void 0 && this.duration <= 0) return 'Pomodoro 持续时间无效'
        return null
    }
}