import { CommandRegistry, ScopeManager } from '@nao-todo/shared'

/**
 * 全局命令注册中心实例
 * @description 整个应用共享同一个命令注册中心实例，各层代码都从此导入
 */
export const registry = new CommandRegistry()

/**
 * 全局作用域管理器实例
 * @description 管理作用域栈，与 registry 配合决定快捷键的当前上下文优先级
 */
export const scopeManager = new ScopeManager()
