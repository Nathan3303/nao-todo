// @vitest-environment jsdom
import '../../__tests__/setup-fake-indexeddb'
import { webcrypto } from 'node:crypto'
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

/**
 * T589 红基线 —— AC4 恢复出口 B / D（`DEF-91`，ADR D3）
 *
 * 场景（S1）：他设备改密后，本地密钥包仍由**旧密码**包裹 ⇒ 用新密码解锁失败。
 * - **B 旧密码无损解锁**：用户自助输入旧密码 ⇒ 解锁成功 ⇒ 自动按新密码重包
 *   ⇒ **断言新密码也可解**（真 crypto + fake-indexeddb，非 mock 语义）。
 * - **D 重建兜底**：需**二次确认**；取消 ⇒ **零副作用**（不清会话、不锁、不重建、不进入）。
 *
 * 状态：**红**（两处入口未实现：`unlock-gate.vue` 的失败终态只有「重试 / 登出用户」）。
 *
 * 契约面（本文件对 UI 形态的假设，实现可微调、**语义不变**）：失败后出现
 * 「旧密码 / 曾改过密码」自助入口与「重建本地数据」兜底入口；二次确认走 `NueConfirm`。
 */

const USER_ID = '123456789012345678'
const OLD_PASSWORD = 'old-password'
const NEW_PASSWORD = 'new-password'

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    wipeLocalDataOnSignOut: vi.fn(async () => true),
    selfHealLegacyCipherMirror: vi.fn(async () => ({ healed: 0 })),
    pullAll: vi.fn(async () => ({ ok: true, errors: [] })),
    loadUserProfile: vi.fn(async () => [null, '网络错误']),
    initSnowflakeEpoch: vi.fn(async () => undefined)
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return { ...actual, NueConfirm: mocks.confirm }
})

vi.mock('@/views/auth/sign-out-wipe', () => ({
    wipeLocalDataOnSignOut: mocks.wipeLocalDataOnSignOut
}))
vi.mock('@/hooks', () => ({
    useUserUseCase: () => ({ loadUserProfile: mocks.loadUserProfile })
}))
vi.mock('@nao-todo/infrastructure/src/persistence-sync/epoch', () => ({
    initSnowflakeEpoch: mocks.initSnowflakeEpoch
}))
vi.mock('@nao-todo/infrastructure/src/persistence-local/migration/legacy-cipher-self-heal', () => ({
    selfHealLegacyCipherMirror: mocks.selfHealLegacyCipherMirror
}))
vi.mock('@nao-todo/infrastructure/src/persistence-sync/sync-service', () => ({
    syncService: { pullAll: mocks.pullAll }
}))

/** 假 JWT：payload 携带雪花 `Id`（`resolveUserIdFromStoredJwt` 用正则提取原始数字） */
const fakeJwt = (userId: string): string => {
    const payload = Buffer.from(JSON.stringify({ Id: userId })).toString('base64url')
    return `header.${payload}.signature`
}

// crypto.subtle 在 jsdom 环境的可用性不保证 ⇒ 显式用 Node webcrypto 兜底
if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

const { cryptoService } =
    await import('@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service')
const { localDatabase } =
    await import('@nao-todo/infrastructure/src/persistence-local/db/local-database')
const { localSession } =
    await import('@nao-todo/infrastructure/src/persistence-local/session/local-session')
const { default: UnlockGate } = await import('../unlock-gate.vue')

let wrapper: VueWrapper | null = null

const mountGate = async (): Promise<VueWrapper> => {
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
    await flushPromises()
    return wrapper
}

const buttons = (): HTMLButtonElement[] => [...document.querySelectorAll('button')]

const clickByText = async (pattern: RegExp): Promise<boolean> => {
    const button = buttons().find((b) => pattern.test(b.textContent ?? ''))
    if (!button) return false
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    return true
}

/** 填密码：单输入 ⇒ 旧密码（实现内部记住新密码）；双输入 ⇒ 旧密码 + 新密码 */
const fillRecoveryPasswords = async (): Promise<void> => {
    const inputs = wrapper!.findAllComponents(NueInput)
    if (inputs.length === 0) return
    inputs.forEach((input, index) => {
        input.vm.$emit('update:modelValue', index === 0 ? OLD_PASSWORD : NEW_PASSWORD)
    })
    await flushPromises()
}

