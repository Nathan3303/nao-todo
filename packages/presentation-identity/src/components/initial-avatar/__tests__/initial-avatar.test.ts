// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { NueAvatar } from 'nue-ui'
import { UserInitialAvatar } from '../index'

/**
 * 离线身份头像断言（SHELL-03 C-16/C-18/C-20 / BC-7）
 * @description 首字母规则（中文取首字 / 拉丁大写 / 首码点）、色块确定性（主题令牌）、
 *              无昵称或非字母数字 ⇒ 不提供 default slot ⇒ 库内 icon="user" 回落；
 *              label ⇒ title + aria-label + role="img"。
 */

const mountAvatar = (props: Record<string, unknown> = {}) =>
    mount(UserInitialAvatar, {
        props: { nickname: '张三', ...props },
        global: { components: { 'nue-avatar': NueAvatar } }
    })

const initialText = (wrapper: ReturnType<typeof mountAvatar>): string | null =>
    wrapper.find('.initial-avatar__text').exists()
        ? wrapper.find('.initial-avatar__text').text()
        : null

describe('UserInitialAvatar 离线身份头像（BC-7）', () => {
    it('中文昵称取首字；拉丁取首字母大写', () => {
        expect(initialText(mountAvatar({ nickname: '张三' }))).toBe('张')
        expect(initialText(mountAvatar({ nickname: 'alice' }))).toBe('A')
        expect(initialText(mountAvatar({ nickname: '  bob  ' }))).toBe('B')
    })

    it('代理对（超出 BMP）取完整首码点，不截断半个字符', () => {
        expect(initialText(mountAvatar({ nickname: '𝕏avier' }))).toBe('𝕏')
    })

    it('emoji / 空白 / 符号 ⇒ 不提供 default slot，回落库内 icon="user"（C-16 末条）', () => {
        for (const nickname of ['😀abc', '   ', '@user', '###']) {
            const wrapper = mountAvatar({ nickname })
            expect(wrapper.find('.initial-avatar__text').exists()).toBe(false)
            expect(wrapper.find('.nue-avatar__icon').exists()).toBe(true)
        }
    })

    it('无昵称 ⇒ 直接回落 icon="user"（不空白、不报错）', () => {
        const wrapper = mountAvatar({ nickname: '' })
        expect(wrapper.find('.initial-avatar__text').exists()).toBe(false)
        expect(wrapper.find('.nue-avatar__icon').exists()).toBe(true)
    })

    it('色块为确定性主题令牌（同昵称恒定同色，取值在令牌集合内）', () => {
        const styleOf = (nickname: string): string => {
            const wrapper = mountAvatar({ nickname })
            return wrapper.find('.initial-avatar').attributes('style') ?? ''
        }
        const first = styleOf('张三')
        const second = styleOf('张三')
        expect(first).toBe(second)
        expect(first).toMatch(/--nue-primary-color-(400|500|600)/)
        // 不硬编码色值：style 中不得出现 rgb/hsl/#
        expect(first).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|hsl\(/i)
    })

    it('src 可加载时渲染 img（alt = 昵称），离线 onerror 后落首字母', async () => {
        const wrapper = mountAvatar({ nickname: '张三', src: 'https://example.com/a.png' })
        expect(wrapper.find('img').attributes('alt')).toBe('张三')
        expect(wrapper.find('.initial-avatar__text').exists()).toBe(false)
        // 图片加载失败（离线必然）→ NueAvatar 落 default slot
        await wrapper.find('img').trigger('error')
        expect(wrapper.find('.initial-avatar__text').text()).toBe('张')
    })

    it('label ⇒ title + aria-label + role="img"；无 label 则不声明（避免误声明）', () => {
        const labeled = mountAvatar({ nickname: '张三', label: '张三（离线）' })
        const root = labeled.find('.initial-avatar')
        expect(root.attributes('title')).toBe('张三（离线）')
        expect(root.attributes('aria-label')).toBe('张三（离线）')
        expect(root.attributes('role')).toBe('img')

        const plain = mountAvatar({ nickname: '张三' })
        expect(plain.find('.initial-avatar').attributes('aria-label')).toBeUndefined()
        expect(plain.find('.initial-avatar').attributes('role')).toBeUndefined()
    })
})