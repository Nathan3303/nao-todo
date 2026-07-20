import type { Go } from '@nao-todo/shared'

/**
 * Pomodoro 列表查询选项
 */
export class ListPomodoroValueObject {
    public type?: number // Pomodoro 类型
    public name?: string // Pomodoro 名称
    public isArchived?: string | null // 是否已归档

    /**
     * 构造函数
     */
    constructor() {}

    /**
     * 验证查询选项
     */
    validate(): Go<void> {
        return null
    }

    /**
     * 转换为对象
     */
    makeQueryOptions(): Record<string, any> {
        const queryOptions: Record<string, any> = {}
        if (this.type !== void 0) queryOptions.type = this.type
        if (this.name !== void 0) queryOptions.name = this.name
        if (this.isArchived !== void 0) queryOptions.isArchived = this.isArchived
        return queryOptions
    }
}

