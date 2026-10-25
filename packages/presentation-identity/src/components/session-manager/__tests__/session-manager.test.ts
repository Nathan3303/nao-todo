// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { NueButton, NueEmpty, NueIcon } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import type { UserSessionValueObject, UserUseCase } from '@nao-todo/domain-identity'
import SessionManager from '../session-manager.vue'

/**
 * T535 · R3 登录设备三段式列表（真组件挂载）
 * @description 覆盖：当前设备**置顶**（位置通道）· `data-session-id` / `data-session-current` 钩子 ·
 *              三段式信息（主行设备名 / 次行地区+IP / 第三行最近活跃+登录时间）· 「下线」只在非当前设备 ·
 *              时间 `title` 为完整时间戳 · 三态走 `LoadingError`（加载 / 空）。
 *              相对时间分档的阈值另见 `relative-time.test.ts`（纯函数）。
 */

const mocks = vi.hoisted(() => ({
    loadSessions: vi.fn(),
    signOutSession: vi.fn(),
    signOutOtherSessions: vi.fn()
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return {
        ...actual,
        NueConfirm: vi.fn(async () => [true]),
        NueMessage: { error: vi.fn(), success: vi.fn() }
    }
})

/** 会话夹具：`minutesAgo` 越大越旧 */
const session = (
    id: string,
    overrides: Partial<Record<'deviceType' | 'region' | 'ip4', string>> & {
        current?: boolean
        minutesAgo?: number
        createdDaysAgo?: number
    } = {}
): UserSessionValueObject => {
    const now = Date.now()
    const minutesAgo = overrides.minutesAgo ?? 5
    const createdDaysAgo = overrides.createdDaysAgo ?? 30
    return {
        id,
        current: overrides.current ?? false,
        deviceType: overrides.deviceType ?? 'Chrome',
        region: overrides.region ?? '上海',
        ip4: overrides.ip4 ?? '10.0.0.1',
        createdAt: new Date(now - createdDaysAgo * 86_400_000).toISOString(),
        updatedAt: new Date(now - minutesAgo * 60_000).toISOString()
    } as unknown as UserSessionValueObject
}

let wrapper: VueWrapper | null = null

const mountManager = async (list: UserSessionValueObject[]): Promise<VueWrapper> => {
    mocks.loadSessions.mockResolvedValue([list, null])
    wrapper = mount(SessionManager, {
        props: {
            userUseCase: {
                loadSessions: mocks.loadSessions,
                signOutSession: mocks.signOutSession,
                signOutOtherSessions: mocks.signOutOtherSessions
            } as unknown as UserUseCase
        },
        global: {
            plugins: [createPinia()],
            components: { 'nue-button': NueButton, 'nue-icon': NueIcon, 'nue-empty': NueEmpty }
        }
    })
    await flushPromises()
    return wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('R3 三段式列表 · 置顶与钩子', () => {
    it('P：当前设备置顶（即使更旧），其余按最近活跃倒序', async () => {
        const view = await mountManager([
            session('old-current', { current: true, minutesAgo: 3 * 24 * 60 }),
            session('recent', { minutesAgo: 1 }),
            session('middle', { minutesAgo: 120 })
        ])

        const ids = view
            .findAll('[data-session-id]')
            .map((item) => item.attributes('data-session-id'))
        expect(ids).toEqual(['old-current', 'recent', 'middle'])
    })

    it('P：每台设备带 data-session-id + data-session-current（true/false）', async () => {
        const view = await mountManager([
            session('a', { current: true }),
            session('b', { minutesAgo: 10 })
        ])

        const currents = view
            .findAll('[data-session-id]')
            .map((item) => item.attributes('data-session-current'))
        expect(currents).toEqual(['true', 'false'])
    })

    it('P：三段式信息齐备（设备名 / 地区+IP / 最近活跃+登录时间），时间 title = 完整时间戳', async () => {
        const view = await mountManager([
            session('a', { current: true, deviceType: 'Safari', region: '北京', ip4: '1.2.3.4' })
        ])

        const item = view.find('[data-session-id="a"]')
        const text = item.text()
        expect(text).toContain(t('settings.sessionDeviceSafari'))
        expect(text).toContain('北京')
        expect(text).toContain('1.2.3.4')
        expect(text).toContain(t('settings.sessionActiveAt'))
        expect(text).toContain(t('settings.sessionLoggedAt'))
        expect(text).toContain(t('settings.sessionCurrent'))

        // 时间 spans 的 title = 完整时间戳（比可见文本更长、含时分）
        const timeSpans = item.findAll('[title]')
        expect(timeSpans.length).toBe(2)
        for (const span of timeSpans) {
            const title = span.attributes('title')!
            expect(title.length).toBeGreaterThan(span.text().trim().length)
            expect(title).toMatch(/\d{1,2}:\d{2}/)
        }
    })

    it('N：「下线」只出现在非当前设备（当前设备无按钮）', async () => {
        const view = await mountManager([
            session('a', { current: true }),
            session('b', { minutesAgo: 10 })
        ])

        expect(
            view.find('[data-session-id="a"]').findAll('button').length,
            '当前设备不应有「下线」按钮'
        ).toBe(0)
        const otherButtons = view.find('[data-session-id="b"]').findAll('button')
        expect(otherButtons.length).toBe(1)
        expect(otherButtons[0]!.text()).toContain(t('settings.sessionSignOut'))
    })

    it('P：相对时间按分档渲染（5 分钟前）', async () => {
        const view = await mountManager([session('a', { current: true, minutesAgo: 5 })])

        expect(view.find('[data-session-id="a"]').text()).toContain(
            new Intl.RelativeTimeFormat('zh-CN', { numeric: 'always' }).format(-5, 'minute')
        )
    })
})

describe('R3 状态区走 LoadingError', () => {
    it('P：加载中 ⇒ 显示加载文案', async () => {
        mocks.loadSessions.mockReturnValue(new Promise(() => {}))
        wrapper = mount(SessionManager, {
            props: {
                userUseCase: { loadSessions: mocks.loadSessions } as unknown as UserUseCase
            },
            global: {
                plugins: [createPinia()],
                components: { 'nue-button': NueButton, 'nue-icon': NueIcon, 'nue-empty': NueEmpty }
            }
        })
        await flushPromises()

        expect(wrapper.text()).toContain(t('settings.sessionLoading'))
    })

    it('P：空列表 ⇒ 空态文案（无「下线」按钮、无残留行）', async () => {
        const view = await mountManager([])

        expect(view.text()).toContain(t('settings.sessionEmpty'))
        expect(view.findAll('[data-session-id]').length).toBe(0)
    })
})