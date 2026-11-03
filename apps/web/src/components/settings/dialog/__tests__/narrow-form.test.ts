// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import { responsiveTypes, useResponsiveAside, useResponsiveFlag } from '@nao-todo/shared/hooks'
import SettingsDialog from '../index.vue'
import { unbindSettingsDialogHost } from '../state'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

/**
 * T534 · 设置对话框「4 类」两套布局互斥（AC4）
 *
 * 红基线：本文件由 T521 的「3 段」契约改写为「4 类」。改写理由：IA 从 3 段变 4 类
 * （`docs/prds/2026-10-24-settings-ia.md` AC4）⇒ 旧断言（3 个 tab / 3 个段 / 旧段标签）失效。
 *
 * **必须保留的 T521 守卫（不得因改写而丢失）**：
 * - R4：窄屏标识挂自有 wrapper `.sd-body.is-narrow`；`<nue-dialog :class>` 会被 NueDialog 重组 class
 *   丢弃（根为 Teleport）⇒ 绝不可把 is-narrow 挂到 dialog 上（源码级死选择器禁令）；
 * - 所有 `.is-narrow` 选择器必须以 `.sd-body` 打头；
 * - 窄屏块内不得自写分段样式 / 不得在调用处覆盖分段件尺寸；
 * - 阈值 445 只在 `packages/shared/hooks/use-responsive-flag.ts` 定义，dialog 源码不得出现魔法数。
 *
 * 两套布局：桌面（>445px）= 左栏 `tablist`；窄屏（≤445px）= 顶部 4 段 `segmented-switch`。
 */

const mocks = vi.hoisted(() => ({
    syncStatusRef: { value: null } as { value: unknown }
}))

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

const CATEGORY_IDS = ['account', 'appearance', 'reminder', 'data'] as const

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return {
        ...actual,
        NueConfirm: vi.fn(),
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
        useAuthUseCase: () => ({ signOut: vi.fn() }),
        useUserUseCase: () => ({}),
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: ref(false), run: vi.fn() }),
        useMirrorLoadedCount: () => ref(0)
    }
})

vi.mock('@nao-todo/presentation-identity', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nao-todo/presentation-identity')>()
    const { defineComponent } = await import('vue')
    const stub = (name: string) =>
        defineComponent({ name, template: '<div class="leaf-stub"><slot /></div>' })
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

vi.mock('@/views/auth/sign-out-broadcast', () => ({ broadcastSignOut: vi.fn() }))
vi.mock('@/views/auth/sign-out-wipe', () => ({
    wipeLocalDataOnSignOut: vi.fn(async () => undefined)
}))
vi.mock('@/views/auth/offline-entry', () => ({
    revokeOfflineEntry: vi.fn(),
    grantOfflineEntry: vi.fn(),
    isOfflineEntryGranted: () => false
}))

vi.mock('@nao-todo/infrastructure', () => ({
    readCachedNickname: () => '张三',
    localSession: { clear: vi.fn(), getCurrentUserId: () => 'u-1' },
    cryptoService: { lock: vi.fn() },
    resolveUserIdFromStoredJwt: () => 'u-1',
    syncTracker: { countDirty: async () => 0 },
    syncService: { start: vi.fn(async () => ({ ok: true })) },
    deletionService: { wipeUserData: vi.fn(async () => undefined) },
    markPreferenceDirty: vi.fn(async () => undefined)
}))

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
        replace: vi.fn(),
        resolve: (target: string) => ({ matched: [{}], fullPath: target }),
        currentRoute: { value: { params: {}, name: 'index' } }
    })
}))

const NueDialogStub = {
    props: ['modelValue', 'title', 'theme'],
    template:
        '<div class="nue-dialog" :class="String(theme).split(\',\').map((tm) => `nue-dialog--${tm}`)"><slot /></div>'
}

/** 设置对话框源文本（源级守卫） */
const dialogSource = (): string => {
    const modules = import.meta.glob<string>('/apps/web/src/components/settings/dialog/index.vue', {
        query: '?raw',
        import: 'default',
        eager: true
    })
    const values = Object.values(modules)
    expect(values.length).toBe(1)
    return values[0]!
}

/** 分段件源文本（尺寸/换行契约在件内，调用处不得覆盖） */
const switchSource = (): string => {
    const modules = import.meta.glob<string>(
        '/packages/shared/components/segmented-switch/segmented-switch.vue',
        {
            query: '?raw',
            import: 'default',
            eager: true
        }
    )
    const values = Object.values(modules)
    expect(values.length).toBe(1)
    return values[0]!
}

