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
 * T754 / Issue #360 第三轮 · 账户面板两条用户改动
 *
 * 契约（用户原话）：
 * - ①「把登录设备中的『刷新』按钮调整至分区主标题后面」⇒ 刷新按钮在**分区组头内**（与 `h3` 同一容器、
 *   右对齐），列表头**不再有**刷新 ⇒ 面板内刷新按钮**恰好 1 个**；节流 2s / 图标 / `title` /
 *   键盘可达语义不变（实现 = 列表组件 `defineExpose({ refresh })` + 面板转发，⛔ 包内不反向依赖面板）。
 * - ②「危险区域中的两个按钮调整至一个 nue-div 中，并改为 nue-button 组件，在 div 中水平排列」
 *   ⇒ 两个动作在**同一个 `nue-div` 容器**内、都是 `nue-button`、水平排列（间距 8 = `--nue-gap-xs`），
 *   `data-setting-id` / `data-setting-danger` 钩子、确认弹窗、冷却禁用、`deactivated` 分支、
 *   待注销时间行全部保留。
 *
 * ⚠️ `UserSessionManager` **用真组件**（不桩化）：本轮改动的正是「面板按钮 → 组件 `refresh()`
 *     → 加载」这条链路，桩组件自证不了 `defineExpose` + 函数 ref 的真实行为。
 * @see docs/prds/2026-11-22-settings-polish.md（AC2 / AC5 / AC6）
 */

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    signOut: vi.fn(),
    replace: vi.fn(),
    clearSession: vi.fn(),
    lock: vi.fn(),
    wipeUserData: vi.fn(async () => undefined),
    broadcastSignOut: vi.fn(),
    loadSessions: vi.fn(),
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

