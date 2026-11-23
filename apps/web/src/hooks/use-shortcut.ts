import { registry } from '@/commands/instance'
import type { Command, KeyEvent } from '@nao-todo/shared/commands'
import { onMounted, onUnmounted } from 'vue'

/**
 * 视图级快捷键注册选项
 */
export interface UseShortcutOptions {
    /** 展示文案的 i18n 键（命令面板 / 快捷键帮助用；缺省回落 `label` / id） */
    i18n?: Command['i18n']
    /** 图标标识（命令面板用） */
    icon?: string
    /** 非键盘手势提示（如 `$mod+wheel`，仅供帮助面板展示） */
    gesture?: string
    /** 不在命令面板中列出 */
    hidden?: boolean
    /** 绑定的作用域（默认使用当前最顶层作用域） */
    scope?: string
    /** 是否阻止浏览器默认行为 */
    preventDefault?: boolean
    /** 可用性判定（如弹层开启/交互控件目标时禁用；context.event 供目标守卫） */
    available?: Command['available']
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
 *     i18n: { label: 'commands.command.openSettings' }
 * })
 */
export const useShortcut = (
    id: string,
    keys: string,
    handler: (event?: KeyEvent) => void,
    options?: UseShortcutOptions
) => {
    onMounted(() => {
        const command: Command = {
            id,
            i18n: options?.i18n,
            icon: options?.icon,
            gesture: options?.gesture,
            hidden: options?.hidden,
            handler,
            keyboard: {
                keys,
                scope: options?.scope,
                preventDefault: options?.preventDefault
            },
            available: options?.available
        }
        registry.register(command)
    })

    onUnmounted(() => {
        registry.unregister(id)
    })
}

export default useShortcut