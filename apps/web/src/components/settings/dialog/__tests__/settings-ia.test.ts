// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { formatMirrorPulledAt } from '@nao-todo/presentation/offline'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import zhCN from '@nao-todo/shared/locales/zh-CN'
import enUS from '@nao-todo/shared/locales/en-US'
import SettingsDialog from '../index.vue'
import { unbindSettingsDialogHost } from '../state'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

/**
 * T534 · 设置对话框「4 类信息架构」（PRD `docs/prds/2026-10-24-settings-ia.md`，AC1–AC3 / AC6–AC10）
 *
 * 红基线（用例先行）：本文件在实现落地前**应当全红**；RD 按此契约实现到全绿，不得反向改断言。
 *
 * 钩子契约（唯一事实来源 = 本文件；RD 必须按名实现）：
 * - `data-settings-nav="<categoryId>"`：左栏 tab / 窄屏段落的可点入口（两套布局同一 id）
 * - `data-settings-desc`：**右侧面板组头**的一句说明（R2 用户裁定：左栏只留「图标 + 名称」，说明移到右栏组头）；
 *   左栏内**不得**出现该钩子（信息只迁移、不丢失）
 * - `data-settings-category="<categoryId>"`：当前面板容器（同一时刻只有一个）
 * - `data-setting-id="<itemId>"`：每个设置**行外壳**（钩子挂在分类面板的行上，不挂叶子组件）
 * - `data-settings-zone="danger"`：账户类危险区分组容器
 * - `data-setting-danger`：危险行标记（属性存在即危险行）
 * - `data-setting-action="toggle-local-data" | "check-update"`：折叠开关 / 外链入口
 *
 * categoryId ∈ `account | appearance | reminder | data`（顺序即展示顺序）
 * itemId ∈ `profile | password | sessions | sign-out | deactivate`
 *        ∪ `theme | language` ∪ `notify | sound | quiet-hours | permission`
 *        ∪ `sync-status | local-data | version`（共 15 项）
 *
 * 覆盖类型标记：`P` 正向 · `B` 边界 · `E` 异常 · `N` 负向 · `D` 回归/静态守卫
 * AC5（零行为回归）**不在本文件**：由零改动的既有用例承担（`t531-reminder-settings-ui` /
 * `segmented-switch` / `local-data-notice` / `profile-updater` G12）；本文件不重复断言行为。
 */

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    signOut: vi.fn(),
    replace: vi.fn(),
    clearSession: vi.fn(),
    lock: vi.fn(),
    wipeUserData: vi.fn(async () => undefined),
    broadcastSignOut: vi.fn(),
    cachedNickname: '张三' as string | null,
    syncStatusRef: { value: null } as { value: unknown },
    manualRun: vi.fn()
}))

const CATEGORY_IDS = ['account', 'appearance', 'reminder', 'data'] as const
const ITEM_IDS = {
    account: ['profile', 'password', 'sessions', 'sign-out', 'deactivate'],
    appearance: ['theme', 'language'],
    reminder: ['notify', 'sound', 'quiet-hours', 'permission'],
    data: ['sync-status', 'local-data', 'version']
} as const
const ALL_ITEM_IDS = Object.values(ITEM_IDS).flat()

const REPO_URL = 'https://github.com/Nathan3303/nao-todo/releases'

/** 默认同步状态（未同步） */
const defaultSyncStatus = (): Record<string, unknown> => ({
    syncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    failedCount: 0,
    preferenceFailedCount: 0,
    conflictCount: 0,
    droppedFieldCount: 0,
    lastError: null,
    errors: [],
    errorCount: 0,
    credentialFailure: false,
    paused: false,
    mirrorPulledAt: null,
    mirrorTruncated: false
})

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return {
        ...actual,
        NueConfirm: mocks.confirm,
        NueMessage: { error: vi.fn(), success: vi.fn(), info: vi.fn() }
    }
})

vi.mock('@/hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/hooks')>()
    const { ref } = await import('vue')
    const status = ref({
        syncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        failedCount: 0,
        preferenceFailedCount: 0,
        conflictCount: 0,
        droppedFieldCount: 0,
        lastError: null,
        errors: [],
        errorCount: 0,
        credentialFailure: false,
        paused: false,
        mirrorPulledAt: null,
        mirrorTruncated: false
    })
    mocks.syncStatusRef = status
    return {
        ...actual,
        useAuthUseCase: () => ({ signOut: mocks.signOut }),
        useUserUseCase: () => ({}),
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: ref(false), run: mocks.manualRun }),
        useMirrorLoadedCount: () => ref(0)
    }
})

