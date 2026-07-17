import type { ScopeState } from './types'

/**
 * 作用域管理器
 * @description 管理作用域的入栈出栈，用于确定快捷键在当前上下文中的优先级
 */
export class ScopeManager {
    private stack: ScopeState[] = []

    /**
     * 进入一个作用域（入栈）
     * @param name 作用域名称
     * @description 如果该作用域已在栈中，将其移至栈顶
     */
    enter(name: string): void {
        const existingIndex = this.stack.findIndex((s) => s.name === name)
        if (existingIndex !== -1) {
            this.stack.splice(existingIndex, 1)
        }
        this.stack.push({ name })
    }

    /**
     * 离开一个作用域（出栈）
     * @param name 作用域名称
     */
    leave(name: string): void {
        const index = this.stack.findIndex((s) => s.name === name)
        if (index === -1) {
            console.warn(`[ScopeManager] 作用域 "${name}" 不在栈中，忽略`)
            return
        }
        this.stack.splice(index, 1)
    }

    /**
     * 获取当前活跃作用域列表（从栈底到栈顶）
     * @description 栈顶作用域优先级最高
     */
    get activeScopes(): string[] {
        return this.stack.map((s) => s.name)
    }

    /**
     * 获取栈顶作用域（最高优先级）
     */
    get top(): string | undefined {
        const last = this.stack.at(-1)
        return last?.name
    }

    /**
     * 判断某作用域是否在栈中
     * @param name 作用域名称
     */
    isActive(name: string): boolean {
        return this.stack.some((s) => s.name === name)
    }

    /**
     * 获取当前栈深度
     */
    get depth(): number {
        return this.stack.length
    }

    /**
     * 清空作用域栈
     */
    clear(): void {
        this.stack = []
    }
}
