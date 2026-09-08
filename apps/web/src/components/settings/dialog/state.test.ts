import { describe, expect, it } from 'vite-plus/test'
import {
    bindSettingsDialogHost,
    closeSettingsDialog,
    isSettingsDialogOpen,
    open,
    openSettingsDialog,
    unbindSettingsDialogHost
} from './state'

/** 假 document：按选择器返回预置元素/空 */
const fakeDoc = (present: string[]): { querySelector: (selector: string) => Element | null } => ({
    querySelector: (selector: string) => (present.includes(selector) ? ({} as Element) : null)
})

describe('SHELL-01 settings dialog state', () => {
    it('宿主未在屏时 openSettingsDialog 不置开（防登录页/移动端误置、登录后突现）', () => {
        unbindSettingsDialogHost() // 复位
        expect(open.value).toBe(false)
        openSettingsDialog()
        expect(open.value).toBe(false) // 无宿主 → 静默
    })

    it('宿主在屏后 open/close 生效', () => {
        bindSettingsDialogHost()
        openSettingsDialog()
        expect(open.value).toBe(true)
        closeSettingsDialog()
        expect(open.value).toBe(false)
    })

    it('unbind 复位宿主并兜底关闭', () => {
        bindSettingsDialogHost()
        openSettingsDialog()
        expect(open.value).toBe(true)
        unbindSettingsDialogHost()
        expect(open.value).toBe(false)
        openSettingsDialog()
        expect(open.value).toBe(false) // 已卸载 → 不再可开
    })

    it('isSettingsDialogOpen：NueDialog 根在 DOM 即视为开启（键盘抑制谓词）', () => {
        expect(isSettingsDialogOpen(fakeDoc([]))).toBe(false)
        expect(isSettingsDialogOpen(fakeDoc(['.nue-dialog--settings']))).toBe(true)
    })
})