const failNewPasswordUnlock = async (): Promise<void> => {
    const input = wrapper!.findComponent(NueInput)
    input.vm.$emit('update:modelValue', NEW_PASSWORD)
    await flushPromises()
    await clickByText(/^解锁$/)
}

beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    document.body.innerHTML = ''
    mocks.confirm.mockResolvedValue([false])
    mocks.wipeLocalDataOnSignOut.mockResolvedValue(true)

    await localDatabase.meta.clear()
    await localDatabase.tasks.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    localStorage.setItem('USER_JWT', fakeJwt(USER_ID))
    // 本地密钥包 = 旧密码包裹；用户已在他设备改密 ⇒ 新密码解不开，旧密码可解
    await cryptoService.setup(USER_ID, OLD_PASSWORD)
    cryptoService.lock()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AC4/B：旧密码无损解锁 + 自动重包', () => {
    it('新密码解锁失败 ⇒ 出现「旧密码」自助入口（不是死路）', async () => {
        await mountGate()
        await failNewPasswordUnlock()

        const hasRecoveryEntry =
            buttons().some((b) => /旧密码|曾改过密码|改过密码/.test(b.textContent ?? '')) ||
            /旧密码|曾改过密码|改过密码/.test(document.body.textContent ?? '')
        expect(hasRecoveryEntry, '解锁失败必须给出可自助出口（DEF-91）').toBe(true)
    })

    it('旧密码解锁成功 ⇒ 自动按新密码重包，新密码此后可解', async () => {
        const gate = await mountGate()
        await failNewPasswordUnlock()

        expect(await clickByText(/旧密码|曾改过密码|改过密码/)).toBe(true)
        await fillRecoveryPasswords()
        const advanced = await clickByText(/^(解锁|确认|继续|重试|用旧密码解锁)$/)
        expect(advanced, '旧密码入口需可提交').toBe(true)

        // T590：真 crypto（PBKDF2 600k ≈ 300ms）异步完成，`flushPromises` 只等一个宏任务
        // ⇒ 等够再断言（断言本身零改动；否则等于要求实现在解锁完成前提前放行）
        await vi.waitFor(() => expect(gate.emitted('unlocked')).toBeTruthy(), { timeout: 5000 })

        // 真证据：新密码可解、旧密码不再可解（DEK 已被新密码重包）
        cryptoService.lock()
        await expect(cryptoService.unlock(USER_ID, NEW_PASSWORD)).resolves.toBeUndefined()
        cryptoService.lock()
        await expect(cryptoService.unlock(USER_ID, OLD_PASSWORD)).rejects.toBeTruthy()
    })
})

describe('AC4/D：重建本地库兜底（二次确认 + 取消零副作用）', () => {
    it('失败终态提供「重建」入口，且必须二次确认', async () => {
        await mountGate()
        await failNewPasswordUnlock()

        expect(await clickByText(/重建|重置本地|重新开始/)).toBe(true)
        expect(mocks.confirm, '重建是 C-51 唯一不可逆开关 ⇒ 必须二次确认').toHaveBeenCalledTimes(1)
    })

    it('取消二次确认 ⇒ 零副作用（不清会话/不锁/不重建/不进入）', async () => {
        mocks.confirm.mockResolvedValue([true])
        const gate = await mountGate()
        await failNewPasswordUnlock()

        expect(
            await clickByText(/重建|重置本地|重新开始/),
            '取消断言必须建立在「入口真实存在」之上（防假绿）'
        ).toBe(true)

        expect(mocks.wipeLocalDataOnSignOut).not.toHaveBeenCalled()
        expect(mocks.selfHealLegacyCipherMirror).not.toHaveBeenCalled()
        expect(mocks.pullAll).not.toHaveBeenCalled()
        expect(gate.emitted('unlocked')).toBeFalsy()
        expect(cryptoService.isUnlocked).toBe(false)
        expect(localSession.getCurrentUserId()).toBe(USER_ID)
    })

    it('确认后 ⇒ 走既有自愈/全量重拉并放行进入', async () => {
        mocks.confirm.mockResolvedValue([false])
        const gate = await mountGate()
        await failNewPasswordUnlock()

        await clickByText(/重建|重置本地|重新开始/)

        const rebuilt =
            mocks.selfHealLegacyCipherMirror.mock.calls.length + mocks.pullAll.mock.calls.length
        expect(rebuilt, '重建应复用 C-68 一次性自愈 / 全量重拉').toBeGreaterThan(0)
        expect(gate.emitted('unlocked')).toBeTruthy()
    })
})