/**
 * 身份域组件：叶子一律桩化（避免挂载即取数/弹层副作用）；`useUserStore` 用真实现
 * （store 由 `createPinia` 提供，初始 profile=null ⇒ 账户类走离线降级分支）。
 */
vi.mock('@nao-todo/presentation-identity', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nao-todo/presentation-identity')>()
    const { defineComponent } = await import('vue')
    const stub = (name: string) =>
        defineComponent({
            name,
            template: '<div class="leaf-stub"><slot /></div>'
        })
    return {
        ...actual,
        UserAvatarUpdater: stub('UserAvatarUpdater'),
        UserNicknameUpdater: stub('UserNicknameUpdater'),
        UserInfoViewer: stub('UserInfoViewer'),
        UserSessionManager: stub('UserSessionManager'),
        UserDeactiveManager: stub('UserDeactiveManager'),
        UserDeactiveDialog: stub('UserDeactiveDialog'),
        UserRestoreDialog: stub('UserRestoreDialog'),
        UserThemeSetter: stub('UserThemeSetter'),
        UserLanguageSetter: stub('UserLanguageSetter')
    }
})

vi.mock('@/views/auth/sign-out-broadcast', () => ({
    broadcastSignOut: mocks.broadcastSignOut
}))
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
    deletionService: { wipeUserData: mocks.wipeUserData },
    markPreferenceDirty: vi.fn(async () => undefined)
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
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/preference-sync',
    async () => import('@nao-todo/infrastructure')
)

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: mocks.replace,
        resolve: (target: string) => ({ matched: [{}], fullPath: target }),
        currentRoute: { value: { params: {}, name: 'index' } }
    })
}))

/** nue-dialog 桩：theme → `.nue-dialog--<theme>` 类（真组件走 Teleport，wrapper.find 找不到内容） */
const NueDialogStub = {
    props: ['modelValue', 'title', 'theme'],
    template:
        '<div class="nue-dialog" :class="String(theme).split(\',\').map((tm) => `nue-dialog--${tm}`)"><slot /></div>'
}

const settingsSources = (): Record<string, string> => {
    const modules = import.meta.glob<string>('/apps/web/src/components/settings/**/*.{vue,ts}', {
        query: '?raw',
        import: 'default',
        eager: true
    })
    const out: Record<string, string> = {}
    for (const [path, source] of Object.entries(modules)) {
        if (path.includes('/__tests__/')) continue
        out[path] = source
    }
    return out
}

let wrapper: VueWrapper | null = null

const mountDialog = (isUseFloatAside: Ref<boolean> = ref(false)): VueWrapper => {
    mocks.syncStatusRef.value = defaultSyncStatus()
    wrapper = mount(SettingsDialog, {
        global: {
            plugins: [createPinia(), nueUI],
            provide: {
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    appSubscriber: {},
                    appDialogManager: { open: vi.fn(), close: vi.fn() },
                    isDisplayAside: ref(true),
                    isUseFloatAside,
                    switchDisplayAside: vi.fn()
                }
            },
            components: { 'nue-dialog': NueDialogStub }
        }
    })
    return wrapper
}

/** 导航入口（桌面 tab / 窄屏分段件双写法，RD 任选其一实现即可） */
const findNav = (view: VueWrapper, id: string) =>
    view.find(`[data-settings-nav="${id}"], [data-testid="settings-nav-${id}"]`)

const goToCategory = async (view: VueWrapper, id: string): Promise<void> => {
    const nav = findNav(view, id)
    expect(nav.exists(), `缺少分类入口 data-settings-nav="${id}"`).toBe(true)
    await nav.trigger('click')
    await nextTick()
}

const activeCategory = (view: VueWrapper): string | undefined =>
    view.find('[data-settings-category]').attributes('data-settings-category')

/** 当前面板内的设置行 id（按 DOM 顺序） */
const rowIds = (view: VueWrapper): string[] =>
    view.findAll('[data-setting-id]').map((row) => row.attributes('data-setting-id')!)

