// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { NueButton, NueDropdown, NueText, NueTooltip } from 'nue-ui'
import SyncStatusBar from '../sync-status-bar.vue'
import { bindRailBottomHost, unbindRailBottomHost } from '@/components/app/aside-v2/rail-host'
import { setLocale } from '@nao-todo/shared/locales'
import {
    resetReadOnlyForTest,
    setOffline,
    setOfflineEntryActive
} from '@nao-todo/presentation/offline'

/**
 * 同步状态（轨道底部）组件断言
 * @description SHELL-02 4 例保持（宿主注入 / 宿主缺失负向 / click+Esc+焦点归还 / 三态文案）；
 *              T115b/r7 补：`syncTimeSource` / 角标取值 / aria-label 异常态 / live region 新档；
 *              以及由 `offline-status.vue`（已删除）迁入面板的 ②③④⑤ 文案用例
 *              （AC8 / AC9 / AC13b，含负向「不得出现 null/Invalid Date/1970」与「两条独立不合并」）。
 * @see docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md
 * @see docs/adr/2026-09-23-two-end-sync-status-unification.md（D-3 顶部零挂载 / D-4 指示通道）
 */

type MockSyncStatus = {
    syncing: boolean
    lastSyncAt: string | null
    mirrorPulledAt: string | null
    mirrorTruncated: boolean
    pendingCount: number
    failedCount: number
    paused: boolean
    lastError: string | null
}

const defaultStatus = (): MockSyncStatus => ({
    syncing: false,
    lastSyncAt: null,
    mirrorPulledAt: null,
    mirrorTruncated: false,
    pendingCount: 0,
    failedCount: 0,
    paused: false,
    lastError: null
})

// 组件已 colocate 于 webapp，其 `@/hooks` 与 root vitest 别名（apps/web/src）天然一致（SHELL-02 R9 陷阱退役）；
// 此处 mock 仅为隔离 `@nao-todo/infrastructure` 单例（jsdom 下无真实同步/IndexedDB）。
const hooksMock = vi.hoisted(() => ({
    status: undefined as unknown,
    manualSyncing: undefined as unknown,
    run: undefined as unknown,
    loadedCount: undefined as unknown
}))

vi.mock('@/hooks', async () => {
    const { ref } = await import('vue')
    const status = ref<MockSyncStatus>({
        syncing: false,
        lastSyncAt: null,
        mirrorPulledAt: null,
        mirrorTruncated: false,
        pendingCount: 0,
        failedCount: 0,
        paused: false,
        lastError: null
    })
    const manualSyncing = ref(false)
    const run = vi.fn()
    const loadedCount = ref(0)
    hooksMock.status = status
    hooksMock.manualSyncing = manualSyncing
    hooksMock.run = run
    hooksMock.loadedCount = loadedCount
    return {
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: manualSyncing, run }),
        useMirrorLoadedCount: () => loadedCount
    }
})

const status = (): Ref<MockSyncStatus> => hooksMock.status as Ref<MockSyncStatus>
const loadedCount = (): Ref<number> => hooksMock.loadedCount as Ref<number>

// jsdom 未实现 ResizeObserver；D5=B（`:transparent="true"`）下库在 mounted 内 new ResizeObserver
// （nue-ui 1.10.58 / 1.11.0 同构）→ 测试环境补最小桩（非透明模式不创建，产品代码不依赖）
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
)

let wrapper: VueWrapper | null = null

/** 挂载组件（轨道按钮/面板经 Teleport 进入注入点，故断言一律查 document） */
const mountBar = (props: Record<string, unknown> = {}): VueWrapper => {
    wrapper = mount(SyncStatusBar, {
        props,
        attachTo: document.body,
        global: {
            components: {
                'nue-button': NueButton,
                'nue-dropdown': NueDropdown,
                'nue-text': NueText,
                'nue-tooltip': NueTooltip
            }
        }
    })
    return wrapper
}

/** 建注入点宿主并挂到文档（消费侧用元素目标 + v-if，不走字符串选择器） */
const createHost = (): HTMLElement => {
    const host = document.createElement('div')
    host.id = 'AppAsideRailBottomSlot'
    document.body.appendChild(host)
    bindRailBottomHost(host)
    return host
}

/** 等待库 open/@open 门控两级提交（库在 nextTick 内 emit('open')） */
const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
}

const railButton = (): HTMLButtonElement | null =>
    document.querySelector<HTMLButtonElement>('.sync-rail-btn')

