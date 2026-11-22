// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { t } from '@nao-todo/shared/locales'
import { useUserStore } from '@nao-todo/presentation-identity'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../../context'
import AccountPanel from '../account-panel.vue'

/**
 * T750 / Issue #360 · 账户面板（AC2 / AC3 / AC5 / AC6 / AC9 / AC4）
 *
 * 契约（唯一事实来源 = 本文件 + `docs/designs/360-settings-polish.md`）：
 * - 身份区三行 = 昵称 / 邮箱 / `注册时间 {createdAt}`（**「更多信息」分组不存在**，AC2）；
 *   离线或 `createdAt` 缺失 ⇒ 第三行整行不渲染（不留空行 / 空标签，AC5）。
 * - 密码分区 = **常驻**（无展开按钮、无 `aria-expanded`、输入框始终在 DOM）+ 组级标题
 *   （`h3.sd-group__title` = `settings.password`）+ 有底色块（AC3）。
 * - 危险区末行 = 待注销态才出现的「数据删除时间：{date}」（AC6）；不待注销 ⇒ 不占位（AC5）。
 * - 间距：密码分区与上一块的距离 = 24（L2，唯一来源；AC4）。
 *
 * 真机几何（底色 / 字色 / 行高 / 左轴线 / 块间距）由真实 Chromium 探针实测，见回执。
 * @see docs/prds/2026-11-22-settings-polish.md
 */

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    signOut: vi.fn(),
    replace: vi.fn(),
    clearSession: vi.fn(),
    lock: vi.fn(),
    wipeUserData: vi.fn(async () => undefined),
    broadcastSignOut: vi.fn(),
    cachedNickname: '张三' as string | null
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return {
        ...actual,
        NueConfirm: mocks.confirm,
        NueMessage: { error: vi.fn(), success: vi.fn(), info: vi.fn() }
    }
})

/**
 * 身份域叶子组件桩化（避免挂载即取数/弹层副作用）；`useUserStore` 用**真实现**。
 * ⚠️ `UserPasswordUpdater` **保持真组件** —— 「输入框始终在 DOM」是 AC3 的主判据，
 *    桩掉它等于让自己写的壳自证（AGENTS「stub 不算证据」）。
 */
vi.mock('@nao-todo/presentation-identity', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nao-todo/presentation-identity')>()
    const { defineComponent } = await import('vue')
    const stub = (name: string) =>
        defineComponent({ name, template: '<div class="leaf-stub"><slot /></div>' })
    return {
        ...actual,
        UserAvatarUpdater: stub('UserAvatarUpdater'),
        UserNicknameUpdater: stub('UserNicknameUpdater'),
        UserSessionManager: stub('UserSessionManager'),
        UserDeactiveDialog: stub('UserDeactiveDialog'),
        UserRestoreDialog: stub('UserRestoreDialog')
    }
})

vi.mock('@/views/auth/sign-out-broadcast', () => ({ broadcastSignOut: mocks.broadcastSignOut }))
vi.mock('@/views/auth/sign-out-wipe', () => ({
    wipeLocalDataOnSignOut: mocks.wipeUserData
}))
vi.mock('@/views/auth/offline-entry', () => ({
    revokeOfflineEntry: vi.fn(),
    grantOfflineEntry: vi.fn(),
    isOfflineEntryGranted: () => false
}))

vi.mock('@nao-todo/infrastructure', () => ({
    readCachedNickname: () => mocks.cachedNickname,
    localSession: { clear: mocks.clearSession, getCurrentUserId: () => 'u-1' },
    cryptoService: { lock: mocks.lock },
    resolveUserIdFromStoredJwt: () => 'u-1',
    syncTracker: { countDirty: async () => 0 },
    syncService: { start: vi.fn(async () => ({ ok: true })) },
    deletionService: { wipeUserData: mocks.wipeUserData }
}))

// T122：生产侧走窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service',
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
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-tracker',
    async () => import('@nao-todo/infrastructure')
)

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: mocks.replace,
        resolve: (target: string) => ({ matched: [{}], fullPath: target }),
        currentRoute: { value: { params: {}, name: 'index' } }
    })
}))

/** 源级样式契约（jsdom 不注入 SFC 样式 ⇒ 只能读规则本体） */
const sources = import.meta.glob<string>('/apps/web/src/components/settings/**/*.{vue,ts}', {
    query: '?raw',
    import: 'default',
    eager: true
})

const sourceOf = (suffix: string): string => {
    const hit = Object.entries(sources).find(([path]) => path.endsWith(suffix))
    if (!hit) throw new Error(`缺少源文件：${suffix}`)
    return hit[1]!
}

const stripComments = (source: string): string =>
    source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const dialogStyle = ((): string => {
    const code = stripComments(sourceOf('/settings/dialog/index.vue'))
    return code.slice(code.indexOf('<style>'), code.lastIndexOf('</style>'))
})()

