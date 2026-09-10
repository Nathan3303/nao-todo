import { ref } from 'vue'

/**
 * SHELL-01 设置对话框 - 单例开关状态
 * @description 打开入口有三：桌面主侧栏齿轮按钮 / 全局命令 app.settings.open（$mod+,）/
 *              组件内 Esc 关闭（NueDialog 原生 → v-model 回落此处）。
 *              hostReady 由 SettingsDialog 挂载/卸载置位：仅当宿主（桌面侧栏区）在屏时才允许打开，
 *              避免登录页/移动端（无桌面宿主）误置开关、后续登录时对话框突现。
 *              移动端抽屉设置入口另议（本任务不动）。
 */

/** 设置对话框是否挂载在屏（SettingsDialog onMounted/onUnmounted 置位） */
const hostReady = ref(false)

/** 对话框可见性（v-model 共享源：组件内关闭会写回 false） */
export const open = ref(false)

/** 打开设置对话框（宿主在屏才生效） */
export const openSettingsDialog = (): void => {
    if (!hostReady.value) return
    open.value = true
}

/** 关闭设置对话框 */
export const closeSettingsDialog = (): void => {
    open.value = false
}

/** 对话框组件挂载时调用（桌面侧栏区在屏） */
export const bindSettingsDialogHost = (): void => {
    hostReady.value = true
}

/** 对话框组件卸载时调用：复位宿主并兜底关闭，防止残留开关 */
export const unbindSettingsDialogHost = (): void => {
    hostReady.value = false
    open.value = false
}

/**
 * 对话框是否开启（键盘抑制谓词用；NueDialog 仅在开启时渲染 .nue-dialog--settings 根）
 * @param doc document 或同构查询对象（测试注入假对象）
 */
export const isSettingsDialogOpen = (doc: {
    querySelector(selector: string): Element | null
}): boolean => !!doc.querySelector('.nue-dialog--settings')