/** 逐类采集：先切换到该类，再取行 id */
const collectItemIds = async (): Promise<Record<string, string[]>> => {
    const view = mountDialog()
    await nextTick()
    const collected: Record<string, string[]> = {}
    for (const category of CATEGORY_IDS) {
        await goToCategory(view, category)
        collected[category] = rowIds(view)
    }
    return collected
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.confirm.mockResolvedValue([false])
    mocks.signOut.mockResolvedValue(null)
    mocks.replace.mockResolvedValue(undefined)
    mocks.cachedNickname = '张三'
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindSettingsDialogHost()
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('AC1 四类导航（P/B/N）', () => {
    it('P：左栏恰 4 类，id 顺序 = account → appearance → reminder → data', async () => {
        const view = mountDialog()
        await nextTick()

        const navIds = view
            .findAll('[data-settings-nav], [data-testid^="settings-nav-"]')
            .map(
                (nav) =>
                    nav.attributes('data-settings-nav') ??
                    nav.attributes('data-testid')!.replace('settings-nav-', '')
            )
        expect(navIds).toEqual([...CATEGORY_IDS])
    })

    it('P：左栏每项 = 图标 + 名称（名称恰为 locale 值，不含说明拼接）', async () => {
        const view = mountDialog()
        await nextTick()

        const localeValues = new Set(Object.values(zhCN))
        const names = new Set<string>()
        for (const category of CATEGORY_IDS) {
            const nav = findNav(view, category)
            expect(nav.exists()).toBe(true)
            // 图标：NueButton icon / 内联 svg 任一
            expect(
                nav.element.querySelector('[class*="icon"], svg') !== null,
                `分类 ${category} 缺图标`
            ).toBe(true)
            // 名称：走 i18n（文案必须是 locale 里存在的值，禁硬编码散文）
            const navText = nav.text().trim()
            expect(localeValues.has(navText), `分类 ${category} 名称未走 i18n`).toBe(true)
            names.add(navText)
            // R2：左栏每项只有名称一行（不得再把说明拼进来）
            expect(
                nav.findAll('[data-settings-desc]').length,
                `分类 ${category} 左栏仍有副文本`
            ).toBe(0)
        }
        // 4 个名称互不相同（没有把说明当名称、也没有重复）
        expect(names.size).toBe(4)
    })

    it('N：左栏不承载说明（`data-settings-desc` 绝迹于左栏，防说明又飘回来）', async () => {
        const view = mountDialog()
        await nextTick()

        const tabs = view.find('.sd-tabs')
        expect(tabs.exists()).toBe(true)
        expect(tabs.findAll('[data-settings-desc]').length).toBe(0)
        // 逐项复查（桌面左栏每项外层容器）
        for (const category of CATEGORY_IDS) {
            expect(findNav(view, category).findAll('[data-settings-desc]').length).toBe(0)
        }
    })

    it('P：信息未丢 —— 右侧面板组头说明仍在（每类至少 1 条、走 i18n）', async () => {
        const view = mountDialog()
        await nextTick()

        const localeValues = new Set(Object.values(zhCN))
        const seen = new Set<string>()
        for (const category of CATEGORY_IDS) {
            await goToCategory(view, category)
            const panel = view.find('[data-settings-category]')
            expect(panel.exists()).toBe(true)

            const descs = panel.findAll('[data-settings-desc]')
            expect(descs.length, `分类 ${category} 右栏缺组头说明`).toBeGreaterThan(0)
            for (const desc of descs) {
                const text = desc.text().trim()
                expect(text.length).toBeGreaterThan(0)
                expect(localeValues.has(text), `分类 ${category} 组头说明未走 i18n`).toBe(true)
                seen.add(text)
            }
            // 该类自身的说明确实出现在右栏（不只是别的组的说明）
            expect(panel.text()).toContain(t(`settings.ia.${category}.desc` as LocaleKey))
        }
        // 四类说明合计 4 条（一条也未被删掉）
        expect(seen.size).toBeGreaterThanOrEqual(4)
    })

    it('P：点任一类 ⇒ 右侧切到该类内容（4 类逐一切换）', async () => {
        const view = mountDialog()
        await nextTick()

        for (const category of CATEGORY_IDS) {
            await goToCategory(view, category)
            expect(activeCategory(view)).toBe(category)
        }
    })

    it('P：默认落在第一类（账户），面板非空，不出现空白态', async () => {
        const view = mountDialog()
        await nextTick()

        expect(activeCategory(view)).toBe('account')
        expect(rowIds(view).length).toBeGreaterThan(0)
    })

    it('N：只渲染当前类的内容（其它类行不得同时存在）', async () => {
        const view = mountDialog()
        await nextTick()

        expect(rowIds(view)).toEqual([...ITEM_IDS.account])
        await goToCategory(view, 'reminder')
        expect(rowIds(view)).toEqual([...ITEM_IDS.reminder])
        for (const id of ITEM_IDS.appearance) expect(rowIds(view)).not.toContain(id)
    })
})

describe('AC2 元素唯一归类（P/N/E）', () => {
    it('P：逐类元素清单精确（含唯一归类：并集 15、无重复、每项只出现 1 次）', async () => {
        const collected = await collectItemIds()

        for (const category of CATEGORY_IDS) {
            expect(collected[category], `分类 ${category} 元素清单不符`).toEqual([
                ...ITEM_IDS[category]
            ])
        }

        const all = Object.values(collected).flat()
        expect(new Set(all).size).toBe(all.length)
        expect(new Set(all)).toEqual(new Set(ALL_ITEM_IDS))
        expect(all.length).toBe(ALL_ITEM_IDS.length)
    })

    it('N：每个元素只在其所属类命中，其它三类命中 0 次', async () => {
        const collected = await collectItemIds()

        for (const category of CATEGORY_IDS) {
            for (const other of CATEGORY_IDS) {
                if (other === category) continue
                for (const id of ITEM_IDS[category]) {
                    expect(collected[other], `${id} 误入 ${other}`).not.toContain(id)
                }
            }
        }
    })

    it('E：profile=null（离线）⇒ 账户类仍渲染其元素、不抛错、不留空类', async () => {
        mocks.cachedNickname = null
        const view = mountDialog()
        await nextTick()

        expect(activeCategory(view)).toBe('account')
        expect(rowIds(view)).toEqual([...ITEM_IDS.account])
    })

    it('P：提醒类的三个开关与权限状态沿用既有 i18n 键（文案不另起一套）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'reminder')

        const text = view.find('[data-settings-category]').text()
        for (const key of [
            'settings.reminder.notify',
            'settings.reminder.sound',
            'settings.reminder.quietHours'
        ] as const) {
            expect(text, `提醒类缺 ${key}`).toContain(t(key))
        }
        // 三个开关：role=switch（沿用 T531 语义，不改判定）
        const rows = view.findAll('[data-setting-id]')
        const switchRows = rows.filter((row) => row.find('[role="switch"]').exists())
        expect(switchRows.length).toBeGreaterThanOrEqual(3)
    })
})