/** 取指定选择器的首个规则体 */
const ruleBody = (selector: string, source: string = dialogStyle): string => {
    const start = source.indexOf(`${selector} {`)
    if (start < 0) return ''
    const open = start + selector.length + 2
    return source.slice(open, source.indexOf('}', open))
}

const declaration = (selector: string, property: string): string => {
    const match = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+)`).exec(ruleBody(selector))
    return (match?.[1] ?? '').trim()
}

const TOKEN_PX: Record<string, number> = {
    '--nue-gap-xs': 8,
    '--nue-gap-lg': 24,
    '--nue-padding-xs': 8,
    '--nue-padding-sm': 12,
    '--nue-box-size-md': 40
}

const toPx = (value: string): number => {
    const expr = value.trim()
    const calc = /^calc\((.*)\)$/.exec(expr)
    if (calc) {
        const [left, right] = calc[1]!.split(/\s+-\s+/)
        return toPx(left!) - toPx(right!)
    }
    const varRef = /^var\((--[a-z0-9-]+)\)$/.exec(expr)
    if (varRef) {
        const px = TOKEN_PX[varRef[1]!]
        if (px === undefined) throw new Error(`本用例未登记的 token：${varRef[1]}`)
        return px
    }
    throw new Error(`无法解析的长度值：${expr}`)
}

let wrapper: VueWrapper | null = null

type ProfilePatch = Record<string, unknown>

/** 直接写 store（真实现）⇒ 面板按真实 profile 分支渲染 */
const setProfile = (patch: ProfilePatch): void => {
    const store = useUserStore()
    store.setUserProfile(patch as unknown as Parameters<typeof store.setUserProfile>[0])
}

/**
 * 挂载账户面板
 * @param profile 初始 profile（`null` = 不写入 store ⇒ 离线分支，昵称走缓存兜底）
 */
const mountPanel = (
    profile: ProfilePatch | null = {
        nickname: '张三',
        email: 'zhangsan@example.com',
        createdAt: '2026-01-02 03:04:05'
    }
): VueWrapper => {
    if (profile) setProfile(profile)
    wrapper = mount(AccountPanel, {
        global: {
            plugins: [nueUI],
            provide: {
                [SETTINGS_VIEW_CONTEXT_KEY as symbol]: {
                    authUseCase: { signOut: mocks.signOut },
                    userUseCase: {},
                    subscriber: {},
                    dialogManager: { open: vi.fn(), close: vi.fn() },
                    isDisplayAside: ref(false),
                    isUseFloatAside: ref(false),
                    switchDisplayAside: vi.fn()
                }
            }
        }
    })
    return wrapper
}

const passwordSection = (view: VueWrapper) => view.find('[data-setting-id="password"]')
const passwordRowIndex = (view: VueWrapper): number =>
    view
        .findAll('[data-setting-id]')
        .map((row) => row.attributes('data-setting-id'))
        .indexOf('password')

beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)
    mocks.confirm.mockResolvedValue([false])
    mocks.cachedNickname = '张三'
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AC2 身份区三行 + 「更多信息」不存在', () => {
    it('P：头像右侧依次为 昵称 / 邮箱 / 注册时间', async () => {
        const view = mountPanel()
        await flushPromises()

        const lines = view.findAll('.settings-profile__names > *').map((line) => line.text().trim())
        expect(lines).toEqual(['张三', 'zhangsan@example.com', '注册时间 2026-01-02 03:04:05'])
    })

    it('N：「更多信息」分组不存在（无同名文案、无 viewer 组件）', async () => {
        const view = mountPanel()
        await flushPromises()

        expect(view.text()).not.toContain('更多信息')
        expect(view.text()).not.toContain('More Info')
        expect(view.html()).not.toContain('info-viewer')
        // 死键一并退役：源码不再引用（AC9）
        expect(stripComments(sourceOf('/settings/profile-updater/index.vue'))).not.toContain(
            'settings.moreInfo'
        )
        expect(stripComments(sourceOf('/settings/profile-updater/index.vue'))).not.toContain(
            'user-info-viewer'
        )
    })

    it('E：profile=null（离线）⇒ 第三行不渲染、昵称走缓存兜底、邮箱位显示离线', async () => {
        const view = mountPanel(null)
        await flushPromises()

        const lines = view.findAll('.settings-profile__names > *').map((line) => line.text().trim())
        expect(lines).toEqual(['张三', t('identity.offline')])
        expect(view.text()).not.toContain('注册时间')
    })

    it('E：profile 就绪但 createdAt 缺失 ⇒ 第三行整行不渲染（不留空标签）', async () => {
        const view = mountPanel({ nickname: '张三', email: 'zhangsan@example.com' })
        await flushPromises()

        const lines = view.findAll('.settings-profile__names > *').map((line) => line.text().trim())
        expect(lines).toEqual(['张三', 'zhangsan@example.com'])
        expect(view.text()).not.toContain('注册时间')
    })
})

describe('AC3 密码常驻分区', () => {
    it('P：恒为「组级标题 + 有底色块」，无折叠行 / 无 aria-expanded / 无 chevron', async () => {
        const view = mountPanel()
        await flushPromises()

        const section = passwordSection(view)
        expect(section.exists(), '缺密码分区 data-setting-id="password"').toBe(true)
        expect(section.find('h3.sd-group__title').text()).toBe(t('settings.password'))
        expect(section.find('.sd-password__body').exists()).toBe(true)
        expect(section.findAll('[aria-expanded]').length).toBe(0)
        expect(section.find('.sd-row__toggle').exists()).toBe(false)
        expect(section.find('.sd-row__chevron').exists()).toBe(false)
    })

    it('P：三个密码输入框零点击即在 DOM（无需展开）', async () => {
        const view = mountPanel()
        await flushPromises()

        const inputs = passwordSection(view).findAll('input')
        expect(inputs.length).toBe(3)
        for (const input of inputs) {
            expect(input.attributes('type')).toBe('password')
            expect((input.attributes('aria-label') ?? '').trim().length).toBeGreaterThan(0)
        }
    })

    it('P：位置零位移 —— 位于「用户信息」之后、「登录设备」之前', async () => {
        const view = mountPanel()
        await flushPromises()

        const ids = view
            .findAll('[data-setting-id]')
            .map((row) => row.attributes('data-setting-id'))
        expect(ids).toEqual(['profile', 'password', 'sessions', 'sign-out', 'deactivate'])
        expect(passwordRowIndex(view)).toBe(1)
    })

    it('D 源级：有底色块的底色 / 圆角复用 `.sd-permission-notice` 三件套，块内边距 = 12', () => {
        expect(declaration('.sd-password__body', 'background')).toBe(
            declaration('.sd-permission-notice', 'background')
        )
        expect(declaration('.sd-password__body', 'border-radius')).toBe(
            declaration('.sd-permission-notice', 'border-radius')
        )
        expect(toPx(declaration('.sd-password__body', 'padding'))).toBe(12)
        // ⛔ 不加描边 / 阴影 / 图标（一个区块只加一处重量）
        expect(ruleBody('.sd-password__body')).not.toMatch(/(?:^|;|\s)border:/)
        expect(ruleBody('.sd-password__body')).not.toContain('box-shadow')
    })

    it('D 源级：AC4 密码分区与上一块的间距 = 24（子块 margin + 行 gap，唯一来源）', () => {
        const subblock = toPx(declaration('.sd-subblock', 'margin-top'))
        const groupGap = toPx(declaration('.sd-group', 'gap'))
        expect(subblock + groupGap).toBe(24)
        // 分区不再自带 margin / padding 叠加（旧版 `.sd-row` 上下各 8 已删）
        expect(declaration('.sd-password', 'margin-top')).toBe('')
        expect(declaration('.sd-row', 'padding-block')).toBe('')
    })
})

describe('AC6 危险区末行：待注销时间', () => {
    it('B：未待注销 ⇒ 整行不渲染（不留空行 / 空标签）', async () => {
        const view = mountPanel()
        await flushPromises()

        expect(view.find('[data-setting-deletion-deadline]').exists()).toBe(false)
        expect(view.text()).not.toContain('数据删除时间')
        // 未待注销 ⇒ 危险区仍是「退出登录 + 注销账户」两行
        const zoneIds = view
            .find('[data-settings-zone="danger"]')
            .findAll('[data-setting-id]')
            .map((row) => row.attributes('data-setting-id'))
        expect(zoneIds).toEqual(['sign-out', 'deactivate'])
    })

    it('P：待注销 ⇒ 危险区末行出现「数据删除时间」（= 停用日 − 7 天）且撤销注销仍可用', async () => {
        const view = mountPanel({
            nickname: '张三',
            email: 'zhangsan@example.com',
            createdAt: '2026-01-02 03:04:05',
            deactivedAt: '2026-11-20 10:00:00'
        })
        await flushPromises()

        const row = view.find('[data-setting-deletion-deadline]')
        expect(row.exists(), '待注销态缺「数据删除时间」行').toBe(true)
        expect(row.text()).toBe(
            t('settings.restore.deletionDeadline', { date: '2026-11-13 10:00:00' })
        )
        // 末行：它是危险区最后一个元素；撤销注销仍在且可点（AC6）
        const zone = view.find('[data-settings-zone="danger"]')
        expect(zone.element.lastElementChild).toBe(row.element)
        const restore = zone.find('[data-setting-id="deactivate"]')
        expect(restore.text()).toBe(t('user.restoreWarningTitle'))
        expect((restore.element as HTMLButtonElement).disabled).toBe(false)
        // 面向用户文案不裸露内部键名（AGENTS 界面原则 ①）
        for (const banned of ['deactivedAt', 'createdAt', 'profile']) {
            expect(row.text()).not.toContain(banned)
        }
    })
})