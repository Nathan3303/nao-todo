// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueButton, NueContainer, NueContent, NueDiv, NueInput, NueMain, NueText } from 'nue-ui'
import SettingsPasswordForm from '../password-updater.vue'
import type { UserPasswordUpdaterProps } from '../types'

/**
 * 修改密码表单自动填充语义隔离（SHELL-01-DEF-01 回归防护）
 * @description 设置对话框切至「修改密码」时挂载 3 个 password 输入，浏览器凭据自动填充
 *              触发后曾把已保存邮箱写入页面上无 autocomplete 的文本输入（任务名筛选框）
 *              → name=<邮箱> 空返回致背景任务列表置空。修复 = 按改密语义标注：旧密码
 *              current-password、新密码/确认 new-password（浏览器不再视其为登录表单）。
 */
describe('SettingsPasswordForm autocomplete 语义', () => {
    let wrapper: VueWrapper | null = null

    afterEach(() => {
        wrapper?.unmount()
        wrapper = null
        document.body.innerHTML = ''
    })

    const mountForm = (): VueWrapper => {
        wrapper = mount(SettingsPasswordForm, {
            attachTo: document.body,
            props: {
                userUseCase: { updatePassword: async () => null }
            } as unknown as UserPasswordUpdaterProps,
            global: {
                components: {
                    'nue-container': NueContainer,
                    'nue-main': NueMain,
                    'nue-content': NueContent,
                    'nue-div': NueDiv,
                    'nue-text': NueText,
                    'nue-input': NueInput,
                    'nue-button': NueButton
                },
                stubs: {
                    'password-rule-hint': true,
                    'rule-hint': true
                }
            }
        })
        return wrapper
    }

    it('三个密码输入挂载后按改密语义标注 autocomplete（旧=current，新/确认=new）', () => {
        mountForm()
        const inputs = wrapper!.findAll('input')
        expect(inputs).toHaveLength(3)
        const autos = inputs.map((i) => i.attributes('autocomplete'))
        expect(autos).toEqual(['current-password', 'new-password', 'new-password'])
    })

    it('type="password" 可正常输入（组件功能未被破坏）', async () => {
        const wrapper = mountForm()
        const inputs = wrapper.findAll('input[type="password"]')
        expect(inputs).toHaveLength(3)
        const second = inputs.at(1)
        await second!.setValue('NaoTodo123!')
        expect((second!.element as HTMLInputElement).value).toBe('NaoTodo123!')
    })
})