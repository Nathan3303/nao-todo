import { onMounted, onUnmounted } from 'vue'
import type { KeyEvent } from '@nao-todo/infrastructure/commands'
import { registry } from '@/infrastructure/commands/instance'
import type { Command } from '@nao-todo/infrastructure/commands'

/**
 * 视图级快捷键注册选项
 */
export interface UseShortcutOptions {
    /** 用户可见的名称，用于命令面板 */
    label?: string
    /** 命令分组 */
    group?: string
    /** 绑定的作用域（默认使用当前最顶层作用域） */
    scope?: string
    /** 是否阻止浏览器默认行为 */
    preventDefault?: boolean
}

/**
 * 视图级快捷键
 * @description 在组件中调用，组件挂载时注册快捷键命令，卸载时自动注销
 * 适合将快捷键定义在对应的业务组件中，与散落在各 view 的 useScope 配合使用
 * @param id 命令唯一标识
 * @param keys 快捷键字符串，如 "n"、"$mod+s"
 * @param handler 执行函数
 * @param options 额外配置
 *
 * @example
 * // TableView.vue 中
 * useShortcut('task.create', 'n', () => openCreator())
 * useShortcut('task.navigate.down', 'j', () => moveSelection(1))
 *
 * @example
 * // 设置页中
 * useShortcut('settings.save', '$mod+s', () => save(), {
 *     preventDefault: true,
 *     group: '设置'
 * })
 */
const useShortcut = (
    id: string,
    keys: string,
    handler: (event?: KeyEvent) => void,
    options?: UseShortcutOptions
) => {
    onMounted(() => {
        const command: Command = {
            id,
            label: options?.label ?? id,
            handler,
            keyboard: {
                keys,
                scope: options?.scope,
                preventDefault: options?.preventDefault
            },
            group: options?.group
        }
        registry.register(command)
    })

    onUnmounted(() => {
        registry.unregister(id)
    })
}

export default useShortcut

