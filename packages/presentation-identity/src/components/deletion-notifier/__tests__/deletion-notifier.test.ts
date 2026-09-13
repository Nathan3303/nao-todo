// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import DeletionNotifier from '../index.vue'

/**
 * SHELL-05 N-02：deletion-notifier 空值判空
 * @description 普通用户无待注销记录时 `userDeletion` 为空，挂载不得抛未捕获 TypeError。
 */

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))

vi.mock('nue-ui', () => ({
    NueConfirm: mocks.confirm,
    NueIcon: { name: 'NueIcon', render: () => null }
}))

describe('deletion-notifier - N-02 空值判空', () => {
    it('userDeletion 为空 ⇒ 不抛 TypeError、不显示遮罩、不弹确认', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const wrapper = mount(DeletionNotifier, { global: { plugins: [createPinia()] } })
        await flushPromises()

        expect(wrapper.find('.overlay').exists()).toBe(false)
        expect(mocks.confirm).not.toHaveBeenCalled()
        expect(errorSpy).not.toHaveBeenCalled()

        wrapper.unmount()
        vi.restoreAllMocks()
    })
})