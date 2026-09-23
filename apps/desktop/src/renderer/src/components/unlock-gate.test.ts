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
    readCachedNickname: vi.fn(),
    setCurrentUserId: vi.fn(),
    clearSession: vi.fn(),
    loadUserProfile: vi.fn(),
    isPlaintextMigrationDone: vi.fn(),
    runPlaintextMigration: vi.fn(),
    // C-54/C-52：登出护栏 + 清库（helper 自身行为见 `views/auth/sign-out-wipe.test.ts`）
    confirm: vi.fn(),
    wipeLocalDataOnSignOut: vi.fn()
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return { ...actual, NueConfirm: mocks.confirm }
})

vi.mock('@/views/auth/sign-out-wipe', () => ({
    wipeLocalDataOnSignOut: mocks.wipeLocalDataOnSignOut
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
    initSnowflakeEpoch: vi.fn(),
    readCachedNickname: mocks.readCachedNickname,
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
    isPlaintextMigrationDone: mocks.isPlaintextMigrationDone,
    runPlaintextMigration: mocks.runPlaintextMigration
}))

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/epoch',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/migration/plaintext-migration',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/profile-cache',
    async () => import('@nao-todo/infrastructure')
)

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
    mocks.unlock.mockResolvedValue(undefined)
    mocks.readCachedNickname.mockReturnValue(null)
    mocks.loadUserProfile.mockResolvedValue([null, '拉取失败：网络错误'])
    // 默认：未迁移（保持既有「显示解锁表单」断言成立）
    mocks.isPlaintextMigrationDone.mockResolvedValue(false)
    mocks.runPlaintextMigration.mockResolvedValue({ ran: true, migrated: 0, lockSkipped: false })
    // C-54/C-52：默认确认登出 + 护栏/清库放行
    mocks.confirm.mockResolvedValue([false])
    mocks.wipeLocalDataOnSignOut.mockResolvedValue(true)
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

    it('AC1b：已有密钥包 + 已完成明文迁移 ⇒ 无密码直接进入', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockResolvedValue(true)
        mocks.isPlaintextMigrationDone.mockResolvedValue(true)
        const gate = mountGate()
        await flushPromises()

        expect(gate.emitted('unlocked')).toBeTruthy()
        expect(mocks.unlock).not.toHaveBeenCalled()
    })

    it('AC4：未迁移 ⇒ UI 标「待升级」；点「跳过迁移」仅解锁且不调迁移', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockResolvedValue(true)
        mocks.isPlaintextMigrationDone.mockResolvedValue(false)
        const gate = mountGate()
        await flushPromises()

        // 待升级标注可见
        expect(document.querySelector('.unlock-gate__pending')?.textContent).toContain('待升级')
        expect(buttonsText()).toContain('跳过迁移')

        const input = wrapper!.findComponent(NueInput)
        input.vm.$emit('update:modelValue', 'pw')
        await flushPromises()

        const skip = [...document.querySelectorAll('button')].find(
            (b) => b.textContent?.trim() === '跳过迁移'
        )
        skip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()

        expect(mocks.unlock).toHaveBeenCalledWith('u-1', 'pw')
        expect(mocks.runPlaintextMigration).not.toHaveBeenCalled()
        expect(gate.emitted('unlocked')).toBeTruthy()
    })

    it('AC2（启动门侧）：未迁移 + 输入密码点「解锁」⇒ 先迁移再放行', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockResolvedValue(true)
        mocks.isPlaintextMigrationDone.mockResolvedValue(false)
        const gate = mountGate()
        await flushPromises()

        const input = wrapper!.findComponent(NueInput)
        input.vm.$emit('update:modelValue', 'pw')
        await flushPromises()

        const unlockButton = [...document.querySelectorAll('button')].find(
            (b) => b.textContent?.trim() === '解锁'
        )
        unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()

        expect(mocks.unlock).toHaveBeenCalledWith('u-1', 'pw')
        expect(mocks.runPlaintextMigration).toHaveBeenCalledWith('u-1')
        expect(gate.emitted('unlocked')).toBeTruthy()
    })

    it('C-52：登出用户 ⇒ 脏队列护栏/清库 helper + 清会话（不经过 AppRoot）', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockResolvedValue(true)
        mocks.isPlaintextMigrationDone.mockResolvedValue(false)
        mountGate()
        await flushPromises()

        const signOutButton = [...document.querySelectorAll('button')].find(
            (b) => b.textContent?.trim() === '登出用户'
        )
        signOutButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()

        expect(mocks.wipeLocalDataOnSignOut).toHaveBeenCalledWith('u-1')
        expect(mocks.clearSession).toHaveBeenCalled()
        expect(mocks.lock).toHaveBeenCalled()
    })

    it('C-52：护栏取消 ⇒ 不清库、不清会话、不放行', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasKeyBundle.mockResolvedValue(true)
        mocks.isPlaintextMigrationDone.mockResolvedValue(false)
        mocks.wipeLocalDataOnSignOut.mockResolvedValue(false)
        const gate = mountGate()
        await flushPromises()

        const signOutButton = [...document.querySelectorAll('button')].find(
            (b) => b.textContent?.trim() === '登出用户'
        )
        signOutButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()

        expect(mocks.wipeLocalDataOnSignOut).toHaveBeenCalledWith('u-1')
        expect(mocks.clearSession).not.toHaveBeenCalled()
        expect(gate.emitted('unlocked')).toBeFalsy()
    })
})