// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueButton, NueText } from 'nue-ui'
import PlaintextNoticeBanner from '../plaintext-notice-banner.vue'
import { PLAINTEXT_NOTICE_ACK_KEY } from '../plaintext-notice'

/**
 * 明文姿态 · 首次进入一次性告知（ADR §4.5 / D1b / AC17）
 * @description 首启展示、可关闭且不阻塞、已读后不再展示（含登出后不重复：标记为设备级）。
 */

let wrapper: VueWrapper | null = null

const mountBanner = (): VueWrapper => {
    wrapper = mount(PlaintextNoticeBanner, {
        global: { components: { 'nue-text': NueText, 'nue-button': NueButton } }
    })
    return wrapper
}

beforeEach(() => {
    localStorage.clear()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('PlaintextNoticeBanner - ADR §4.5 明文告知', () => {
    it('首次进入（无已读标记）⇒ 渲染明文告知，含风险边界与设置入口指引', () => {
        const text = mountBanner().text()
        expect(text).toContain('明文')
        expect(text).toContain('设置')
    })

    it('点击关闭 ⇒ 写入设备级已读标记且横幅消失（不阻塞使用）', async () => {
        const view = mountBanner()
        await view.get('button').trigger('click')
        expect(localStorage.getItem(PLAINTEXT_NOTICE_ACK_KEY)).toBe('1')
        expect(view.text()).toBe('')
    })

    it('已读 ⇒ 不再渲染（刷新/再次进入不重复）', () => {
        localStorage.setItem(PLAINTEXT_NOTICE_ACK_KEY, '1')
        expect(mountBanner().text()).toBe('')
    })
})