describe('AC3 可达性（≤1 次点击；交互祖先计数）', () => {
    it('P：任一设置行到所属面板之间，交互祖先数 = 0（无二级 Tab / 无二次展开）', async () => {
        const view = mountDialog()
        await nextTick()

        for (const category of CATEGORY_IDS) {
            await goToCategory(view, category)
            const panel = view.find('[data-settings-category]')
            expect(panel.exists()).toBe(true)

            for (const row of view.findAll('[data-setting-id]')) {
                let node: Element | null = row.element.parentElement
                let interactiveAncestors = 0
                while (node && node !== panel.element) {
                    if (
                        node.matches(
                            'button, a[href], [role="tab"], [role="button"], [aria-expanded="true"]'
                        )
                    ) {
                        interactiveAncestors += 1
                    }
                    node = node.parentElement
                }
                expect(
                    interactiveAncestors,
                    `${row.attributes('data-setting-id')} 被隐藏层包裹（交互祖先 ${interactiveAncestors} 个）`
                ).toBe(0)
            }
        }
    })

    it('N：面板内部无嵌套 tablist / 无第二套分段导航', async () => {
        const view = mountDialog()
        await nextTick()

        const panel = view.find('[data-settings-category]')
        expect(panel.exists()).toBe(true)
        expect(panel.find('[role="tablist"]').exists()).toBe(false)
        expect(panel.find('.segmented-toggle').exists()).toBe(false)
    })

    it('B：本地数据行折叠态即达（行本身可见，仅「全文」需展开）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const row = view.find('[data-setting-id="local-data"]')
        expect(row.exists()).toBe(true)
        expect(row.text().trim().length).toBeGreaterThan(0)
    })
})

