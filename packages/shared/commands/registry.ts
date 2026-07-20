import type { Command, KeyEvent } from './types'

/**
 * 命令注册中心
 * @description 管理所有命令的注册、查找和执行
 */
export class CommandRegistry {
    private commands = new Map<string, Command>()

    /**
     * 注册一个命令
     * @param command 命令对象
     */
    register(command: Command): void {
        // if (this.commands.has(command.id)) {
        // console.warn(`[CommandRegistry] 命令 "${command.id}" 已存在，将被覆盖`)
        // }
        this.commands.set(command.id, command)
    }

    /**
     * 取消注册一个命令
     * @param id 命令 ID
     */
    unregister(id: string): void {
        this.commands.delete(id)
    }

    /**
     * 获取指定命令
     * @param id 命令 ID
     */
    get(id: string): Command | undefined {
        return this.commands.get(id)
    }

    /**
     * 获取所有注册的命令
     */
    getAll(): Command[] {
        return Array.from(this.commands.values())
    }

    /**
     * 按分组获取命令
     * @param group 分组名称
     */
    getByGroup(group: string): Command[] {
        return this.getAll().filter((cmd) => cmd.group === group)
    }

    /**
     * 获取指定作用域生效的命令
     * @param scope 作用域名称
     * @description 返回绑定到该作用域或未绑定作用域（全局）的命令
     */
    getByScope(scope: string): Command[] {
        return this.getAll().filter((cmd) => {
            if (!cmd.keyboard) return false
            if (!cmd.keyboard.scope) return true
            return cmd.keyboard.scope === scope
        })
    }

    /**
     * 执行指定命令
     * @param id 命令 ID
     * @param event 按键事件（可选）
     */
    execute(id: string, event?: KeyEvent): void {
        const command = this.commands.get(id)
        if (!command) {
            console.warn(`[CommandRegistry] 命令 "${id}" 未注册`)
            return
        }
        command.handler(event)
    }

    /**
     * 搜索命令
     * @param query 搜索关键词
     * @description 对 id、label、description 进行大小写不敏感的模糊匹配
     */
    search(query: string): Command[] {
        const normalized = query.toLowerCase()
        return this.getAll().filter((cmd) => {
            return (
                cmd.id.toLowerCase().includes(normalized) ||
                cmd.label.toLowerCase().includes(normalized) ||
                (cmd.description != null && cmd.description.toLowerCase().includes(normalized))
            )
        })
    }

    /**
     * 当前注册的命令总数
     */
    get size(): number {
        return this.commands.size
    }
}

