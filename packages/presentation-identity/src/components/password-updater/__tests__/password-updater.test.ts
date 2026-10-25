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

/**
 * DEF-82 / AC6（T539 红基线）改密表单三个输入必须有**持久可访问名**
 * @description 现状：只有 `placeholder`（一输入即消失，且 `nue-input` 不透传 attrs 到内层 input）
 *              ⇒ 读屏与表单自动填充拿不到标签（PRD `docs/prds/2026-10-25-correctness-batch.md` R4 / AC6）。
 *              断言口径：可访问名 = `aria-label` / `aria-labelledby` 链 / `<label for>`（含包裹式）三选一，
 *              **不把 `placeholder` 计入**（否则不能证明「持久标签」）；三个名字必须非空且互不相同。
 *              ⚠\uFE0F 用**真实**组件挂载（`nue-input` 为真件，非 stub）——组件是否透传/分配属性以实测为准。
 */
const accessibleNameOf = (el: HTMLInputElement): string => {
    const ariaLabel = (el.getAttribute('aria-label') ?? '').trim()
    if (ariaLabel) return ariaLabel

    const labelledBy = (el.getAttribute('aria-labelledby') ?? '').trim()
    if (labelledBy) {
        const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .join(' ')
            .trim()
        if (text) return text
    }

    const labelText = Array.from(el.labels ?? [])
        .map((label) => label.textContent?.trim() ?? '')
        .join(' ')
        .trim()
    return labelText
}

describe('SettingsPasswordForm 可访问名（DEF-82 / AC6）', () => {
    let wrapper: VueWrapper | null = null

    afterEach(() => {
        wrapper?.unmount()
        wrapper = null
        document.body.innerHTML = ''
    })

    const mountRealForm = (): VueWrapper => {
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

    it('三个输入的可访问名非空、互不相同，且不依赖 placeholder', () => {
        const view = mountRealForm()
        const inputs = view.findAll('input').map((input) => input.element as HTMLInputElement)
        expect(inputs).toHaveLength(3)

        const names = inputs.map(accessibleNameOf)
        names.forEach((name, index) => {
            expect(
                name.length,
                `第 ${index + 1} 个输入无可访问名（aria-label / label for）`
            ).toBeGreaterThan(0)
            // 不得与 placeholder 同级：若唯一来源是 placeholder，上面的 helper 会返回空串
            expect(name).not.toBe((inputs[index]!.getAttribute('placeholder') ?? '').trim())
        })
        expect(new Set(names).size, `可访问名需互不相同：${names.join(' / ')}`).toBe(3)
    })
})