describe('AC6 危险操作隔离（P/N）', () => {
    it('P：账户类危险区在常规区之后、类内末位，含退出登录 + 注销账户', async () => {
        const view = mountDialog()
        await nextTick()

        const ids = rowIds(view)
        expect(ids).toEqual([...ITEM_IDS.account])
        // 常规区末位 = sessions；危险区 = 之后两项
        expect(ids.indexOf('sign-out')).toBeGreaterThan(ids.indexOf('sessions'))
        expect(ids.indexOf('deactivate')).toBeGreaterThan(ids.indexOf('sign-out'))

        const dangerZone = view.find('[data-settings-zone="danger"]')
        expect(dangerZone.exists(), '缺危险区分组 data-settings-zone="danger"').toBe(true)
        const zoneIds = dangerZone
            .findAll('[data-setting-id]')
            .map((row) => row.attributes('data-setting-id'))
        expect(zoneIds).toEqual(['sign-out', 'deactivate'])
    })

    it('P：两个危险行各自独立、三重冗余可辨（danger 标记 + 图标 + 文本）', async () => {
        const view = mountDialog()
        await nextTick()
        const localeValues = new Set(Object.values(zhCN))

        const dangerZone = view.find('[data-settings-zone="danger"]')
        for (const id of ['sign-out', 'deactivate']) {
            const row = dangerZone.find(`[data-setting-id="${id}"]`)
            expect(row.exists()).toBe(true)
            // ① 危险标记 ② 图标 ③ 文本（去色仍可辨）
            expect(row.attributes('data-setting-danger')).not.toBeUndefined()
            expect(row.element.querySelector('[class*="icon"], svg') !== null).toBe(true)
            expect(localeValues.has(row.text().trim())).toBe(true)
        }
    })

    it('N：危险区与常规区之间有明确间隔（不紧邻常规行）', async () => {
        const view = mountDialog()
        await nextTick()

        const sessions = view.find('[data-setting-id="sessions"]')
        const signOut = view.find('[data-setting-id="sign-out"]')
        expect(sessions.exists()).toBe(true)
        expect(signOut.exists()).toBe(true)
        // 危险区必须是独立容器（不是 sessions 的直接后继兄弟）
        expect(sessions.element.nextElementSibling).not.toBe(signOut.element)
        expect(sessions.element.contains(signOut.element)).toBe(false)
        const zone = view.find('[data-settings-zone="danger"]')
        expect(zone.element.contains(signOut.element)).toBe(true)
    })
})

describe('AC7 诚实外链与版本（P/N）', () => {
    it('P：「查看更新」打开项目 Releases 页（新窗口 + noopener）', async () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null)
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const trigger = view.find('[data-setting-action="check-update"]')
        expect(trigger.exists(), '缺 data-setting-action="check-update"').toBe(true)
        await trigger.trigger('click')

        expect(open).toHaveBeenCalledTimes(1)
        const [url, target, features] = open.mock.calls[0]!
        expect(url).toBe(REPO_URL)
        expect(target).toBe('_blank')
        expect(String(features ?? '')).toContain('noopener')
    })

    it('N：文案不暗示自动更新（版本行 + 外链入口禁词集）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const versionRow = view.find('[data-setting-id="version"]')
        expect(versionRow.exists()).toBe(true)
        const text = versionRow.text()
        for (const banned of ['自动更新', '自动检查', '检查更新', 'auto-update', 'auto update']) {
            expect(text.toLowerCase()).not.toContain(banned.toLowerCase())
        }
    })

    it('B：版本号显示当前注入版本；注入缺失时不留 `{version}` / `undefined` 原样串', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const text = view.find('[data-setting-id="version"]').text()
        expect(text).not.toContain('{version}')
        expect(text).not.toContain('undefined')
        expect(text).toContain(
            t('settings.version', { version: import.meta.env.VITE_APP_VERSION || '' })
        )
    })
})