let wrapper: VueWrapper | null = null

const mountDialog = (isUseFloatAside: Ref<boolean>): VueWrapper => {
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

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindSettingsDialogHost()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AC4 两套布局互斥（桌面左栏 / 窄屏 4 段）', () => {
    it('P：桌面（>445px）⇒ 左栏 tablist 恰 4 类、顺序固定、不渲染分段件', async () => {
        const view = mountDialog(ref(false))
        await nextTick()

        const tablist = view.find('[role="tablist"]')
        expect(tablist.exists()).toBe(true)
        expect(tablist.attributes('aria-orientation')).toBe('vertical')

        const navIds = tablist
            .findAll('[data-settings-nav]')
            .map((nav) => nav.attributes('data-settings-nav'))
        expect(navIds).toEqual([...CATEGORY_IDS])
        expect(view.findAll('[role="tab"]').length).toBe(4)

        // 互斥：窄屏件不渲染
        expect(view.find('.segmented-toggle').exists()).toBe(false)
        expect(view.find('.sd-tabs').exists()).toBe(true)
    })

    it('P：窄屏（≤445px）⇒ 顶部 4 段分段切换（fill/md/纯文字/group+aria-pressed），无 tablist', async () => {
        const isUseFloatAside = ref(false)
        const view = mountDialog(isUseFloatAside)
        await nextTick()
        expect(view.find('.segmented-toggle').exists()).toBe(false)

        isUseFloatAside.value = true
        await nextTick()

        expect(view.find('[role="tablist"]').exists()).toBe(false)
        expect(view.find('[role="tab"]').exists()).toBe(false)
        expect(view.find('.sd-tabs').exists()).toBe(false)

        const group = view.find('.segmented-toggle')
        expect(group.exists()).toBe(true)
        expect(group.attributes('role')).toBe('group')
        expect(group.attributes('aria-label')).toBeTruthy()
        expect(group.classes()).toContain('is-fill')
        expect(group.classes()).toContain('is-md')

        const segments = view.findAll('.segmented-btn')
        expect(segments.length).toBe(4)
        // 纯文字（无图标）
        expect(view.findAll('.segmented-btn .nue-icon').length).toBe(0)
        // 320px 档：zh 标签 2 字（不裁字的结构前提）
        const labels = segments.map((segment) => segment.text().trim())
        for (const label of labels) expect(label.length).toBe(2)
        expect(new Set(labels).size).toBe(4)
        // a11y：默认选中首段
        expect(segments.map((segment) => segment.attributes('aria-pressed'))).toEqual([
            'true',
            'false',
            'false',
            'false'
        ])
    })

    it('B：两套随同一开关同 tick 切换，任何时刻恰好一套（不得并存/都缺）', async () => {
        const isUseFloatAside = ref(false)
        const view = mountDialog(isUseFloatAside)
        await nextTick()

        const countSets = (): number =>
            (view.find('[role="tablist"]').exists() ? 1 : 0) +
            (view.find('.segmented-toggle').exists() ? 1 : 0)

        expect(countSets()).toBe(1)
        isUseFloatAside.value = true
        await nextTick()
        expect(countSets()).toBe(1)
        isUseFloatAside.value = false
        await nextTick()
        expect(countSets()).toBe(1)
    })

    it('P：两套导航同源（同一分类清单驱动）：id 顺序一致', async () => {
        const isUseFloatAside = ref(false)
        const view = mountDialog(isUseFloatAside)
        await nextTick()

        const desktopIds = view
            .findAll('[data-settings-nav]')
            .map((nav) => nav.attributes('data-settings-nav'))

        isUseFloatAside.value = true
        await nextTick()

        const narrowIds = view
            .findAll('[data-testid^="settings-nav-"]')
            .map((nav) => nav.attributes('data-testid')!.replace('settings-nav-', ''))

        expect(narrowIds.length).toBe(4)
        expect(narrowIds).toEqual(desktopIds)
    })

    it('B：窄屏点第 3 段 ⇒ 切换到第 3 类（aria-pressed 迁移；仍只有一套语义）', async () => {
        const view = mountDialog(ref(true))
        await nextTick()

        await view.findAll('.segmented-btn')[2]!.trigger('click')
        await nextTick()

        expect(
            view.findAll('.segmented-btn').map((segment) => segment.attributes('aria-pressed'))
        ).toEqual(['false', 'false', 'true', 'false'])
        expect(view.find('[data-settings-category]').attributes('data-settings-category')).toBe(
            'reminder'
        )
        expect(view.find('[role="tablist"]').exists()).toBe(false)
    })
})

