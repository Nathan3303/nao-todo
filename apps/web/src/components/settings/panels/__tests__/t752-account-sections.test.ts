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
 * T752 / Issue #360 第二轮 · 账户面板**四分区化** + 密码分区去底色
 *
 * 契约（唯一事实来源 = 本文件 + `docs/designs/360-settings-polish.md` §1 / §3c 与
 * `docs/designs/360-settings-polish-copy.md` §一）：
 * - 面板头（`账户` h2 + 一句说明）之下**四个平级分区**：资料 / 密码 / 登录设备 / 危险区，
 *   每区 = 分区组头（`h3.sd-group__title` 20/600）+ **一句副标题**（`.sd-group__desc`）+ 内容；
 *   组头名**全部复用现存键**（⛔ 不为分区头另造新键），只新增 3 个副标题键（危险区复用）。
 * - **密码分区无底色 / 无内边距 / 无圆角**（用户第二轮裁定 B 方案）：分区的重量只由
 *   「组头字阶（20 vs 14）+ 块间距（24）」两通道承担；⛔ 不加描边 / 阴影 / 字号（第三种手段）。
 * - **登录设备升为独立分区**：组件内同名小标题（`.session-manager__title`）移除，
 *   标题由分区组头承担 ⇒ 面板内「登录设备」只出现一次。
 *
 * 真机几何（左缘同基线 / 窄屏可用宽 / 计算样式）**不进测试套件**：它由一次性的 Chromium 探针
 * 在仓外实测（`T753` 已把探针文件移出仓库，理由是 `apps/web` 的 TS program 一旦 import `node:*`
 * 就把 `@types/node` 的全局 `setTimeout` 拉进整个 web 程序，全仓 `vp check` 变红）。实测值留档在
 * `T753` 回执 / PR 描述；本文件负责**可回归**的那半（DOM 结构 + 源级样式契约）。
 * @see docs/prds/2026-11-22-settings-polish.md（AC2 / AC3 / AC4 / AC5）
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

/** 身份域叶子组件桩化（挂载即取数/弹层副作用）；`useUserStore` 用**真实现** */
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

/** 跨包源级契约：登录设备组件本体（会话小标题已在 T752 移除） */
const sessionManagerSources = import.meta.glob<string>(
    '/packages/presentation-identity/src/components/session-manager/session-manager.vue',
    { query: '?raw', import: 'default', eager: true }
)

const sourceOf = (suffix: string, from: Record<string, string> = sources): string => {
    const hit = Object.entries(from).find(([path]) => path.endsWith(suffix))
    if (!hit) throw new Error(`缺少源文件：${suffix}`)
    return hit[1]!
}

const stripComments = (source: string): string =>
    source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const dialogStyle = ((): string => {
    const code = stripComments(sourceOf('/settings/dialog/index.vue'))
    return code.slice(code.indexOf('<style>'), code.lastIndexOf('</style>'))
})()

const accountPanelSource = (): string =>
    stripComments(sourceOf('/settings/panels/account-panel.vue'))

/** 取指定选择器的首个规则体（不存在 ⇒ 空串） */
const ruleBody = (selector: string): string => {
    const start = dialogStyle.indexOf(`${selector} {`)
    if (start < 0) return ''
    const open = start + selector.length + 2
    return dialogStyle.slice(open, dialogStyle.indexOf('}', open))
}

