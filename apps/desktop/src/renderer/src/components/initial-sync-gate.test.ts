// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { NueButton, NueDiv, NueEmpty, NueIcon, NueMain, NueText } from 'nue-ui'
import InitialSyncGate from './initial-sync-gate.vue'

/**
 * 初始同步门终态与逃生入口断言（SHELL-03 C-01/C-02/C-06/C-10、F-5、BC-2/BC-4）
 * @description 成败以运行返回值判定；失败恒含「重试」+「离线进入」+「登出/重新登录」；
 *              成功路径保持 loading（不落空渲染帧）；会话失效文案切「重新登录」。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */

const mocks = vi.hoisted(() => ({
    start: vi.fn(),
    /** 本地镜像存在（C-62 条件③探测替身） */
    hasLocalMirror: true,
    jwtUserId: 'u-1' as string | null,
    sessionUserId: 'u-1' as string | null
}))

vi.mock('@nao-todo/infrastructure', () => {
    const mirrorTable = {
        where: () => ({
            equals: () => ({ count: async () => (mocks.hasLocalMirror ? 1 : 0) })
        })
    }
    return {
        syncService: { start: mocks.start },
        localSession: { getCurrentUserId: () => mocks.sessionUserId },
        resolveUserIdFromStoredJwt: () => mocks.jwtUserId,
        localDatabase: { syncCursor: mirrorTable, table: () => mirrorTable },
        BUSINESS_TABLES: ['projects', 'tasks']
    }
})

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/db/local-database',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)

let wrapper: VueWrapper | null = null

const mountGate = (): VueWrapper => {
    wrapper = mount(InitialSyncGate, {
        attachTo: document.body,
        global: {
            plugins: [createPinia()],
            components: {
                'nue-main': NueMain,
                'nue-div': NueDiv,
                'nue-text': NueText,
                'nue-button': NueButton,
                'nue-empty': NueEmpty,
                'nue-icon': NueIcon
            }
        }
    })
    return wrapper
}

const buttonsText = (): string[] =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '')

const clickButton = (label: string): void => {
    const target = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label
    )
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasLocalMirror = true
    mocks.jwtUserId = 'u-1'
    mocks.sessionUserId = 'u-1'
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('InitialSyncGate - SHELL-03 终态与逃生入口', () => {
    it('运行成功 ⇒ emit synced，且保持 loading 不落空帧（F-5）', async () => {
        mocks.start.mockResolvedValue({
            ok: true,
            errors: [],
            lastError: null,
            phase: null
        })
        const gate = mountGate()
        await flushPromises()
        expect(gate.emitted('synced')).toBeTruthy()
        // 成功路径不置 syncing=false：仍渲染 loading 文案（父级随后卸载本门）
        expect(document.body.textContent).toContain('正在同步数据…')
    })

    it('BC-2/BC-4：运行失败 ⇒ 三键逃生（重试/离线进入/登出）+ 可见失败文案', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['拉取失败：网络错误'],
            lastError: '拉取失败：网络错误',
            phase: 'pull'
        })
        mountGate()
        await flushPromises()

        expect(buttonsText()).toContain('重试')
        expect(buttonsText()).toContain('离线进入')
        expect(buttonsText()).toContain('登出用户')
        expect(document.body.textContent).toContain('拉取失败：网络错误')
        expect(
            document.querySelectorAll('button, input, [role="button"]').length
        ).toBeGreaterThanOrEqual(1)
    })

    it('离线进入 ⇒ emit offline（意图交 AppRoot，gate 不含 router）', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['拉取失败：网络错误'],
            lastError: '拉取失败：网络错误',
            phase: 'pull'
        })
        const gate = mountGate()
        await flushPromises()
        clickButton('离线进入')
        await flushPromises()
        expect(gate.emitted('offline')).toBeTruthy()
        expect(gate.emitted('synced')).toBeFalsy()
    })

    it('C-23：凭证类失败 ⇒ 不提供「离线进入」（仅有重试 + 重新登录）', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['登录已过期，请重新登录'],
            lastError: '登录已过期，请重新登录',
            phase: 'pull',
            credentialFailure: true
        })
        mountGate()
        await flushPromises()
        expect(buttonsText()).toContain('重试')
        expect(buttonsText()).toContain('重新登录')
        expect(buttonsText()).not.toContain('离线进入')
    })

    it('网络类失败 ⇒ 「离线进入」可见（可降级进入）', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['推送失败：网络错误'],
            lastError: '推送失败：网络错误',
            phase: 'push'
        })
        mountGate()
        await flushPromises()
        expect(buttonsText()).toContain('离线进入')
    })

    it('重试 ⇒ 再次调用 start（同步仍可重跑）', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['推送失败：重试次数已达上限'],
            lastError: '推送失败：重试次数已达上限',
            phase: 'push'
        })
        mountGate()
        await flushPromises()
        clickButton('重试')
        await flushPromises()
        expect(mocks.start).toHaveBeenCalledTimes(2)
    })

    it('C-06 失败分类：会话失效 ⇒ 主按钮语义切「重新登录」（清认证/清库/跳转由 AppRoot 编排）', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['登录已过期，请重新登录'],
            lastError: '登录已过期，请重新登录',
            phase: 'pull',
            credentialFailure: true
        })
        const gate = mountGate()
        await flushPromises()
        expect(buttonsText()).toContain('重新登录')
        clickButton('重新登录')
        await flushPromises()
        expect(gate.emitted('signOut')).toBeTruthy()
    })

    it('C-26：start() reject ⇒ 进入 failed 终态（不永加载）+ 结构化打点', async () => {
        mocks.start.mockRejectedValue(new Error('boom'))
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mountGate()
        await flushPromises()

        // 不得停在 syncing：loading 文案消失，失败三键出现
        expect(document.body.textContent).not.toContain('正在同步数据…')
        expect(buttonsText()).toContain('重试')
        expect(buttonsText()).toContain('离线进入')
        expect(document.body.textContent).toContain('加载失败')
        // 异常不静默：统一通道固定前缀 + source
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SHELL-05]'),
            expect.objectContaining({ source: 'sync-gate:start' })
        )
    })

    it('C-34：凭证类失败由结构化字段判定（文案无关）', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['任意文案'],
            lastError: '任意文案',
            phase: 'pull',
            credentialFailure: true
        })
        mountGate()
        await flushPromises()
        expect(buttonsText()).toContain('重新登录')
        expect(buttonsText()).not.toContain('离线进入')
    })

    it('C-34：文案含“登录已过期”但结构化字段为 false ⇒ 离线进入仍可见（文案不影响按钮）', async () => {
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['登录已过期，请重新登录'],
            lastError: '登录已过期，请重新登录',
            phase: 'pull',
            credentialFailure: false
        })
        mountGate()
        await flushPromises()
        expect(buttonsText()).toContain('离线进入')
        expect(buttonsText()).toContain('登出用户')
    })

    it('C-62：镜像缺失 ⇒ 点离线进入给出显式文案 + 原因码日志，不 emit', async () => {
        mocks.hasLocalMirror = false
        mocks.start.mockResolvedValue({
            ok: false,
            errors: ['推送失败：网络错误'],
            lastError: '推送失败：网络错误',
            phase: 'push',
            credentialFailure: false
        })
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const gate = mountGate()
        await flushPromises()

        clickButton('离线进入')
        await flushPromises()

        expect(gate.emitted('offline')).toBeFalsy()
        expect(document.body.textContent).toContain('无法离线进入')
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SHELL-05]'),
            expect.objectContaining({ source: 'sync-gate:offline-prerequisites' })
        )
    })
})