// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueDiv, NueText } from 'nue-ui'
import SettingsLocalDataNotice from '../index.vue'

/**
 * 设置页明文声明（ADR §4.5 / RS-1 / RS-3 / RS-4 / AC17）
 * @description AC17 可核验：声明存在且覆盖明文/设备/边界/驱逐/端差异，且**不得**出现「加密」字样。
 */

let wrapper: VueWrapper | null = null

const mountNotice = (): VueWrapper => {
    wrapper = mount(SettingsLocalDataNotice, {
        global: { components: { 'nue-div': NueDiv, 'nue-text': NueText } }
    })
    return wrapper
}

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('SettingsLocalDataNotice - AC17 设置页明文声明', () => {
    it('渲染完整声明：标题 + 明文/设备即凭据/访问边界/浏览器清除/两端差异', () => {
        const text = mountNotice().text()
        expect(text).toContain('本地数据与安全')
        expect(text).toContain('明文保存')
        expect(text).toContain('设备即凭据')
        expect(text).toContain('访问边界')
        expect(text).toContain('浏览器可能清除')
        expect(text).toContain('两端差异')
    })

    it('不使用「加密」字样，避免虚假安全感', () => {
        const text = mountNotice().text()
        expect(text).not.toContain('加密')
        expect(text).not.toContain('已加密')
        expect(text).not.toContain('受保护')
    })
})