import { ref } from 'vue'

/**
 * 命令面板 / 快捷键帮助的开关（应用级单例）
 * @description 入口：全局命令（`$mod+k` / `?`，见 `apps/web/src/commands/app.commands.ts`）、
 *              面板内的「快捷键帮助」条目、以及 `NueDialog` 原生 Esc / 关闭按钮（v-model 回落此处）。
 *              两者**互斥**：打开其一自动收起另一个（避免两层对话框叠在一起）。
 */

/** 命令面板可见性（`v-model` 共享源：对话框内关闭会写回 false） */
export const commandPaletteOpen = ref(false)

/** 快捷键帮助可见性（同上） */
export const shortcutsHelpOpen = ref(false)

/** 打开命令面板 */
export const openCommandPalette = (): void => {
    shortcutsHelpOpen.value = false
    commandPaletteOpen.value = true
}

/** 关闭命令面板 */
export const closeCommandPalette = (): void => {
    commandPaletteOpen.value = false
}

/** 打开快捷键帮助 */
export const openShortcutsHelp = (): void => {
    commandPaletteOpen.value = false
    shortcutsHelpOpen.value = true
}

/** 关闭快捷键帮助 */
export const closeShortcutsHelp = (): void => {
    shortcutsHelpOpen.value = false
}