const declaration = (selector: string, property: string): string => {
    const match = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+)`).exec(ruleBody(selector))
    return (match?.[1] ?? '').trim()
}

let wrapper: VueWrapper | null = null

const mountPanel = (): VueWrapper => {
    useUserStore().setUserProfile({
        nickname: '张三',
        email: 'zhangsan@example.com',
        createdAt: '2026-01-02 03:04:05'
    } as unknown as Parameters<ReturnType<typeof useUserStore>['setUserProfile']>[0])
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

/** 分区组头（`data-settings-section` 是分区头的稳定钩子） */
const heads = (view: VueWrapper) => view.findAll('[data-settings-section]')

beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mocks.confirm.mockResolvedValue([false])
    mocks.cachedNickname = '张三'
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('① 账户面板四分区：组头 + 副标题齐备（顺序零位移）', () => {
    it('P：四个分区组头按「资料 → 密码 → 登录设备 → 危险区」出现', async () => {
        const view = mountPanel()
        await flushPromises()

        expect(heads(view).map((head) => head.attributes('data-settings-section'))).toEqual([
            'profile',
            'password',
            'devices',
            'danger'
        ])
    })

    it('P：每个分区 = 组头名（复用现存键）+ 一句副标题（新键 / 危险区复用键）', async () => {
        const view = mountPanel()
        await flushPromises()

        const titles = heads(view).map((head) => head.find('h3.sd-group__title').text())
        expect(titles).toEqual([
            t('settings.profile'),
            t('settings.password'),
            t('settings.sessionTitle'),
            t('settings.dangerZone')
        ])

        const descs = heads(view).map((head) => head.find('p.sd-group__desc').text().trim())
        expect(descs).toEqual([
            t('settings.ia.profile.desc'),
            t('settings.ia.password.desc'),
            t('settings.ia.devices.desc'),
            t('settings.ia.danger.desc')
        ])
        // 副标题四句互不相同（不是同一个 key 复制四遍）
        expect(new Set(descs).size).toBe(4)
        // 副标题都是「一句话」：短、无换行、不裸露内部键名（AGENTS 界面原则 ①）
        for (const desc of descs) {
            expect(desc.length).toBeGreaterThan(0)
            expect(desc.length).toBeLessThanOrEqual(40)
            for (const banned of ['deactivedAt', 'createdAt', 'profile', 'session']) {
                expect(desc.toLowerCase()).not.toContain(banned)
            }
        }
    })

    it('P：面板头仍是 h2「账户」+ 说明（分区组头是 h3，层级不倒退）', async () => {
        const view = mountPanel()
        await flushPromises()

        expect(view.find('h2.sd-group__title').text()).toBe(t('settings.ia.account.name'))
        expect(heads(view).every((head) => head.find('h3.sd-group__title').exists())).toBe(true)
    })

    it('P：「登录设备」作为**标题**只出现一次（分区组头；组件内同名小标题已移除）', async () => {
        const view = mountPanel()
        await flushPromises()

        // 按元素文本**精确相等**计数（面板头说明「资料、密码与登录设备」含该词但不等于它）
        const exactTitles = view
            .findAll('*')
            .filter((el) => el.text().trim() === t('settings.sessionTitle'))
        expect(exactTitles.length).toBe(1)
        expect(exactTitles[0]!.attributes('class')).toContain('sd-group__title')
    })

    it('D 源级：分区组头 = 20/600（`.sd-group__title` 唯一来源，⛔ 不另起字阶）', () => {
        expect(declaration('.sd-group__title', 'font-size')).toBe('var(--nue-text-lg)')
        expect(declaration('.sd-group__title', 'font-weight')).toBe('600')
        // 副标题 12 / secondary（既有口径，零新增）
        expect(declaration('.sd-group__desc', 'font-size')).toBe('var(--nue-text-xs)')
        expect(declaration('.sd-group__desc', 'color')).toBe('var(--nue-secondary-text-color)')
    })
})

describe('② 登录设备：组件内同名小标题不再出现', () => {
    it('D 源级：`session-manager.vue` 不再渲染 `.session-manager__title`（模板与样式双清）', () => {
        const component = stripComments(
            sourceOf('/session-manager.vue', sessionManagerSources as Record<string, string>)
        )
        expect(component).not.toContain('session-manager__title')
        // 标题键归分区组头所有（组件内不再自取，防两级同名标题复发）
        expect(component).not.toContain('settings.sessionTitle')
    })

    it('P：刷新按钮仍在（列表头保留，行为零改动）', async () => {
        const component = stripComments(
            sourceOf('/session-manager.vue', sessionManagerSources as Record<string, string>)
        )
        // 图标按钮 + tooltip 名仍在（视觉不动：只删标题一行）
        expect(component).toContain('icon="refresh"')
        expect(component).toContain("t('settings.sessionRefresh')")
    })
})

describe('③ + ④ 密码分区去底色（B 方案）：无底色 / 无内边距 / 无圆角 / 无 label 覆写', () => {
    it('D 源级：设置域样式里 `sd-password` 专属规则整体消失（三条声明 + label 覆写一并删）', () => {
        expect(ruleBody('.sd-password__body')).toBe('')
        expect(ruleBody('.sd-password')).toBe('')
        expect(dialogStyle).not.toContain('sd-password')
        // 密码表单 label 不再覆写 -700（无底色 ⇒ label 回 -600，白底 5.74 ✓，与面板其他行同值）
        expect(dialogStyle).not.toContain('nue-text--label')
    })

    it('D 源级：内容块不套第二层容器 —— 左移/窄屏 +24 的来源（旧 12px 内边距）已不存在', () => {
        const panel = accountPanelSource()
        expect(panel).toContain('data-setting-id="password"')
        expect(panel).not.toContain('sd-password__body')
        // 横轴内缩唯一来源仍是 `.sd-group` 的 `padding-inline`（12）
        expect(declaration('.sd-group', 'padding-inline')).toBe('var(--nue-padding-sm)')
        expect(declaration('.sd-row', 'padding-inline')).toBe('')
    })

    it('N 源级：⛔ 不用第三种区分手段（无色块 / 无描边 / 无阴影 / 无字号特例）', () => {
        const panel = accountPanelSource()
        // 密码分区内容块只有行语言 class，没有自定义外观 class
        const block = /<div class="([^"]*)" data-setting-id="password">/.exec(panel)
        expect(block, '缺密码分区内容块').not.toBeNull()
        expect(block![1]).toBe('sd-row sd-row--block')
    })

    it('D 源级：密码块用到的行语言 class 自身不带任何「区分手段」声明', () => {
        // 等价于真机断言「从密码表单走到内容块，**每一层**都无底色 / 圆角 / 内边距」：
        // 内容块 = `.sd-row.sd-row--block`，中间无第二层容器（上一条已断言）
        const declares = (selector: string, family: string): boolean =>
            new RegExp(`(?:^|;|\\s)${family}(?:-[a-z]+)?\\s*:`).test(ruleBody(selector))
        for (const selector of ['.sd-row', '.sd-row--block']) {
            expect(ruleBody(selector), `${selector} 规则体缺失`).not.toBe('')
            for (const family of ['background', 'border', 'padding', 'box-shadow']) {
                expect(declares(selector, family), `${selector} 不得声明 ${family}*`).toBe(false)
            }
        }
    })
})