describe('AC8 折叠不失信息（P/B/E）', () => {
    const localDataKeys = [
        'settings.localData.desc',
        'settings.localData.plaintext',
        'settings.localData.device',
        'settings.localData.boundary',
        'settings.localData.eviction',
        'settings.localData.endDifference'
    ] as const

    it('P：默认折叠 = 标题 + 一句摘要可见，全文 5 条不在 DOM', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const toggle = view.find('[data-setting-action="toggle-local-data"]')
        expect(toggle.exists(), '缺 data-setting-action="toggle-local-data"').toBe(true)
        expect(toggle.attributes('aria-expanded')).toBe('false')

        const text = view.find('[data-settings-category]').text()
        expect(text).toContain(t('settings.localData.title'))
        for (const key of localDataKeys.slice(1)) {
            expect(text, `折叠态泄露全文：${key}`).not.toContain(t(key))
        }
    })

    it('P：展开后全文与既有 i18n 文案逐字一致（5 条各 1 次、不删减）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        await view.find('[data-setting-action="toggle-local-data"]').trigger('click')
        await nextTick()

        const toggle = view.find('[data-setting-action="toggle-local-data"]')
        expect(toggle.attributes('aria-expanded')).toBe('true')

        const text = view.find('[data-settings-category]').text()
        expect(text).toContain(t('settings.localData.desc'))
        for (const key of localDataKeys.slice(1)) {
            const value = t(key)
            expect(text, `展开后缺 ${key}`).toContain(value)
            expect(text.split(value).length - 1, `${key} 重复出现`).toBe(1)
        }
    })

    it('B：收起再展开幂等（不丢内容、不叠加重复）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const toggle = () => view.find('[data-setting-action="toggle-local-data"]')
        await toggle().trigger('click')
        await nextTick()
        const expanded = view.find('[data-settings-category]').text()
        await toggle().trigger('click')
        await nextTick()
        expect(toggle().attributes('aria-expanded')).toBe('false')
        await toggle().trigger('click')
        await nextTick()
        expect(view.find('[data-settings-category]').text()).toBe(expanded)
    })

    it('E：展开控件键盘可达（原生 button 语义，Enter/Space 由浏览器承担）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const toggle = view.find('[data-setting-action="toggle-local-data"]')
        const el = toggle.element as HTMLElement
        const isNativeButton = el.tagName === 'BUTTON'
        const hasRole = el.getAttribute('role') === 'button'
        expect(isNativeButton || hasRole).toBe(true)
        expect(el.getAttribute('tabindex') === '-1').toBe(false)
    })
})

describe('AC9 只读同步状态行（P/N/E）', () => {
    it('N：行内无任何控件（无暂停/恢复/立即同步/重试）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const row = view.find('[data-setting-id="sync-status"]')
        expect(row.exists()).toBe(true)
        expect(row.findAll('button, a[href], [role="switch"], [role="button"]').length).toBe(0)
    })

    it('P：时间取自与侧栏同一来源（web = mirrorPulledAt）与同一格式化 helper', async () => {
        const view = mountDialog()
        await nextTick()

        const mirror = new Date(2026, 9, 24, 9, 30).toISOString()
        const last = new Date(2026, 9, 23, 8, 5).toISOString()
        const status = mocks.syncStatusRef as unknown as { value: Record<string, unknown> }
        status.value = { ...defaultSyncStatus(), mirrorPulledAt: mirror, lastSyncAt: last }
        await goToCategory(view, 'data')

        const text = view.find('[data-setting-id="sync-status"]').text()
        const expected = formatMirrorPulledAt(mirror, 'zh-CN')
        expect(expected).not.toBeNull()
        expect(text).toContain(t('sync.lastSyncAt', { time: expected! }))
        // 不得出现另一口径（桌面 lastSyncAt）的时间，避免「设置说从未同步、侧栏有时间」
        const other = formatMirrorPulledAt(last, 'zh-CN')!
        expect(text).not.toContain(other)
    })

    it('B：从未同步 ⇒ 落既有「从未同步」文案（不显示空白/占位符）', async () => {
        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')

        const text = view.find('[data-setting-id="sync-status"]').text()
        expect(text).toContain(t('sync.neverSynced'))
        expect(text).not.toContain('undefined')
        expect(text).not.toContain('null')
    })

    it('E：失败态只给文案（R7 只读裁定：不加「重试」按钮）', async () => {
        const view = mountDialog()
        await nextTick()
        const status = mocks.syncStatusRef as unknown as { value: Record<string, unknown> }
        status.value = { ...defaultSyncStatus(), failedCount: 2 }
        await goToCategory(view, 'data')

        const row = view.find('[data-setting-id="sync-status"]')
        expect(row.findAll('button').length).toBe(0)
        const text = row.text()
        expect(text).not.toContain('重试')
        expect(text).not.toContain('Retry')
    })

    it('N：不新增数据请求、不新增轮询（fetch 0 次；推进 2 分钟假时钟仍 0 次）', async () => {
        vi.useFakeTimers()
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)

        const view = mountDialog()
        await nextTick()
        await goToCategory(view, 'data')
        await nextTick()
        vi.advanceTimersByTime(120_000)
        await nextTick()

        expect(fetchSpy).not.toHaveBeenCalled()
        view.unmount()
        wrapper = null
    })
})