describe('AC4 T521 守卫（改写后必须保留）', () => {
    it('R4：窄屏标识挂自有 wrapper `.sd-body.is-narrow`，不挂 `<nue-dialog>`', async () => {
        const view = mountDialog(ref(true))
        await nextTick()

        expect(view.find('.sd-body').classes()).toContain('is-narrow')
        expect(view.find('.nue-dialog').classes()).not.toContain('is-narrow')
        // 面板与导航必须是 .sd-body 的同一层子元素（row/column 才作用得到）
        const body = view.find('.sd-body')
        const segmented = view.find('.segmented-toggle')
        const panel = view.find('.sd-panel')
        expect(segmented.element.parentElement).toBe(body.element)
        expect(panel.element.parentElement).toBe(body.element)
        expect(
            segmented.element.compareDocumentPosition(panel.element) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })

    it('D 源级：`<nue-dialog>` 上不得出现 :class 绑定（class 会被 NueDialog 丢弃）', () => {
        const source = dialogSource()
        expect(source).toMatch(/class="sd-body"\s+:class="\{ 'is-narrow': isNarrow \}"/)
        expect(source).not.toMatch(/<nue-dialog[^>]*:class=/)
    })

    it('D 源级：所有 `.is-narrow` 选择器以 `.sd-body` 打头（死选择器绝迹）', () => {
        const source = dialogSource()
        const style = source.slice(source.indexOf('<style>'), source.lastIndexOf('</style>'))

        expect(style).not.toContain('.nue-dialog--settings.is-narrow')
        expect(style).toContain('.sd-body.is-narrow')

        const narrowSelectors = [...style.matchAll(/([^\n{}]*\.is-narrow[^\n{}]*)\{/g)].map((m) =>
            m[1]!.trim()
        )
        expect(narrowSelectors.length).toBeGreaterThan(0)
        for (const selector of narrowSelectors) {
            for (const part of selector.split(',')) {
                expect(part.trim(), `窄屏选择器未挂在 .sd-body 上：${selector}`).toMatch(
                    /^\.sd-body/
                )
            }
        }
    })

    it('D 源级：窄屏块内无自写分段样式（sd-tabs / max-content / nowrap / tablist）', () => {
        const source = dialogSource()
        const narrowBlocks = source
            .split('.is-narrow')
            .slice(1)
            .map((chunk) => chunk.slice(0, chunk.indexOf('}') + 1))
            .join('\n')

        expect(narrowBlocks).not.toBe('')
        expect(narrowBlocks).not.toContain('sd-tabs')
        expect(narrowBlocks).not.toContain('sd-tab')
        expect(narrowBlocks).not.toContain('max-content')
        expect(narrowBlocks).not.toContain('nowrap')
        expect(narrowBlocks).not.toContain('tablist')
        expect(narrowBlocks).not.toContain('segmented-btn')
        // 桌面 tablist 的 aria-orientation 固定 vertical（不随窄屏切换）
        expect(source).not.toContain("'horizontal'")
    })

    it('D 源级：断点无魔法数（445 只在 shared hooks 定义）', () => {
        const source = dialogSource()
        expect(source).not.toMatch(/\b(445|444|446)\b/)
        expect(source).toContain('isUseFloatAside')
    })

    it('D 源级：调用处只传分段件 size="md"，不覆盖件内尺寸、不硬编码分段选择器', () => {
        const source = dialogSource()
        expect(source).toContain('size="md"')
        expect(source).not.toContain('.segmented-btn')
        expect(source).not.toContain('.segmented-toggle')
    })

    it('D 源级：分段件保持「可换行 + 高度随内容」，不引入 ellipsis / nowrap（EN 长标签不裁）', () => {
        const source = switchSource()
        expect(source).toContain('white-space: normal')
        expect(source).toContain('height: auto')
        expect(source).not.toContain('text-overflow')
        expect(source).not.toContain('white-space: nowrap')
        // 窄屏 4 段标签文案走 i18n（不得硬编码）
        expect(dialogSource()).not.toMatch(/>\s*(账户|外观|提醒|数据)\s*</)
        expect(t('settings.profile').length).toBeGreaterThan(0)
    })
})

/**
 * DEF-83 · 窄屏不伪造 tab 语义（面板壳按形态切换语义）
 *
 * 缺陷：窄屏（≤445px）导航是 `segmented-switch`（`group` + `aria-pressed`，**无** `tablist`/`tab`），
 * 而 4 个面板壳**无条件**带 `role="tabpanel"` + `aria-labelledby="settings-tab-<id>"` ⇒ 该 id 在窄屏
 * **不存在**（悬空引用），读屏拿不到面板名。
 *
 * 裁定（PM）：**窄屏不伪造 tab 语义** —— 面板壳用 `role="group"` + `aria-label="<分类名>"`，
 * 不列 `aria-labelledby`；桌面（真 tablist/tab）保持 `tabpanel` + `aria-labelledby` 回指。
 * **同一时刻只有一套语义**。
 *
 * 窄屏驱动走**真实链路**（`ResizeObserver` → `useResponsiveFlag` → `useResponsiveAside` ⇒
 * 注入的 `isUseFloatAside`），不直接翻 ref —— 契约锚点与生产一致（jsdom 无布局引擎 ⇒
 * 桩 RO 按回调回报视口宽，同 `T549` 手法 `records-responsive-harness`）。
 */
describe('DEF-83 窄屏面板语义（group + aria-label，无悬空 aria-labelledby）', () => {
    const NAME_KEYS: Record<(typeof CATEGORY_IDS)[number], LocaleKey> = {
        account: 'settings.ia.account.name',
        appearance: 'settings.ia.appearance.name',
        reminder: 'settings.ia.reminder.name',
        data: 'settings.ia.data.name'
    }

    let roCallback: ResizeObserverCallback | null = null
    let sharedFlag: Ref<number> | null = null

    /**
     * 装 RO 桩并取共享响应式标记（`useResponsiveFlag` 在模块级缓存 observer ⇒ 只装一次、
     * 否则第二次调用拿到的新 `flag` 不会被任何回调驱动）。
     */
    const ensureResponsive = (): Ref<number> => {
        if (sharedFlag) return sharedFlag
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: ResizeObserverCallback) {
                    roCallback = callback
                }
                observe(): void {
                    // jsdom 无布局引擎：观察本身无意义，宽度由 fireWidth 显式回报
                }
                unobserve(): void {
                    // 同上
                }
                disconnect(): void {
                    // 同上
                }
            }
        )
        sharedFlag = useResponsiveFlag().flag
        expect(roCallback, 'RO 未被 useResponsiveFlag 注册（链路已被别处抢先建立）').not.toBeNull()
        return sharedFlag
    }

    /** 按视口宽回报（等价真机 resize 到该宽度） */
    const fireWidth = (width: number): void => {
        expect(roCallback, 'RO 回调未注册').not.toBeNull()
        roCallback!(
            [{ contentRect: { width } }] as unknown as ResizeObserverEntry[],
            {} as ResizeObserver
        )
    }

    /** 真实钩子链挂载：`isFloating` 即生产注入的 `isUseFloatAside` */
    const mountResponsive = (): VueWrapper => {
        const flag = ensureResponsive()
        const { isFloating, visible, switchVisible } = useResponsiveAside(
            flag,
            responsiveTypes.MOBILE
        )
        mocks.syncStatusRef.value = defaultSyncStatus()
        wrapper = mount(SettingsDialog, {
            global: {
                plugins: [createPinia(), nueUI],
                provide: {
                    [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                        appSubscriber: {},
                        appDialogManager: { open: vi.fn(), close: vi.fn() },
                        isDisplayAside: visible,
                        isUseFloatAside: isFloating,
                        switchDisplayAside: switchVisible
                    }
                },
                components: { 'nue-dialog': NueDialogStub }
            }
        })
        return wrapper
    }

    /** 悬空 `aria-labelledby` 清点（指向 DOM 内不存在的 id 即缺陷） */
    const danglingLabelledBy = (view: VueWrapper): string[] => {
        const root = view.element as unknown as HTMLElement
        const ids = new Set(Array.from(root.querySelectorAll('[id]')).map((el) => el.id))
        const missing: string[] = []
        for (const el of Array.from(root.querySelectorAll('[aria-labelledby]'))) {
            const tokens = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
            for (const token of tokens) {
                if (!ids.has(token)) missing.push(`${el.tagName.toLowerCase()}#${el.id} → ${token}`)
            }
        }
        return missing
    }

    it('窄屏（360px）⇒ 无 tab/tablist/tabpanel；4 个面板壳 = group + aria-label，无悬空 aria-labelledby', async () => {
        const view = mountResponsive()
        await nextTick()
        fireWidth(360)
        await nextTick()

        expect(
            view.find('.sd-body').classes(),
            'RO 回报 360px 后未进入窄屏形态（链路未生效）'
        ).toContain('is-narrow')

        // ① 窄屏不得出现 tab 语义（导航与面板两侧）
        expect(view.find('[role="tablist"]').exists()).toBe(false)
        expect(view.find('[role="tab"]').exists()).toBe(false)
        expect(view.findAll('[role="tabpanel"]')).toHaveLength(0)

        // ② 4 个面板壳：group + 分类名，且**不再**列 aria-labelledby
        const panels = view.findAll('.sd-panel > div')
        expect(panels).toHaveLength(CATEGORY_IDS.length)
        for (const [index, category] of CATEGORY_IDS.entries()) {
            const panel = panels[index]!
            expect(panel.attributes('id')).toBe(`settings-panel-${category}`)
            expect(panel.attributes('role'), `${category} 面板窄屏应 role=group`).toBe('group')
            expect(
                panel.attributes('aria-labelledby'),
                `${category} 面板窄屏残留 aria-labelledby（悬空引用）`
            ).toBeUndefined()
            expect(panel.attributes('aria-label'), `${category} 面板窄屏缺可访问名`).toBe(
                t(NAME_KEYS[category])
            )
        }

        // ③ 全对话框无悬空 aria-labelledby（不是只查面板壳）
        expect(danglingLabelledBy(view)).toEqual([])
    })

    it('窄屏切换分类 ⇒ 语义不变（仍 group），当前面板可访问名随之更新', async () => {
        const view = mountResponsive()
        await nextTick()
        fireWidth(360)
        await nextTick()

        await view.findAll('.segmented-btn')[2]!.trigger('click')
        await nextTick()

        expect(view.findAll('[role="tabpanel"]')).toHaveLength(0)
        const current = view.find('#settings-panel-reminder')
        expect(current.attributes('role')).toBe('group')
        expect(current.attributes('aria-label')).toBe(t(NAME_KEYS.reminder))
        expect(current.attributes('hidden')).toBeUndefined()
        expect(view.find('#settings-panel-account').attributes('hidden')).not.toBeUndefined()
        expect(danglingLabelledBy(view)).toEqual([])
    })

    it('桌面（1024px）⇒ tablist/tab/tabpanel 语义完整：aria-controls/aria-labelledby 全部可解析、selected 不变', async () => {
        const view = mountResponsive()
        await nextTick()
        fireWidth(1024)
        await nextTick()

        expect(view.find('.sd-body').classes()).not.toContain('is-narrow')
        expect(view.find('[role="tablist"]').exists()).toBe(true)

        const tabs = view.findAll('[role="tab"]')
        expect(tabs).toHaveLength(CATEGORY_IDS.length)
        expect(view.findAll('[role="tabpanel"]')).toHaveLength(CATEGORY_IDS.length)

        for (const [index, category] of CATEGORY_IDS.entries()) {
            const tab = tabs[index]!
            expect(tab.attributes('id')).toBe(`settings-tab-${category}`)
            expect(tab.attributes('aria-controls')).toBe(`settings-panel-${category}`)
            expect(tab.attributes('aria-selected')).toBe(category === 'account' ? 'true' : 'false')

            const panel = view.find(`#settings-panel-${category}`)
            expect(panel.attributes('role')).toBe('tabpanel')
            expect(panel.attributes('aria-labelledby')).toBe(`settings-tab-${category}`)
            // 桌面不叠加 aria-label（同一时刻只有一套语义）
            expect(panel.attributes('aria-label')).toBeUndefined()
        }

        expect(danglingLabelledBy(view)).toEqual([])
    })

    it('B：形态来回切换语义不残留（窄 0 → 桌 4 → 窄 0 个 tabpanel）', async () => {
        const view = mountResponsive()
        await nextTick()

        fireWidth(360)
        await nextTick()
        expect(view.findAll('[role="tabpanel"]')).toHaveLength(0)

        fireWidth(1024)
        await nextTick()
        expect(view.findAll('[role="tabpanel"]')).toHaveLength(4)

        fireWidth(360)
        await nextTick()
        expect(view.findAll('[role="tabpanel"]')).toHaveLength(0)
        expect(view.findAll('[role="group"]').length).toBeGreaterThanOrEqual(CATEGORY_IDS.length)
    })
})