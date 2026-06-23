import { registry } from './instance'

/**
 * 注册应用级全局命令
 * @description 集中注册所有与视图无关的系统级快捷键命令
 * 在 useApp() 初始化时调用一次
 */
export function registerAppCommands() {
    registry.register({
        id: 'app.command-palette.open',
        label: '打开命令面板',
        description: '搜索并执行所有可用命令',
        group: '系统',
        icon: 'ntd-search',
        keyboard: { keys: '$mod+k', scope: 'global', preventDefault: true },
        handler: () => {
            console.info('[Command] 打开命令面板 — 待实现')
        }
    })

    registry.register({
        id: 'app.shortcuts.show',
        label: '显示快捷键帮助',
        description: '查看当前可用的所有快捷键',
        group: '系统',
        icon: 'ntd-help',
        keyboard: { keys: '?', scope: 'global', preventDefault: true },
        handler: () => {
            console.info('[Command] 显示快捷键帮助 — 待实现')
        }
    })

    registry.register({
        id: 'app.modal.close',
        label: '关闭当前弹窗',
        description: '关闭最上层的弹窗或面板',
        group: '系统',
        icon: 'ntd-close',
        keyboard: { keys: 'Escape', scope: 'modal', preventDefault: true },
        handler: () => {
            console.info('[Command] 关闭弹窗 — 待对接弹窗管理器')
        }
    })

    registry.register({
        id: 'app.settings.open',
        label: '打开设置',
        description: '跳转到设置页面',
        group: '导航',
        icon: 'ntd-settings',
        keyboard: { keys: '$mod+,', scope: 'global' },
        handler: () => {
            console.info('[Command] 打开设置 — 待对接路由')
        }
    })
}
