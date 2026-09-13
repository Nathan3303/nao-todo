// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import DeactiveManager from '../index.vue'

/**
 * SHELL-05 N-04：deactive-manager 离线 profile 空值判空
 * @description `profile` 为 undefined（离线）时不得解引用 `profile.deactivedAt` 抛 TypeError。
 */

vi.mock('nue-ui', () => ({ NueConfirm: vi.fn() }))

const mountManager = () =>
    mount(DeactiveManager, {
        props: { dialogManager: { open: vi.fn() } as never },
        global: {
            plugins: [createPinia()],
            stubs: { 'nue-div': true, 'nue-text': true, 'nue-button': true }
        }
    })

describe('deactive-manager - N-04 空值判空', () => {
    it('profile 为 undefined ⇒ 不抛错、不渲染依赖项', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const wrapper = mountManager()

        expect(wrapper.text()).toBe('')
        expect(errorSpy).not.toHaveBeenCalled()

        vi.restoreAllMocks()
    })
})