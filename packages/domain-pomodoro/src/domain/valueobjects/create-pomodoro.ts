import type { Go } from '@nao-todo/shared'

/**
 * 创建 Pomodoro 值对象
 * @description 用于创建新 Pomodoro，包含字段验证
 */
export class CreatePomodoroValueObject {
    /**
     * 构造函数
     */
    constructor(
        public type: number, // Pomodoro 类型
        public name: string, // Pomodoro 名称
        public description: string, // Pomodoro 描述
        public duration: number // Pomodoro 持续时间
    ) {}

    /**
     * 验证值对象
     */
    validate(): Go<void> {
        // 验证字段是否为空
        if (this.type <= 0) return 'Pomodoro 类型无效'
        if (!this.name) return 'Pomodoro 名称不能为空'
        if (!this.description) return 'Pomodoro 描述不能为空'
        if (this.duration <= 0) return 'Pomodoro 持续时间无效'
        return null
    }
}