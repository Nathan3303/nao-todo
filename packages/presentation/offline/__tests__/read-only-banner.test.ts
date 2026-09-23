// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { NueText } from 'nue-ui'
import OfflineReadOnlyBanner from '../read-only-banner.vue'
import { resetReadOnlyForTest, setOffline, setOfflineEntryActive } from '../read-only-state'

/**
 * 离线只读可见提示（C-59 / AC10）
 * @description 离线或会话级离线进入 ⇒ 常驻只读提示；在线且无 flag ⇒ 不渲染。
 */

const mountBanner = () =>
    mount(OfflineReadOnlyBanner, { global: { components: { 'nue-text': NueText } } })

beforeEach(() => {
    resetReadOnlyForTest()
})

describe('OfflineReadOnlyBanner - C-59/AC10 可见提示', () => {
    it('网络离线 ⇒ 渲染只读提示', () => {
        setOffline(true)
        expect(mountBanner().text()).toContain('只读')
    })

    it('会话级离线进入 ⇒ 渲染只读提示', () => {
        setOfflineEntryActive(true)
        expect(mountBanner().text()).toContain('只读')
    })

    it('在线且无离线进入 ⇒ 不渲染', () => {
        expect(mountBanner().text()).toBe('')
    })
})