describe('AC10 设计一致性（D 静态守卫）', () => {
    it('D：设置域内 t(...) / *Key 引用的 i18n 键在 zh-CN 与 en-US 均存在', () => {
        const zhKeys = new Set(Object.keys(zhCN))
        const enKeys = new Set(Object.keys(enUS))
        const missing: string[] = []

        for (const [path, source] of Object.entries(settingsSources())) {
            const keys = new Set<string>()
            for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) keys.add(match[1]!)
            for (const match of source.matchAll(/\b[a-zA-Z]*Key\s*:\s*'([^']+)'/g))
                keys.add(match[1]!)
            for (const key of keys) {
                if (!zhKeys.has(key) || !enKeys.has(key)) missing.push(`${path}: ${key}`)
            }
        }

        expect(missing, `缺 i18n 键：\n${missing.join('\n')}`).toEqual([])
    })

    it('D：zh-CN 与 en-US 键集合一致（新增键必须两端齐备）', () => {
        expect(Object.keys(zhCN).sort()).toEqual(Object.keys(enUS).sort())
    })

    it('D：设置域文案无内部术语（stale / OCC / revision / archivedAt / 败方 等）', () => {
        const banned = ['stale', 'OCC', 'revision', 'archivedAt', 'derivedUpdates', '败方']
        for (const table of [zhCN, enUS]) {
            for (const [key, value] of Object.entries(table)) {
                if (!key.startsWith('settings.')) continue
                for (const term of banned) {
                    expect(value.toLowerCase(), `${key} 出现内部术语 ${term}`).not.toContain(
                        term.toLowerCase()
                    )
                }
            }
        }
    })

    it('D：不新增 token（设置域源码只引用 --nue-*，不得声明）', () => {
        const offenders: string[] = []
        for (const [path, source] of Object.entries(settingsSources())) {
            for (const match of source.matchAll(/(--nue-[a-z0-9-]+)\s*:/g)) {
                offenders.push(`${path}: ${match[1]}`)
            }
        }
        expect(offenders, `新增 token（应复用既有 nue-*）：\n${offenders.join('\n')}`).toEqual([])
    })

    it('D：面板内每个可交互控件都有可访问名（aria-label / aria-labelledby / 文本）', async () => {
        const view = mountDialog()
        await nextTick()

        for (const category of CATEGORY_IDS) {
            await goToCategory(view, category)
            const panel = view.find('[data-settings-category]')
            for (const control of panel.findAll('button, [role="switch"], input, a[href]')) {
                const el = control.element as HTMLElement
                const named =
                    (el.getAttribute('aria-label') ?? '').trim().length > 0 ||
                    el.getAttribute('aria-labelledby') !== null ||
                    control.text().trim().length > 0 ||
                    (el.getAttribute('title') ?? '').trim().length > 0
                expect(named, `${category} 面板存在无可访问名的控件`).toBe(true)
            }
        }
    })
})

/**
 * AC7（T539 红基线）左栏 `tab` ↔ `tabpanel` 语义 + 键盘切换
 * @description 现状：`role=tablist` + `role=tab` + `aria-selected` 已有，但**无 `aria-controls`**、
 *              面板无 `role=tabpanel` / `aria-labelledby`，方向键 / `Home` / `End` 不切分类
 *              （PRD `docs/prds/2026-10-25-correctness-batch.md` R5 / AC7）。
 *              钩子契约（RD 按名实现，不得反向改断言）：
 *              - 每个 `[role="tab"]` 必有非空 `id` 与非空 `aria-controls`，且该 id 的元素**存在**、
 *                `role="tabpanel"`、`aria-labelledby` **回指**该 tab 的 id（4 个 tab 全部，不只当前项）；
 *              - `ArrowDown` / `ArrowUp` 前后切分类，`Home` / `End` 跳首/末；切换后 `aria-selected`
 *                与**焦点**同步落到新 tab（禁只换内容不换焦点）。
 */
