import { openSettingsDialog } from '@/components/settings/dialog/state'
import { openCommandPalette, openShortcutsHelp } from '@/components/command-palette/state'
import { registry } from './instance'

/**
 * 注册应用级全局命令
 * @description 集中注册所有与视图无关的系统级快捷键命令
 * 在 useApp() 初始化时调用一次
 * 文案一律走 i18n 键（`i18n.label` / `i18n.description` / `i18n.group`），
 * 由命令面板与快捷键帮助统一解析 —— 两处都只说人话、不显示命令 id。
 */
export function registerAppCommands() {
    registry.register({
        id: 'app.command-palette.open',
        i18n: {
            label: 'commands.command.openPalette',
            description: 'commands.command.openPalette.description',
            group: 'commands.group.system'
        },
        // 命令面板不列自己（快捷键帮助里仍会出现）
        hidden: true,
        icon: 'search',
        keyboard: { keys: '$mod+k', scope: 'global', preventDefault: true },
        handler: openCommandPalette
    })

    registry.register({
        id: 'app.shortcuts.show',
        i18n: {
            label: 'commands.command.showShortcuts',
            description: 'commands.command.showShortcuts.description',
            group: 'commands.group.system'
        },
        icon: 'help',
        keyboard: { keys: '?', scope: 'global', preventDefault: true },
        handler: openShortcutsHelp
    })

    registry.register({
        id: 'app.settings.open',
        i18n: {
            label: 'commands.command.openSettings',
            description: 'commands.command.openSettings.description',
            group: 'commands.group.navigation'
        },
        icon: 'setting',
        keyboard: { keys: '$mod+,', scope: 'global' },
        handler: () => {
            // SHELL-01：设置对话框化——不再路由跳转；宿主（桌面侧栏区）未在屏时静默无操作
            openSettingsDialog()
        }
    })
}