const openPanel = (): void => {
    railButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** 建宿主 + 挂载 + 打开面板（面板内容断言前置） */
const openWithPanel = async (props: Record<string, unknown> = {}): Promise<void> => {
    createHost()
    mountBar(props)
    await settle()
    openPanel()
    await settle()
}

const panel = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('.nue-dropdown--sync-panel')

const panelText = (): string => panel()?.textContent ?? ''

/** 读屏活动区域文本（NFR：只播摘要，不播 lastError 全文） */
const liveSummary = (): string =>
    document.querySelector('.sync-live-region')?.textContent?.trim() ?? ''

const badge = (): string => railButton()?.className.match(/is-data-(alert|warn)/)?.[0] ?? ''

const ariaLabel = (): string | null => railButton()?.getAttribute('aria-label') ?? null

beforeEach(() => {
    status().value = defaultStatus()
    loadedCount().value = 0
    resetReadOnlyForTest()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindRailBottomHost()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    resetReadOnlyForTest()
})

describe('SyncStatusBar - SHELL-02 轨道同步状态', () => {
    it('宿主存在：渲染进注入点，轨道按钮存在', async () => {
        mountBar()
        await settle()
        // 挂载时机未到（注册表尚未置位）：不渲染、无残留
        expect(document.querySelector('.sync-rail-btn')).toBeNull()

        const host = createHost()
        await settle()

        const button = host.querySelector<HTMLButtonElement>('.sync-rail-btn')
        expect(button).toBeTruthy()
        // 全文档唯一（未在组件原挂载处重复渲染）
        expect(document.querySelectorAll('.sync-rail-btn').length).toBe(1)
        // C13：aria-label 走 i18n、aria-expanded 走 trigger slot 的 visible（关闭态 false）
        expect(button?.getAttribute('aria-label')).toBe('同步')
        expect(button?.getAttribute('aria-expanded')).toBe('false')
        // C12：关闭态不得出现库内 <span>无选项</span> 回落（default slot 保留常驻结构 <li>）
        expect(document.querySelector('.nue-dropdown__empty-text')).toBeNull()
        // 常态无数据可信度角标（通道③）
        expect(badge()).toBe('')
    })

    it('宿主缺失：不渲染且无 warn/error（负向闭环，C3/C5）', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})

        unbindRailBottomHost()
        mountBar()
        await settle()

        expect(document.querySelector('.sync-rail-btn')).toBeNull()
        expect(document.querySelector('.nue-dropdown')).toBeNull()
        expect(warn).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
    })

    it('click 开面板 + Esc 关 + 焦点归还轨道按钮', async () => {
        createHost()
        mountBar()
        await settle()

        const button = railButton()
        expect(button).toBeTruthy()

        openPanel()
        await settle()

        // 打开态：面板生效（data-visible）且内容行/动作按钮结构在位（AC-03 Tab 目标）。
        expect(document.querySelector('.nue-dropdown')?.getAttribute('data-visible')).toBe('true')
        expect(panel()).toBeTruthy()
        expect(panelText()).toContain('从未同步')
        const actionButton = panel()?.querySelector<HTMLButtonElement>('button.nue-button')
        expect(actionButton).toBeTruthy()
        expect(actionButton?.textContent).toContain('立即同步')
        expect(button?.getAttribute('aria-expanded')).toBe('true')
        // 面板行一律 <li>（P8 / C12）
        expect(panel()?.querySelector('li')).toBeTruthy()

        // Esc 关闭（NueOverlay 承接 keydown → 库 emit('close')）
        const overlay = document.querySelector<HTMLElement>('.nue-dropdown-overlay')
        expect(overlay).toBeTruthy()
        overlay?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await settle()

        // 关闭态口径：库常驻挂载 + data-visible 控制可见性；断言面板关闭且结构仍完整
        expect(document.querySelector('.nue-dropdown')?.getAttribute('data-visible')).toBe('false')
        expect(panel()?.textContent).toContain('从未同步')
        expect(panel()?.querySelector('button.nue-button')).toBeTruthy()
        // C16：@close + nextTick 归还焦点
        expect(document.activeElement).toBe(button)
    })

    it('三态文案：从未同步 / 同步中 / 失败+计数', async () => {
        createHost()
        mountBar()
        await settle()
        openPanel()
        await settle()

        // ① 从未同步（AC-06 zh）
        expect(panelText()).toContain('从未同步')
        expect(liveSummary()).toBe('') // 无同步中、无失败 → 摘要为空

        // ② 同步中：首行文案 + 轨道按钮 loading ⇒ disabled（AC-04 预期行为）
        status().value = { ...status().value, syncing: true }
        await nextTick()
        expect(panelText()).toContain('同步中')
        expect(railButton()?.disabled).toBe(true)
        expect(liveSummary()).toBe('同步中…')

        // ③ 失败 + 计数 + 错误摘要（title 全文、文本插值、无 v-html）
        status().value = {
            ...defaultStatus(),
            lastSyncAt: '2026-09-10T10:00:00.000Z',
            pendingCount: 2,
            failedCount: 1,
            lastError: 'Sync failed: boom'
        }
        await nextTick()
        expect(railButton()?.disabled).toBe(false)
        expect(panelText()).toContain('待推送 2')
        expect(panelText()).toContain('失败 1')
        expect(panelText()).toContain('上次同步')
        // 错误行：以 title 全文定位，断言全文/无子元素（禁 v-html）
        const error = document.querySelector<HTMLElement>('[title="Sync failed: boom"]')
        expect(error?.getAttribute('title')).toBe('Sync failed: boom')
        expect(error?.textContent).toContain('Sync failed: boom')
        expect(error?.querySelector('*')).toBeNull()
        // 活动区域只播摘要：只有「失败 N」，不含 lastError 全文
        expect(liveSummary()).toBe('失败 1')
        expect(liveSummary()).not.toContain('Sync failed: boom')

        // ④ AC-06 en：文案随 locale 本地化（t 在渲染期读取 locale，组件重渲染）
        setLocale('en-US')
        status().value = { ...status().value, syncing: false, lastSyncAt: null }
        await nextTick()
        expect(panelText()).toContain('Never synced')
        setLocale('zh-CN')
    })
})