describe('AC7 a11y：左栏 tab ↔ tabpanel 关联 + 键盘切换', () => {
    /** 本组需真实 DOM（`document.getElementById` / `document.activeElement`）⇒ 挂到 body */
    const mountAttached = (): VueWrapper => {
        mocks.syncStatusRef.value = defaultSyncStatus()
        wrapper = mount(SettingsDialog, {
            attachTo: document.body,
            global: {
                plugins: [createPinia(), nueUI],
                provide: {
                    [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                        appSubscriber: {},
                        appDialogManager: { open: vi.fn(), close: vi.fn() },
                        isDisplayAside: ref(true),
                        isUseFloatAside: ref(false),
                        switchDisplayAside: vi.fn()
                    }
                },
                components: { 'nue-dialog': NueDialogStub }
            }
        })
        return wrapper
    }

    const tabsOf = (view: VueWrapper) => view.findAll('[role="tab"]')
    const tabElement = (view: VueWrapper, index: number): HTMLElement =>
        tabsOf(view)[index]!.element as HTMLElement

    it('4 个 tab 均有 aria-controls，目标存在且为 tabpanel（aria-labelledby 回指）', async () => {
        const view = mountAttached()
        await nextTick()

        const tabs = tabsOf(view)
        expect(tabs).toHaveLength(CATEGORY_IDS.length)

        const selected = tabs.filter((tab) => tab.attributes('aria-selected') === 'true')
        expect(selected, '恰有一个 tab 处于选中态').toHaveLength(1)

        for (const [index, tab] of tabs.entries()) {
            const el = tab.element as HTMLElement
            const label = `${CATEGORY_IDS[index]} tab`
            expect(
                el.id.trim().length,
                `${label} 缺 id（aria-labelledby 回指需要）`
            ).toBeGreaterThan(0)

            const controls = el.getAttribute('aria-controls')
            expect(controls?.trim().length ?? 0, `${label} 缺 aria-controls`).toBeGreaterThan(0)

            const panel = document.getElementById(controls!)
            expect(panel, `${label} 的 aria-controls="${controls}" 目标不存在`).not.toBeNull()
            expect(panel!.getAttribute('role'), `${controls} 缺 role=tabpanel`).toBe('tabpanel')
            expect(panel!.getAttribute('aria-labelledby'), `${controls} 未回指 ${el.id}`).toBe(
                el.id
            )
        }
    })

    it('ArrowDown / ArrowUp 切分类并同步 aria-selected 与焦点', async () => {
        const view = mountAttached()
        await nextTick()

        tabElement(view, 0).focus()
        await tabsOf(view)[0]!.trigger('keydown', { key: 'ArrowDown' })
        await nextTick()

        expect(activeCategory(view)).toBe('appearance')
        expect(tabElement(view, 1).getAttribute('aria-selected')).toBe('true')
        expect(tabElement(view, 0).getAttribute('aria-selected')).toBe('false')
        expect(document.activeElement).toBe(tabElement(view, 1))

        await tabsOf(view)[1]!.trigger('keydown', { key: 'ArrowUp' })
        await nextTick()

        expect(activeCategory(view)).toBe('account')
        expect(tabElement(view, 0).getAttribute('aria-selected')).toBe('true')
        expect(document.activeElement).toBe(tabElement(view, 0))
    })

    it('Home / End 跳首/末并同步 aria-selected 与焦点', async () => {
        const view = mountAttached()
        await nextTick()

        tabElement(view, 1).focus()
        await tabsOf(view)[1]!.trigger('keydown', { key: 'End' })
        await nextTick()
        expect(activeCategory(view)).toBe('data')
        expect(tabElement(view, 3).getAttribute('aria-selected')).toBe('true')
        expect(document.activeElement).toBe(tabElement(view, 3))

        await tabsOf(view)[3]!.trigger('keydown', { key: 'Home' })
        await nextTick()
        expect(activeCategory(view)).toBe('account')
        expect(tabElement(view, 0).getAttribute('aria-selected')).toBe('true')
        expect(document.activeElement).toBe(tabElement(view, 0))
    })
})