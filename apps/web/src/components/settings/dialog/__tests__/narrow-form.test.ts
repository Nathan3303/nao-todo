// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { t } from '@nao-todo/shared/locales'
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