/** 身份域其它叶子桩化（挂载即副作用）；`UserSessionManager` 保持**真组件**（见文件头说明） */
vi.mock('@nao-todo/presentation-identity', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nao-todo/presentation-identity')>()
    const { defineComponent } = await import('vue')
    const stub = (name: string) =>
        defineComponent({ name, template: '<div class="leaf-stub"><slot /></div>' })
    return {
        ...actual,
        UserAvatarUpdater: stub('UserAvatarUpdater'),
        UserNicknameUpdater: stub('UserNicknameUpdater'),
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

/** 主题令牌（`--nue-gap-xs` 的真实取值：本仓用 shadlike 主题） */
const themeTokens = import.meta.glob<string>(
    '/node_modules/nue-ui-theme-shadlike/dist/global/variables.css',
    { query: '?raw', import: 'default', eager: true }
)

const sourceOf = (suffix: string, from: Record<string, string> = sources): string => {
    const hit = Object.entries(from).find(([path]) => path.endsWith(suffix))
    if (!hit) throw new Error(`缺少源文件：${suffix}`)
    return hit[1]!
}

const stripComments = (source: string): string =>
    source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const panelSource = (): string => stripComments(sourceOf('/settings/panels/account-panel.vue'))

const dialogStyle = ((): string => {
    const code = stripComments(sourceOf('/settings/dialog/index.vue'))
    return code.slice(code.indexOf('<style>'), code.lastIndexOf('</style>'))
})()

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

/** 主题令牌取值（rem → px，根字号 16 与浏览器默认一致） */
const tokenPx = (name: string): number => {
    const css = sourceOf('/variables.css', themeTokens as Record<string, string>)
    const raw = new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim()
    if (!raw) throw new Error(`主题里没有令牌 ${name}`)
    const value = raw.endsWith('rem') ? Number.parseFloat(raw) * 16 : Number.parseFloat(raw)
    if (!Number.isFinite(value)) throw new Error(`令牌 ${name} 取值无法解析：${raw}`)
    return value
}

let wrapper: VueWrapper | null = null

const mountPanel = (
    profile: Record<string, unknown> = {
        nickname: '张三',
        email: 'zhangsan@example.com',
        createdAt: '2026-01-02 03:04:05'
    }
): VueWrapper => {
    useUserStore().setUserProfile(
        profile as unknown as Parameters<ReturnType<typeof useUserStore>['setUserProfile']>[0]
    )
    wrapper = mount(AccountPanel, {
        global: {
            plugins: [nueUI],
            provide: {
                [SETTINGS_VIEW_CONTEXT_KEY as symbol]: {
                    authUseCase: { signOut: mocks.signOut },
                    userUseCase: { loadSessions: mocks.loadSessions },
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

/**
 * 会话夹具：**两台设备**（>1）⇒ 列表头会渲染「退出其他全部设备」
 * @description 列表头非空是关键夹具：若有人把刷新按钮同时留回列表头，面板内就会出现 2 个刷新
 *              （空列表时列表头整块不渲染，双份刷新会被漏掉 ⇒ 变异跑不出红）。
 */
const sessions = (): unknown[] => {
    const now = Date.now()
    return [
        {
            id: 'a',
            current: true,
            deviceType: 'Chrome',
            region: '上海',
            ip4: '10.0.0.1',
            createdAt: new Date(now - 30 * 86_400_000).toISOString(),
            updatedAt: new Date(now - 5 * 60_000).toISOString()
        },
        {
            id: 'b',
            current: false,
            deviceType: 'Safari',
            region: '北京',
            ip4: '10.0.0.2',
            createdAt: new Date(now - 10 * 86_400_000).toISOString(),
            updatedAt: new Date(now - 60 * 60_000).toISOString()
        }
    ]
}

/** 全面板内「刷新」按钮（按 tooltip 名认，不依赖我新加的选择器 ⇒ 双份刷新也会被数到） */
const refreshButtons = (view: VueWrapper) =>
    view
        .findAll('button')
        .filter((button) => button.attributes('title') === t('settings.sessionRefresh'))

beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mocks.confirm.mockResolvedValue([false])
    mocks.cachedNickname = '张三'
    mocks.loadSessions.mockResolvedValue([sessions(), null])
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('① 刷新按钮移到「登录设备」分区组头（与 h3 同一行、右对齐）', () => {
    it('P：面板内刷新按钮**恰好 1 个**，且就在 devices 分区组头里（与 h3 同一容器）', async () => {
        const view = mountPanel()
        await flushPromises()

        const buttons = refreshButtons(view)
        expect(buttons.length, '面板内刷新按钮数量必须恰好 1（列表头不得再有）').toBe(1)

        const head = view.find('header[data-settings-section="devices"]')
        expect(head.exists()).toBe(true)
        expect(head.find('h3.sd-group__title').exists()).toBe(true)
        // 同一容器：组头元素**包含**该刷新按钮（不是「兄弟/相邻」）
        expect(head.element.contains(buttons[0]!.element)).toBe(true)
        // 顺序：刷新按钮在标题与副标题**之后**（DOM 上挂在组头内尾部）
        expect(head.element.lastElementChild).toBe(buttons[0]!.element)
    })

    it('N：列表头不再有刷新（`data-setting-id="sessions"` 内 0 个）', async () => {
        const view = mountPanel()
        await flushPromises()

        const sessionsRow = view.find('[data-setting-id="sessions"]')
        expect(sessionsRow.exists()).toBe(true)
        expect(
            sessionsRow
                .findAll('button[title]')
                .filter((b) => b.attributes('title') === t('settings.sessionRefresh')).length
        ).toBe(0)
    })

    it('P：点组头刷新 ⇒ 真的触发列表加载（真子组件 defineExpose + 函数 ref 链路）', async () => {
        const view = mountPanel()
        await flushPromises()

        // 挂载即加载一次（组件 onMounted）
        expect(mocks.loadSessions).toHaveBeenCalledTimes(1)

        await refreshButtons(view)[0]!.trigger('click')
        await flushPromises()

        expect(mocks.loadSessions, '组头刷新按钮未转发到列表组件 refresh()').toHaveBeenCalledTimes(
            2
        )
    })

    it('P：节流 2s 仍在组件内（连点两次只多加载一次；宿主拿到的是**已节流**版本）', async () => {
        const view = mountPanel()
        await flushPromises()

        await refreshButtons(view)[0]!.trigger('click')
        await flushPromises()
        await refreshButtons(view)[0]!.trigger('click')
        await flushPromises()

        // onMounted 1 次 + 节流内 1 次（第二次点击被 2s 节流吞掉）
        expect(mocks.loadSessions).toHaveBeenCalledTimes(2)
    })

    it('D 源级：刷新按钮的语义未丢（图标 + tooltip 名 + 库按钮四态 + 键盘可达）', () => {
        const panel = panelSource()
        const block =
            /<nue-button[\s\S]{0,200}?data-setting-action="refresh-sessions"[\s\S]{0,200}?\/>/.exec(
                panel
            )
        expect(block, '组头刷新按钮缺失').not.toBeNull()
        const markup = block![0]
        expect(markup).toContain('icon="refresh"')
        expect(markup).toContain('theme="icon,ghost,small"')
        expect(markup).toContain("t('settings.sessionRefresh')")
        // 原生 button（nue-button 根元素）+ title ⇒ 键盘可达；focus 环由主题 `:focus-visible` 提供
        expect(panel).not.toContain('<button type="button"')
    })

    it('D 源级：组头行式布局只加在 devices 一个分区（其余三分区组头形态不变）', () => {
        const panel = panelSource()
        // 只有 devices 组头挂 `--actions` 修饰符
        const modifiers = [...panel.matchAll(/sd-group__head--actions/g)]
        expect(modifiers.length).toBe(1)
        // 其余三个组头仍是「组头 + 副标题」两件套，不带修饰符
        for (const section of ['profile', 'password', 'danger']) {
            const head = new RegExp(`class="([^"]*)"\\s+data-settings-section="${section}"`).exec(
                panel
            )
            expect(head, `缺 ${section} 组头`).not.toBeNull()
            expect(head![1]).not.toContain('--actions')
        }
        // 修饰符本身 = 两列网格（标题行 + 副标题行，动作独占右列、钉在标题行起点）
        expect(declaration('.sd-group__head--actions', 'display')).toBe('grid')
        expect(declaration('.sd-group__head--actions', 'align-items')).toBe('start')
        expect(ruleBody('.sd-group__head--actions')).toContain("'title actions'")
        // 未被修饰的基类仍是纵排（不影响其它三分区）
        expect(declaration('.sd-group__head', 'display')).toBe('flex')
        expect(declaration('.sd-group__head', 'flex-direction')).toBe('column')
    })
})

describe('② 危险区两个动作：一个 `nue-div` + 两个 `nue-button`，水平排列', () => {
    it('P：两个动作在同一个容器里，且该容器是 `nue-div`', async () => {
        const view = mountPanel()
        await flushPromises()

        const zone = view.find('[data-settings-zone="danger"]')
        const signOut = zone.find('[data-setting-id="sign-out"]')
        const deactivate = zone.find('[data-setting-id="deactivate"]')
        expect(signOut.exists()).toBe(true)
        expect(deactivate.exists()).toBe(true)

        const container = signOut.element.parentElement
        expect(container, 'sign-out 缺父容器').not.toBeNull()
        expect(container, '两个动作不在同一个容器内').toBe(deactivate.element.parentElement)
        // 容器 = nuevo-div（class 契约）
        expect(container!.classList.contains('nue-div')).toBe(true)
        expect(container!.classList.contains('sd-danger-actions')).toBe(true)
        // 容器**不**承载 data-setting-id（选择器契约仍是「两个按钮」）
        expect(container!.hasAttribute('data-setting-id')).toBe(false)
    })

    it('P：两个动作都是 `nue-button`（库按钮，不是自绘 button），危险标记仍在', async () => {
        const view = mountPanel()
        await flushPromises()

        const zone = view.find('[data-settings-zone="danger"]')
        for (const id of ['sign-out', 'deactivate']) {
            const button = zone.find(`[data-setting-id="${id}"]`)
            expect(button.element.tagName).toBe('BUTTON')
            expect(button.classes()).toContain('nue-button')
            expect(button.attributes('data-setting-danger')).not.toBeUndefined()
        }
        // 自绘危险行 class 不再出现（防「两套并存」）
        expect(zone.html()).not.toContain('sd-danger-row')
    })

    it('P：水平排列（`nue-div` 方向 = row）+ 间距 = 8（`--nue-gap-xs` 在本主题 = 8px）', async () => {
        const view = mountPanel()
        await flushPromises()

        const container = view.find('.sd-danger-actions')
        expect(container.exists()).toBe(true)
        // nue-div 把方向/间距以行内自定义属性下发（jsdom 无布局，只能读源值）
        expect(container.element.getAttribute('style')).toContain('--nue-div-flex-direction: row')
        expect(container.element.getAttribute('style')).toContain(
            '--nue-div-gap: var(--nue-gap-xs)'
        )
        expect(container.element.getAttribute('style')).toContain('--nue-div-flex-wrap: wrap')
        // 主题真值：--nue-gap-xs = 0.5rem = 8px（与用户要求「间距 8」一致）
        expect(tokenPx('--nue-gap-xs')).toBe(8)
        // 点击区不低于改前的 40（`--nue-box-size-md`）
        expect(declaration('.sd-danger-actions .nue-button', 'min-height')).toBe(
            'var(--nue-box-size-md)'
        )
        expect(tokenPx('--nue-box-size-md')).toBeGreaterThanOrEqual(40)
    })

    it('P：危险语义用库原生档（destructive / 恢复用 primary），文案与确认流程不变', async () => {
        const view = mountPanel()
        await flushPromises()

        const zone = view.find('[data-settings-zone="danger"]')
        expect(zone.find('[data-setting-id="sign-out"]').classes()).toContain(
            'nue-button--destructive'
        )
        expect(zone.find('[data-setting-id="deactivate"]').classes()).toContain(
            'nue-button--destructive'
        )
        // 文案：仍是既有键（⛔ 未改字）
        expect(zone.find('[data-setting-id="sign-out"]').text()).toBe(
            t('settings.signOutButtonText')
        )
        expect(zone.find('[data-setting-id="deactivate"]').text()).toBe(
            t('settings.deactive.title')
        )
        // 次序：退出登录 在 注销 之前
        const ids = zone
            .findAll('[data-setting-id]')
            .map((row) => row.attributes('data-setting-id'))
        expect(ids).toEqual(['sign-out', 'deactivate'])
    })

    it('P：点「退出登录」仍走二次确认（NueConfirm 被调用 1 次，取消则不登出）', async () => {
        const view = mountPanel()
        await flushPromises()

        await view.find('[data-setting-id="sign-out"]').trigger('click')
        await flushPromises()

        expect(mocks.confirm).toHaveBeenCalledTimes(1)
        expect(mocks.signOut).not.toHaveBeenCalled()
    })

    it('P：冷却期 ⇒ 注销按钮禁用（库按钮 disabled 态）；退出登录不受影响', async () => {
        const view = mountPanel({
            nickname: '张三',
            email: 'zhangsan@example.com',
            createdAt: '2026-01-02 03:04:05',
            isInDeactiveCooldown: true
        })
        await flushPromises()

        const zone = view.find('[data-settings-zone="danger"]')
        const deactivate = zone.find('[data-setting-id="deactivate"]')
        expect((deactivate.element as HTMLButtonElement).disabled).toBe(true)
        expect(deactivate.classes()).toContain('nue-button--disabled')

        await deactivate.trigger('click')
        expect(mocks.confirm, '禁用态仍弹确认 ⇒ 禁用失效').not.toHaveBeenCalled()

        const signOut = zone.find('[data-setting-id="sign-out"]')
        expect((signOut.element as HTMLButtonElement).disabled).toBe(false)
    })

    it('P：待注销 ⇒ 同一容器内换成「撤销注销」（primary），且末行仍是数据删除时间', async () => {
        const view = mountPanel({
            nickname: '张三',
            email: 'zhangsan@example.com',
            createdAt: '2026-01-02 03:04:05',
            deactivedAt: '2026-11-20 10:00:00'
        })
        await flushPromises()

        const zone = view.find('[data-settings-zone="danger"]')
        const restore = zone.find('[data-setting-id="deactivate"]')
        expect(restore.text()).toBe(t('user.restoreWarningTitle'))
        expect(restore.classes()).toContain('nue-button--primary')
        // 仍在同一个 nue-div 容器内（与退出登录并排）
        expect(restore.element.parentElement).toBe(
            zone.find('[data-setting-id="sign-out"]').element.parentElement
        )
        expect(restore.element.parentElement!.classList.contains('nue-div')).toBe(true)

        // 待注销时间行保留不动（仍是危险区末位元素，文案同既有键）
        const deadline = zone.find('[data-setting-deletion-deadline]')
        expect(deadline.exists(), '待注销态缺「数据删除时间」行').toBe(true)
        expect(deadline.text()).toBe(
            t('settings.restore.deletionDeadline', { date: '2026-11-13 10:00:00' })
        )
        expect(zone.element.lastElementChild).toBe(deadline.element)
    })

    it('D 源级：容器是一个 `nue-div` + 两个 `nue-button`（自绘按钮与自绘危险行规则一并消失）', () => {
        const panel = panelSource()
        expect(panel).toContain('<nue-div class="sd-danger-actions"')
        // 两个动作都是库按钮（模板里没有自绘 <button>）
        expect(panel).not.toContain('<button')
        expect(panel).not.toContain('sd-danger-row')
        // 自绘危险行样式（hover / focus-visible / disabled 三套手写态）已删，交给主题
        for (const selector of [
            '.sd-danger-row',
            '.sd-danger-row:hover',
            '.sd-danger-row:focus-visible',
            '.sd-danger-row:disabled'
        ]) {
            expect(ruleBody(selector), `${selector} 规则应已删除`).toBe('')
        }
        expect(dialogStyle).not.toContain('sd-danger-row')
    })
})