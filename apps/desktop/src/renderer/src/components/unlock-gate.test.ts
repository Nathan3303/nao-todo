// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import {
    NueAvatar,
    NueButton,
    NueContainer,
    NueContent,
    NueDiv,
    NueFooter,
    NueHeader,
    NueIcon,
    NueInput,
    NueMain,
    NueText
} from 'nue-ui'
import UnlockGate from './unlock-gate.vue'

/**
 * 解锁门终态与离线身份断言（SHELL-03 C-01…C-04/C-18/C-20、BC-2/BC-4/BC-7）
 * @description 就绪只看本地判据；profile 失败 ⇒ 离线占位（缓存首字母 + 「离线」小字 / 图标回落）
 *              且零 console；本地失败 ⇒ error 终态含「重试」+「登出」。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */

const mocks = vi.hoisted(() => ({
    resolveUserIdFromStoredJwt: vi.fn(),
    hasKeyBundle: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    checkAndCleanExpired: vi.fn(),
    readCachedNickname: vi.fn(),
    setCurrentUserId: vi.fn(),
    clearSession: vi.fn(),
    loadUserProfile: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => ({
    cryptoService: {
        hasKeyBundle: mocks.hasKeyBundle,
        unlock: mocks.unlock,
        lock: mocks.lock
    },
    localSession: {
        setCurrentUserId: mocks.setCurrentUserId,
        clear: mocks.clearSession
    },
    deletionService: { checkAndCleanExpired: mocks.checkAndCleanExpired },
    initSnowflakeEpoch: vi.fn(),
    readCachedNickname: mocks.readCachedNickname,
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt
}))

vi.mock('@/hooks', () => ({
    useUserUseCase: () => ({ loadUserProfile: mocks.loadUserProfile })
}))

let wrapper: VueWrapper | null = null

const mountGate = (): VueWrapper => {
    wrapper = mount(UnlockGate, {
        attachTo: document.body,
        global: {
            plugins: [createPinia()],
            components: {
                'nue-container': NueContainer,
                'nue-header': NueHeader,
                'nue-main': NueMain,
                'nue-content': NueContent,
                'nue-footer': NueFooter,
                'nue-div': NueDiv,
                'nue-text': NueText,
                'nue-icon': NueIcon,
                'nue-input': NueInput,
                'nue-button': NueButton,
                'nue-avatar': NueAvatar
            }
        }
    })
    return wrapper
}

const buttonsText = (): string[] =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '')

const interactiveCount = (): number =>
    document.querySelectorAll('button, input, [role="button"]').length

beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.hasKeyBundle.mockResolvedValue(true)
    mocks.checkAndCleanExpired.mockResolvedValue(false)
    mocks.unlock.mockResolvedValue(undefined)
    mocks.readCachedNickname.mockReturnValue(null)
    mocks.loadUserProfile.mockResolvedValue([null, '拉取失败：网络错误'])
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('UnlockGate - SHELL-03 终态与离线身份', () => {
    it('无 JWT：直接放行（回登录页），不阻塞', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        const gate = mountGate()
        await flushPromises()
        expect(gate.emitted('unlocked')).toBeTruthy()
        expect(mocks.hasKeyBundle).not.toHaveBeenCalled()
    })

    it('有 JWT 但无密钥包：首次使用，直接放行', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockResolvedValue(false)
        const gate = mountGate()
        await flushPromises()
        expect(gate.emitted('unlocked')).toBeTruthy()
    })

    it('BC-7①：profile 失败 + 命中缓存 ⇒ 缓存昵称首字母 + 「离线」小字 + 解锁/登出恒在，零 console', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.readCachedNickname.mockReturnValue('张三')
        mountGate()
        await flushPromises()

        // 离线身份：首字母 + 可见「离线」小字 + aria/title 语义
        expect(document.querySelector('.initial-avatar__text')?.textContent).toBe('张')
        expect(document.querySelector('.unlock-gate__offline')?.textContent?.trim()).toBe('离线')
        expect(document.querySelector('.initial-avatar')?.getAttribute('aria-label')).toBe(
            '张三（离线）'
        )
        expect(document.querySelector('.initial-avatar')?.getAttribute('title')).toBe(
            '张三（离线）'
        )
        // 解锁界面完整（BC-2：≥1 可交互元素；BC-4：解锁 + 登出）
        expect(interactiveCount()).toBeGreaterThanOrEqual(1)
        expect(buttonsText()).toContain('解锁')
        expect(buttonsText()).toContain('登出用户')
        expect(consoleError).not.toHaveBeenCalled()
        expect(consoleWarn).not.toHaveBeenCalled()
    })

    it('BC-7②：profile 失败 + 无缓存 ⇒ 回落 icon="user"（不空白、零 console）', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.readCachedNickname.mockReturnValue(null)
        mountGate()
        await flushPromises()

        expect(document.querySelector('.initial-avatar__text')).toBeNull()
        expect(document.querySelector('.nue-avatar__icon')).not.toBeNull()
        expect(interactiveCount()).toBeGreaterThanOrEqual(1)
        expect(consoleError).not.toHaveBeenCalled()
        expect(consoleWarn).not.toHaveBeenCalled()
    })

    it('BC-2/BC-4：本地检查失败 ⇒ error 终态含「重试」+「登出」，不落空', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockRejectedValue(new Error('IndexedDB 不可用'))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mountGate()
        await flushPromises()

        expect(buttonsText()).toContain('重试')
        expect(buttonsText()).toContain('登出用户')
        expect(interactiveCount()).toBeGreaterThanOrEqual(1)
        // 不出现解锁表单（错误终态无密码输入）
        expect(document.querySelector('input[type="password"]')).toBeNull()
    })

    it('本地失败后可重试：重试回到 ready（解锁表单出现）', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockRejectedValueOnce(new Error('boom'))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mountGate()
        await flushPromises()
        expect(document.querySelector('input[type="password"]')).toBeNull()

        mocks.hasKeyBundle.mockResolvedValue(true)
        const retry = [...document.querySelectorAll('button')].find(
            (b) => b.textContent?.trim() === '重试'
        )
        retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()
        expect(document.querySelector('input[type="password"]')).not.toBeNull()
    })
})