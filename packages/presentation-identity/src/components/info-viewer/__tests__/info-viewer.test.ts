// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useUserStore } from '../../../stores'
import UserInfoViewer from '../info.vue'

/**
 * SHELL-05 N-04：info-viewer 离线 profile 空值判空
 * @description `profile.value` 为 undefined/缺字段时，deactivedAt 计算与渲染均不得抛错。
 */

const stubs = { 'nue-div': true, 'nue-text': true }

describe('info-viewer - N-04 空值判空', () => {
    it('profile 为 undefined ⇒ 不抛错、渲染安全（空）', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const wrapper = mount(UserInfoViewer, {
            global: { plugins: [createPinia()], stubs }
        })

        expect(wrapper.text()).toBe('')
        expect(errorSpy).not.toHaveBeenCalled()

        vi.restoreAllMocks()
    })

    it('profile 为空对象（缺 deactivedAt）⇒ 计算属性不抛、渲染安全', () => {
        const pinia = createPinia()
        const store = useUserStore(pinia)
        store.setUserProfile({} as never)

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const wrapper = mount(UserInfoViewer, {
            global: { plugins: [pinia], stubs }
        })

        expect(wrapper.text()).toBe('')
        expect(errorSpy).not.toHaveBeenCalled()

        vi.restoreAllMocks()
    })
})