describe('SyncStatusBar - 数据可信度指示（ADR D-4 / D-5）', () => {
    it('syncTimeSource=mirrorPulledAt：首行取 mirrorPulledAt（web），lastSyncAt 不参与', async () => {
        await openWithPanel({ syncTimeSource: 'mirrorPulledAt' })

        const lastSyncAt = '2026-09-10T10:00:00.000Z'
        const mirrorPulledAt = '2026-09-23T07:30:00.000Z'
        status().value = { ...status().value, lastSyncAt, mirrorPulledAt }
        await nextTick()

        const expected = new Date(mirrorPulledAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        })
        const other = new Date(lastSyncAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        })
        expect(expected).not.toBe(other)
        expect(panelText()).toContain(`上次同步 ${expected}`)
        expect(panelText()).not.toContain(`上次同步 ${other}`)
    })

    it('角标取值（通道③）：alert（不完整·触顶）> warn（离线·有镜像）> 无', async () => {
        await openWithPanel()
        expect(badge()).toBe('')

        // 离线 + 无镜像 ⇒ 不完整 ⇒ alert
        setOffline(true)
        await nextTick()
        expect(badge()).toBe('is-data-alert')

        // 离线 + 有镜像（未触顶）⇒ warn
        status().value = { ...status().value, mirrorPulledAt: '2026-09-23T07:30:00.000Z' }
        await nextTick()
        expect(badge()).toBe('is-data-warn')

        // 在线 + 触顶 ⇒ 触顶独立驱动 alert（freshness 恒 'updated'）
        resetReadOnlyForTest()
        status().value = { ...status().value, mirrorTruncated: true }
        await nextTick()
        expect(badge()).toBe('is-data-alert')

        // 在线 + 完整 ⇒ 无
        status().value = { ...status().value, mirrorTruncated: false }
        await nextTick()
        expect(badge()).toBe('')
    })

    it('aria-label（通道④）：常态逐字不变，异常态追加状态短语（既有键拼接）', async () => {
        await openWithPanel()
        expect(ariaLabel()).toBe('同步')

        // 离线 + 无镜像 ⇒ 「同步 · 尚未同步完成，数据可能不完整」
        setOffline(true)
        await nextTick()
        expect(ariaLabel()).toBe('同步 · 尚未同步完成，数据可能不完整')

        // 在线 + 触顶 ⇒ 「同步 · 任务数量超过同步上限，仅显示部分数据」（通用文案，不编造 N）
        resetReadOnlyForTest()
        status().value = { ...status().value, mirrorTruncated: true }
        await nextTick()
        expect(ariaLabel()).toBe('同步 · 任务数量超过同步上限，仅显示部分数据')

        // 离线 + 有镜像 ⇒ 「同步 · 可能不是最新」
        setOffline(true)
        status().value = {
            ...status().value,
            mirrorTruncated: false,
            mirrorPulledAt: '2026-09-23T07:30:00.000Z'
        }
        await nextTick()
        expect(ariaLabel()).toBe('同步 · 可能不是最新')
    })

    it('live region 新增档：数据不完整·触顶播 incomplete 摘要（同步中优先）', async () => {
        await openWithPanel()
        expect(liveSummary()).toBe('')

        setOffline(true)
        await nextTick()
        expect(liveSummary()).toBe('尚未同步完成，数据可能不完整')

        // 在线 + 触顶 ⇒ 同档（摘要用 incomplete 文案）
        resetReadOnlyForTest()
        status().value = { ...status().value, mirrorTruncated: true }
        await nextTick()
        expect(liveSummary()).toBe('尚未同步完成，数据可能不完整')

        // 同步中优先（既有档不变）
        status().value = { ...status().value, syncing: true }
        await nextTick()
        expect(liveSummary()).toBe('同步中…')
    })

    it('AC8：离线 + 有镜像 ⇒ 面板 ②「数据截至 X」+「可能不是最新」；负向无 null/1970', async () => {
        await openWithPanel()
        setOffline(true)
        status().value = { ...status().value, mirrorPulledAt: '2026-09-23T07:30:00.000Z' }
        await nextTick()

        const text = panelText()
        expect(text).toContain('离线模式 · 数据截至')
        expect(text).toContain('可能不是最新')
        expect(text).not.toContain('null')
        expect(text).not.toContain('Invalid Date')
        expect(text).not.toContain('1970')
    })

    it('AC9：离线 + 无镜像 ⇒ 面板 ③ 引导联网；不得显示「截至」或「数据丢失」', async () => {
        await openWithPanel()
        setOffline(true)
        await nextTick()

        const text = panelText()
        expect(text).toContain('尚未同步完成，数据可能不完整')
        expect(text).toContain('请连接网络后重试')
        expect(text).not.toContain('数据截至')
        expect(text).not.toContain('数据丢失')
        expect(text).not.toContain('null')
        expect(text).not.toContain('1970')
    })

    it('在线且无告警 ⇒ 面板无 ②③④⑤ 行（①「已更新」退役，顶部零挂载）', async () => {
        await openWithPanel()
        status().value = { ...status().value, mirrorPulledAt: '2026-09-23T07:30:00.000Z' }
        await nextTick()

        const text = panelText()
        expect(text).not.toContain('已更新')
        expect(text).not.toContain('数据截至')
        expect(text).not.toContain('尚未同步完成')
        expect(text).not.toContain('正在加载更多')
        expect(text).not.toContain('同步上限')
    })

    it('覆盖度：未扫完（瞬态）与触顶（常驻）为两条独立提示，不合并', async () => {
        await openWithPanel()
        setOffline(true)
        status().value = {
            ...status().value,
            mirrorPulledAt: '2026-09-23T07:30:00.000Z',
            syncing: true,
            mirrorTruncated: true
        }
        await nextTick()

        const text = panelText()
        expect(text).toContain('正在加载更多…')
        expect(text).toContain('同步上限')
        // 两条独立文本节点（不合并成一条）
        expect(text.indexOf('正在加载更多…')).not.toBe(text.indexOf('同步上限'))
    })

    it('触顶且镜像已有实际加载数 ⇒「已加载 N 条，仍有更多未加载」（不编造上限）', async () => {
        await openWithPanel()
        setOffline(true)
        status().value = { ...status().value, mirrorTruncated: true }
        loadedCount().value = 200
        await nextTick()

        expect(panelText()).toContain('已加载 200 条，仍有更多未加载')
    })

    it('触顶但取不到实际加载数（0）⇒ 退回通用文案', async () => {
        await openWithPanel()
        setOffline(true)
        status().value = { ...status().value, mirrorTruncated: true }
        loadedCount().value = 0
        await nextTick()

        expect(panelText()).toContain('同步上限')
        expect(panelText()).not.toContain('已加载 0 条')
    })

    it('在线 + 触顶 ⇒ alert 角标 + ⑤ 行（无 ②③ 行）', async () => {
        await openWithPanel()
        status().value = { ...status().value, mirrorTruncated: true }
        loadedCount().value = 200
        await nextTick()

        expect(badge()).toBe('is-data-alert')
        expect(panelText()).toContain('已加载 200 条，仍有更多未加载')
        expect(panelText()).not.toContain('数据截至')
        expect(panelText()).not.toContain('尚未同步完成')
    })

    it('离线 + 有镜像 ⇒ warn 角标 + ② 行（含「数据截至 X」）', async () => {
        await openWithPanel()
        setOffline(true)
        status().value = { ...status().value, mirrorPulledAt: '2026-09-23T07:30:00.000Z' }
        await nextTick()

        expect(badge()).toBe('is-data-warn')
        expect(panelText()).toContain('离线模式 · 数据截至')
        expect(panelText()).toContain('可能不是最新')
    })

    it('离线进入 flag 与网络离线同口径（单一判定 isReadOnly）', async () => {
        await openWithPanel()
        setOfflineEntryActive(true)
        await nextTick()

        expect(badge()).toBe('is-data-alert')
        expect(ariaLabel()).toBe('同步 · 尚未同步完成，数据可能不完整')
    })
})