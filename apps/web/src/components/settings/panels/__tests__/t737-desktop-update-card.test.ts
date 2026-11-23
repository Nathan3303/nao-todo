// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import { nueUI } from '@/nue-ui-register'
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import DataPanel from '../data-panel.vue'

/**
 * T737 / T747 · 桌面端「关于与更新」块 + 卡 A 数据护栏（PRD `docs/prds/2026-11-20-desktop-self-update.md`）
 *
 * v4（T746/T747）**重写**：盒式卡（`sd-update__card` / `__r1` / `__r2` / `__label`）整体作废，
 * 改为「组头 + 两条有底色行」（`.sd-update__list` / `.sd-update__row`）—— 断言全部搬到新 DOM，
 * **不删断言换实现**：九态渲染 / 动作可用性 / 失败态无重试 / primary 断言 / 卡 A / AC10 零外溢 /
 * 无障碍（`role=status` 只挂阶段文案、progressbar 独立）逐项保留。
 *
 * 钩子契约（唯一事实来源 = 设计稿 §9）：
 * - R2 根：`data-setting-id="update-status"` + `data-update-state="<九态字面量>"`
 *   + `data-update-platform-degraded="true|false"`
 * - 版本行（R1 / Web 共用）：`data-setting-id="version"` + `data-setting-action="check-update"`
 * - 动作：`data-update-action="download|restart|later|open-download-page"`
 *   + 卡 A `data-update-action="guard-sync|guard-anyway|guard-cancel"`
 *   （⛔ **无** `retry`：失败态不提供行内重试，AC4；再试 = 回 R1 点「检查更新」）
 *
 * 说明：本文件用 **hook 假状态注入**（`@/hooks/use-desktop-updater` mock）驱动九态；
 *       真 bridge 接线由 `apps/desktop/.../__tests__/t737-use-desktop-updater.test.ts` 承担；
 *       **真机几何**（行高 / 按钮高 / 行底色 / hover 描边）由真实 Chromium 探针给实测（见回执），
 *       jsdom 无布局 ⇒ 版式部分用**源级样式契约**兜住（与 `aside-drawer-tools.test.ts` 同口径）。
 * @see docs/designs/358-desktop-self-update.md（v4 §3 视觉 / §4 token / §5 九态 / §9 测试钩子）
 */

const mocks = vi.hoisted(() => {
    const baseSyncStatus = () => ({
        syncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        failedCount: 0,
        preferenceFailedCount: 0,
        conflictCount: 0,
        droppedFieldCount: 0,
        lastError: null,
        errors: [] as unknown[],
        errorCount: 0,
        credentialFailure: false,
        paused: false,
        mirrorPulledAt: null,
        mirrorTruncated: false
    })

    const baseUpdate = (patch: Record<string, unknown> = {}) => ({
        state: 'idle',
        currentVersion: '1.20.3',
        installMode: 'in-place',
        updateAvailable: false,
        ...patch
    })

    return {
        baseSyncStatus,
        baseUpdate,
        syncStatus: { value: null as unknown },
        updateStatus: { value: null as unknown },
        updateLoaded: { value: true as boolean },
        isDesktop: { value: true as boolean },
        manualRun: vi.fn(),
        check: vi.fn(),
        download: vi.fn(),
        restart: vi.fn(),
        openDownloadPage: vi.fn(),
        markSeen: vi.fn()
    }
})

vi.mock('@/hooks', async () => {
    const { ref } = await import('vue')
    const status = ref(mocks.baseSyncStatus())
    mocks.syncStatus = status
    return {
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: ref(false), run: mocks.manualRun })
    }
})

vi.mock('@/hooks/use-desktop-updater', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/hooks/use-desktop-updater')>()
    const { ref, computed } = await import('vue')
    const status = ref(mocks.baseUpdate())
    mocks.updateStatus = status
    return {
        ...actual,
        useDesktopUpdater: () => ({
            isDesktop: mocks.isDesktop.value,
            status,
            loaded: computed(() => mocks.updateLoaded.value),
            hintVisible: computed(() => false),
            check: mocks.check,
            download: mocks.download,
            restartToInstall: mocks.restart,
            openDownloadPage: mocks.openDownloadPage,
            markSeen: mocks.markSeen
        })
    }
})

/** nue-dialog 桩：Teleport ⇒ wrapper 取不到内容；桩按 `modelValue` 条件渲染（卡 A 可见性可断言） */
const NueDialogStub = {
    props: ['modelValue', 'title', 'theme'],
    emits: ['update:modelValue', 'afterOpen', 'afterClose'],
    template:
        '<div v-if="modelValue" class="nue-dialog" :class="`nue-dialog--${theme}`"><slot /></div>'
}

/**
 * 源级样式 / 模板契约（jsdom 无布局 ⇒ 只能读规则本体；真机几何见回执）
 * @description `?raw` 读的是**源码文本**：注释里的示例选择器会污染正则扫描 ⇒ 先剥注释
 */
const panelModules = import.meta.glob('/apps/web/src/components/settings/panels/data-panel.vue', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const panelSource = panelModules['/apps/web/src/components/settings/panels/data-panel.vue'] ?? ''
const panelNoComments = panelSource.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
const panelTemplate = panelNoComments.slice(
    panelNoComments.indexOf('<template>'),
    panelNoComments.indexOf('</template>')
)

/** 取指定选择器（逐字匹配 `选择器 {`）的首个规则体 */
const ruleBody = (selector: string): string => {
    const start = panelNoComments.indexOf(`${selector} {`)
    if (start < 0) return ''
    const open = start + selector.length + 2
    return panelNoComments.slice(open, panelNoComments.indexOf('}', open))
}

/** 取模板里含某片段的那一个开标签（`<...>`）—— 用于断言「整行没有 click 绑定」 */
const tagAround = (needle: string): string => {
    const index = panelTemplate.indexOf(needle)
    if (index < 0) return ''
    const start = panelTemplate.lastIndexOf('<', index)
    const end = panelTemplate.indexOf('>', index)
    return panelTemplate.slice(start, end + 1)
}

let wrapper: VueWrapper | null = null

const mountPanel = (): VueWrapper => {
    wrapper = mount(DataPanel, {
        global: {
            plugins: [nueUI],
            components: { 'nue-dialog': NueDialogStub }
        }
    })
    return wrapper
}

/** 改写假状态（`ref` 整体替换 ⇒ 触发面板重算） */
const setUpdate = async (patch: Partial<DesktopUpdateStatus>): Promise<void> => {
    ;(mocks.updateStatus as { value: DesktopUpdateStatus }).value = mocks.baseUpdate(
        patch as Record<string, unknown>
    ) as DesktopUpdateStatus
    await nextTick()
}

const setPendingCount = async (count: number, failedCount = 0): Promise<void> => {
    ;(mocks.syncStatus as { value: Record<string, unknown> }).value = {
        ...mocks.baseSyncStatus(),
        pendingCount: count,
        failedCount
    }
    await nextTick()
}

const text = (view: VueWrapper): string => view.text()

const action = (view: VueWrapper, name: string) => view.find(`[data-update-action="${name}"]`)

/** 文案禁用词：失败 / 不支持态不得把「重试」写成动作（AC4 —— 用户会去找不存在的按钮） */
const RETRY_WORDINGS = ['重试', '再试', 'try again']

const expectNoRetryWording = (copy: string): void => {
    for (const word of RETRY_WORDINGS) {
        expect(copy.toLowerCase(), `不应出现「${word}」类把重试当动作的措辞`).not.toContain(
            word.toLowerCase()
        )
    }
}

const r2 = (view: VueWrapper) => view.find('[data-setting-id="update-status"]')
/** 版本行（R1 / Web 共用的一套 DOM） */
const versionRow = (view: VueWrapper) => view.find('[data-setting-id="version"]')
/** 状态文字节点（`role=status` 只挂在这里，进度不进来） */
const stateNode = (view: VueWrapper) => view.find('.sd-desktop-status [role="status"]')
const stateTextNode = (view: VueWrapper) => view.find('.sd-desktop-status .sd-row__label')

beforeEach(() => {
    mocks.isDesktop.value = true
    mocks.updateLoaded.value = true
    mocks.manualRun.mockReset()
    mocks.check.mockReset()
    mocks.download.mockReset()
    mocks.restart.mockReset()
    mocks.openDownloadPage.mockReset()
    mocks.markSeen.mockReset()
    ;(mocks.syncStatus as { value: unknown }).value = mocks.baseSyncStatus()
    ;(mocks.updateStatus as { value: unknown }).value = mocks.baseUpdate()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('T747 · AC10 Web 端零外溢（桌面块不渲染，版本行逐字不变）', () => {
    beforeEach(() => {
        mocks.isDesktop.value = false
    })

    it('Web：无更新状态行、无动作、无组头（节点数 0）', () => {
        const view = mountPanel()
        expect(r2(view).exists()).toBe(false)
        expect(view.find('[data-update-action]').exists()).toBe(false)
        expect(view.find('.sd-update__row').exists()).toBe(false)
        expect(text(view)).not.toContain('关于与更新')
    })

    it('Web：版本行仍是「版本号 + 查看更新」外链（锚点与动作名不变）', () => {
        const view = mountPanel()
        const row = versionRow(view)
        expect(row.exists()).toBe(true)
        expect(row.classes()).toContain('sd-row')
        // 桌面载体类不出现（Web 行不加底色、不加圆角）
        expect(row.classes()).not.toContain('sd-update__row')
        // 测试环境无构建注入版本 ⇒ 文案为「版本号 」空串（与既有行为一致）
        expect(row.text()).toContain('版本号')
        expect(row.find('[data-setting-action="check-update"]').exists()).toBe(true)
        // 行内按钮仍是旧的原生 button + 外链文案（不是桌面块的 nue-button）
        expect(row.html()).toContain('查看更新')
        expect(row.find('button.sd-row__action').exists()).toBe(true)
        expect(row.find('.nue-button').exists()).toBe(false)
    })

    it('Web：即使 hook 状态是 available 也不渲染任何更新 UI（状态不外溢）', async () => {
        ;(mocks.updateStatus as { value: unknown }).value = mocks.baseUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        await nextTick()
        expect(view.find('[data-update-action]').exists()).toBe(false)
        expect(view.html()).not.toContain('1.21.0')
    })
})

describe('T747 · 版本行：R1 与 Web 行共用一套 DOM（v-if 只切 handler 与文案）', () => {
    it('两端是同一处标记：同一父容器 + 同一个 data-setting-id，仅载体类与按钮不同', () => {
        mocks.isDesktop.value = false
        const web = mountPanel()
        const webRow = versionRow(web)
        const webParentClasses = Array.from(webRow.element.parentElement?.classList ?? [])
        const webButton = webRow.find('[data-setting-action="check-update"]')
        expect(webButton.element.tagName).toBe('BUTTON')
        web.unmount()

        mocks.isDesktop.value = true
        const desktop = mountPanel()
        const desktopRow = versionRow(desktop)
        const desktopParentClasses = Array.from(desktopRow.element.parentElement?.classList ?? [])
        const desktopButton = desktopRow.find('[data-setting-action="check-update"]')

        // 同一父容器（`.sd-update__list`）⇒ AC10「Web 行逐字不变」是结构保证而非两段对齐
        expect(webParentClasses).toContain('sd-update__list')
        expect(desktopParentClasses).toEqual(webParentClasses)
        // 面板里各只有一处版本行
        expect(web.findAll('[data-setting-id="version"]')).toHaveLength(1)
        expect(desktop.findAll('[data-setting-id="version"]')).toHaveLength(1)
        // 只有桌面端加桌面载体类与 nue-button（Web 行不加底色）
        expect(desktopRow.classes()).toContain('sd-update__row')
        expect(desktopRow.classes()).toContain('sd-row')
        expect(desktopButton.classes()).toContain('nue-button')
        expect(desktopButton.classes()).toContain('nue-button--secondary')
        expect(webRow.find('.nue-button').exists()).toBe(false)
    })

    it('桌面 R1 保留 data-setting-id="version" + 动作名，显示当前版本（永不被状态替换）', async () => {
        const view = mountPanel()
        expect(versionRow(view).text()).toContain('当前版本 1.20.3')
        expect(versionRow(view).find('[data-setting-action="check-update"]').exists()).toBe(true)
        await setUpdate({ state: 'failed', failure: { stage: 'check', reason: 'offline' } })
        expect(versionRow(view).text()).toContain('当前版本 1.20.3')
        expect(versionRow(view).find('[data-setting-action="check-update"]').exists()).toBe(true)
    })

    it('never-checked：无「上次检查」hint，idle 文案给引导语', () => {
        const view = mountPanel()
        expect(text(view)).not.toContain('上次检查')
        expect(r2(view).attributes('data-update-state')).toBe('idle')
        expect(text(view)).toContain('还没检查过更新')
    })

    it('有 lastCheckedAt ⇒ 版本行显示上次检查时间（up-to-date 时也在 R1，R2 不重复）', async () => {
        await setUpdate({
            state: 'up-to-date',
            lastCheckedAt: '2026-11-20T07:30:00.000Z'
        })
        const view = mountPanel()
        expect(versionRow(view).text()).toContain('上次检查')
        // v4 §5：同一信息不在两块重复 ⇒ R2 无 hint
        expect(r2(view).find('.sd-row__hint').exists()).toBe(false)
    })

    it('检查按钮点击 ⇒ 调 check()（手动检查忽略缓存）', async () => {
        const view = mountPanel()
        await view.find('[data-setting-action="check-update"]').trigger('click')
        expect(mocks.check).toHaveBeenCalledTimes(1)
    })

    it('关于与更新 有组头（h3 + 一句说明），与「桌面常驻」同构', () => {
        const view = mountPanel()
        const heads = view.findAll('.sd-group__head')
        const updateHead = heads.find((head) => head.text().includes('关于与更新'))
        expect(updateHead).toBeDefined()
        expect(updateHead?.find('h3.sd-group__title').exists()).toBe(true)
        expect(updateHead?.text()).toContain('下载时不会打断你正在做的事')
    })
})

describe('T737 · 九态渲染（data-update-state 字面量 + 三冗余）', () => {
    const cases: Array<{
        state: DesktopUpdateStatus['state']
        symbol: string
        tone: string
        copy: string
        patch?: Partial<DesktopUpdateStatus>
    }> = [
        {
            state: 'unsupported',
            symbol: '–',
            tone: 'muted',
            copy: '当前安装方式不支持应用内更新',
            patch: { installMode: 'download-page', degradedReason: 'dev' }
        },
        { state: 'idle', symbol: '–', tone: 'muted', copy: '还没检查过更新' },
        { state: 'checking', symbol: '', tone: '', copy: '正在检查更新' },
        {
            state: 'available',
            symbol: '↑',
            tone: 'warn',
            copy: '有新版本 1.21.0',
            patch: { latestVersion: '1.21.0', updateAvailable: true }
        },
        {
            state: 'downloading',
            symbol: '…',
            tone: 'muted',
            copy: '正在下载更新…',
            patch: { latestVersion: '1.21.0', updateAvailable: true, percent: 42 }
        },
        {
            state: 'ready',
            symbol: '↓',
            tone: 'ok',
            copy: '更新已就绪',
            patch: { latestVersion: '1.21.0', updateAvailable: true }
        },
        { state: 'up-to-date', symbol: '✓', tone: 'ok', copy: '已是最新 1.20.3' },
        {
            state: 'just-updated',
            symbol: '✓',
            tone: 'ok',
            copy: '已更新到 1.20.3',
            patch: { currentVersion: '1.20.3' }
        },
        {
            state: 'failed',
            symbol: '×',
            tone: 'error',
            copy: '没能检查更新',
            patch: { failure: { stage: 'check', reason: 'offline' } }
        }
    ]

    for (const item of cases) {
        it(`${item.state}：data-update-state + 符号 + 文字 + 色（三重冗余）`, async () => {
            await setUpdate({ state: item.state, ...item.patch })
            const view = mountPanel()
            expect(r2(view).attributes('data-update-state')).toBe(item.state)
            expect(text(view)).toContain(item.copy)
            if (item.state === 'checking') {
                // checking：动作级加载态走 LoadingError（DESIGN §1.1 已登记口径）
                expect(view.findComponent(LoadingError).exists()).toBe(true)
                expect(text(view)).not.toContain('还没检查过更新')
                return
            }
            const status = view.find('.sd-desktop-status')
            // 色档挂在 `.sd-desktop-status` 家族上（符号与文字同档 ⇒ 去色后仍靠字形 + 文字）
            expect(status.classes()).toContain(`is-${item.tone}`)
            const symbol = status.find('.sd-desktop-status__symbol')
            expect(symbol.text()).toBe(item.symbol)
            expect(symbol.attributes('aria-hidden')).toBe('true')
            // 符号与文字都在同一色档容器内（同色同档，设计稿 §4 / §8）
            expect(stateTextNode(view).text()).toBe(item.copy)
            expect(view.findComponent(LoadingError).exists()).toBe(false)
        })
    }
})

describe('T737 · 动作（AC1 / AC2 / AC5 / AC11）', () => {
    it('available：显示版本 + 体积提示 ⇒「立即更新」可点并调 download()', async () => {
        await setUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            sizeBytes: 113 * 1024 * 1024,
            updateAvailable: true
        })
        const view = mountPanel()
        expect(text(view)).toContain('下载约 113 MB')
        const btn = action(view, 'download')
        expect(btn.exists()).toBe(true)
        expect(btn.classes()).toContain('nue-button--primary')
        await btn.trigger('click')
        expect(mocks.download).toHaveBeenCalledTimes(1)
    })

    it('available 但体积未知 ⇒ 不写 MB（⛔ 不编数字）', async () => {
        await setUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        expect(text(view)).toContain('装好后重启生效')
        expect(text(view)).not.toContain('MB')
    })

    it('ready：主「立即重启更新」+ 次「稍后」（secondary，⛔ 不用 ghost）；「稍后」只改本地态', async () => {
        await setUpdate({
            state: 'ready',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        expect(text(view)).toContain('更新已就绪')
        expect(action(view, 'restart').exists()).toBe(true)
        expect(action(view, 'restart').classes()).toContain('nue-button--primary')
        expect(action(view, 'later').exists()).toBe(true)
        // 行底是 -100 ⇒ ghost 的 hover 底与行底同色（零反馈）⇒ 次按钮只走 secondary
        expect(action(view, 'later').classes()).toContain('nue-button--secondary')
        expect(action(view, 'later').classes()).not.toContain('nue-button--ghost')

        await action(view, 'later').trigger('click')
        expect(action(view, 'later').exists()).toBe(false)
        expect(text(view)).toContain('更新已就绪')
        expect(action(view, 'restart').exists()).toBe(true)
        // ⛔ 不变量（qa DEF-01）：「稍后」只改本地态 ⇒ 安装/重启通道调用 0 次
        expect(mocks.restart).not.toHaveBeenCalled()
        expect(r2(view).attributes('data-update-state')).toBe('ready')
        expect(view.find('.sd-update-guard').exists()).toBe(false)
    })

    it('ready：点「立即重启更新」⇒ 安装/重启通道恰 1 次（反向对照，防「恒不调」也绿）', async () => {
        await setUpdate({
            state: 'ready',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        await action(view, 'restart').trigger('click')
        await nextTick()
        expect(mocks.restart).toHaveBeenCalledTimes(1)
        expect(view.find('.sd-update-guard').exists()).toBe(false)
    })

    it('ready：检查按钮 disabled + 可见理由（P5：不得被检查结果覆盖已下载）', async () => {
        await setUpdate({
            state: 'ready',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        const checkBtn = view.find('[data-setting-action="check-update"]')
        expect(checkBtn.attributes('disabled')).toBeDefined()
        expect(text(view)).toContain('重启应用后即可再次检查')
    })

    it('检查按钮是次按钮（nue-button secondary，组件原生 36px 档）', () => {
        const view = mountPanel()
        const checkBtn = view.find('[data-setting-action="check-update"]')
        expect(checkBtn.classes()).toContain('nue-button--secondary')
        expect(checkBtn.classes()).not.toContain('nue-button--primary')
    })

    it('downloading：R1 检查禁用、给进度条与 aria-valuenow', async () => {
        await setUpdate({
            state: 'downloading',
            latestVersion: '1.21.0',
            updateAvailable: true,
            percent: 42
        })
        const view = mountPanel()
        expect(
            view.find('[data-setting-action="check-update"]').attributes('disabled')
        ).toBeDefined()
        const bar = view.find('[role="progressbar"]')
        expect(bar.attributes('aria-valuenow')).toBe('42')
        expect(bar.attributes('aria-valuetext')).toBe('已下载 42%')
        // 进度条用既有组件（先例 task-details/main），⛔ 不自绘
        expect(view.find('.sd-update__progress .nue-progress').exists()).toBe(true)
        expect(text(view)).toContain('42%')
        expect(view.find('[data-update-action="download"]').exists()).toBe(false)
    })

    it('downloading：done/total 都已知 ⇒ 给「已下载 a / b」MB 文案', async () => {
        await setUpdate({
            state: 'downloading',
            latestVersion: '1.21.0',
            updateAvailable: true,
            downloadedBytes: 46 * 1024 * 1024,
            totalBytes: 108 * 1024 * 1024
        })
        const view = mountPanel()
        expect(text(view)).toContain('已下载 46 MB / 108 MB')
        expect(view.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('43')
    })

    it('downloading：只有 percent（无 done/total）⇒ 给百分比文案，⛔ 不写「—」', async () => {
        await setUpdate({
            state: 'downloading',
            latestVersion: '1.21.0',
            updateAvailable: true,
            percent: 42
        })
        const view = mountPanel()
        expect(text(view)).toContain('已下载 42%')
        expect(text(view)).not.toContain('—')
    })

    it('downloading 但总量未知 ⇒ 不给百分比与 MB，aria-valuetext 说明未知', async () => {
        await setUpdate({
            state: 'downloading',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        const bar = view.find('[role="progressbar"]')
        expect(bar.attributes('aria-valuenow')).toBeUndefined()
        expect(bar.attributes('aria-valuetext')).toBe('正在下载，进度未知')
        expect(view.html()).not.toContain('0 MB')
    })

    it('failed（检查）⇒ 可读原因 + **只**「打开下载页」，⛔ 无行内重试（AC4）', async () => {
        await setUpdate({
            state: 'failed',
            failure: { stage: 'check', reason: 'offline' }
        })
        const view = mountPanel()
        expect(text(view)).toContain('没能检查更新')
        expect(text(view)).toContain('当前没有网络连接')
        expect(text(view)).not.toContain('已是最新')
        // ⛔ 无重试节点（节点名与文案双向断言：换名字加回来也会被文字断言拓住）
        expect(action(view, 'retry').exists()).toBe(false)
        expect(view.findAll('button').filter((btn) => btn.text().includes('重试'))).toHaveLength(0)
        expectNoRetryWording(text(view))
        // 唯一动作 = 打开下载页，且它是主按钮
        expect(action(view, 'open-download-page').exists()).toBe(true)
        expect(action(view, 'open-download-page').classes()).toContain('nue-button--primary')
        expect(action(view, 'open-download-page').classes()).not.toContain('nue-button--ghost')
        expect(action(view, 'download').exists()).toBe(false)
        expect(action(view, 'restart').exists()).toBe(false)
    })

    it('failed（下载 / 校验）⇒ 再试入口是 R1「检查更新」（无行内重试，AC4 / AC5）', async () => {
        await setUpdate({
            state: 'failed',
            failure: { stage: 'download', reason: 'timeout' }
        })
        const view = mountPanel()
        expect(text(view)).toContain('下载没完成')
        expectNoRetryWording(text(view))
        expect(action(view, 'retry').exists()).toBe(false)
        // AC11：失败后 R1 恒可点，且点击走「重新检查」而不是绕道下载
        const checkBtn = view.find('[data-setting-action="check-update"]')
        expect(checkBtn.attributes('disabled')).toBeUndefined()
        await checkBtn.trigger('click')
        expect(mocks.check).toHaveBeenCalledTimes(1)
        expect(mocks.download).not.toHaveBeenCalled()
    })

    it('failed（校验未过）⇒ 单列文案，不写内部术语', async () => {
        await setUpdate({
            state: 'failed',
            failure: { stage: 'verify', reason: 'unknown' }
        })
        const view = mountPanel()
        expect(text(view)).toContain('更新包校验没通过')
        expect(text(view)).not.toContain('sha512')
        expectNoRetryWording(text(view))
    })

    it('AC11：失败态可再检查（R1 不 disabled；检查中才短暂禁用）', async () => {
        await setUpdate({ state: 'failed', failure: { stage: 'check', reason: 'server' } })
        const view = mountPanel()
        expect(
            view.find('[data-setting-action="check-update"]').attributes('disabled')
        ).toBeUndefined()
        await view.find('[data-setting-action="check-update"]').trigger('click')
        expect(mocks.check).toHaveBeenCalledTimes(1)

        await setUpdate({ state: 'checking' })
        expect(
            view.find('[data-setting-action="check-update"]').attributes('disabled')
        ).toBeDefined()

        await setUpdate({ state: 'up-to-date' })
        expect(
            view.find('[data-setting-action="check-update"]').attributes('disabled')
        ).toBeUndefined()
        await view.find('[data-setting-action="check-update"]').trigger('click')
        expect(mocks.check).toHaveBeenCalledTimes(2)
    })
})

describe('T737 · AC6 / AC4b / AC7 边界', () => {
    it('AC6：已是最新 ⇒ 无任何主按钮（不出现「立即更新」）', async () => {
        await setUpdate({ state: 'up-to-date' })
        const view = mountPanel()
        expect(text(view)).toContain('已是最新 1.20.3')
        expect(action(view, 'download').exists()).toBe(false)
        expect(action(view, 'restart').exists()).toBe(false)
        expect(action(view, 'open-download-page').exists()).toBe(false)
        // 无动作态不渲染空动作簇
        expect(view.find('.sd-update__actions').exists()).toBe(false)
    })

    it('AC4b / AC7：macOS（download-page）⇒ unsupported 态 + 一行原因 + 唯一动作（primary）', async () => {
        await setUpdate({
            state: 'unsupported',
            installMode: 'download-page',
            degradedReason: 'mac'
        })
        const view = mountPanel()
        expect(r2(view).attributes('data-update-state')).toBe('unsupported')
        expect(r2(view).attributes('data-update-platform-degraded')).toBe('true')
        expect(text(view)).toContain('当前安装方式不支持应用内更新')
        expect(text(view)).toContain('macOS 版需要从下载页安装新版本')
        // 无任何原地更新路径（AC7：不出现「立即更新」/ 下载按钮）
        expect(action(view, 'download').exists()).toBe(false)
        expect(text(view)).not.toContain('立即更新')
        const open = action(view, 'open-download-page')
        expect(open.exists()).toBe(true)
        expect(open.classes()).toContain('nue-button--primary')
        await open.trigger('click')
        expect(mocks.openDownloadPage).toHaveBeenCalledTimes(1)
    })

    it('AC4b：deb 形态 ⇒ 专属原因文案', async () => {
        await setUpdate({
            state: 'unsupported',
            installMode: 'download-page',
            degradedReason: 'deb'
        })
        const view = mountPanel()
        expect(text(view)).toContain('当前安装方式不支持应用内更新')
        expect(text(view)).toContain('deb 版由系统包管理')
    })

    it('AC4b：未打包开发态（dev）⇒ 专属原因，⛔ 不说成「deb 版由系统包管理」', async () => {
        await setUpdate({
            state: 'unsupported',
            installMode: 'download-page',
            degradedReason: 'dev'
        })
        const view = mountPanel()
        expect(text(view)).toContain('开发版没有可用的更新源')
        expect(text(view)).not.toContain('deb 版由系统包管理')
        expect(text(view)).not.toContain('macOS 版')
    })

    it('AC4b：形态判定不出（degradedReason 缺省）⇒ unknown 兜底句，⛔ 不留空行', async () => {
        await setUpdate({ state: 'unsupported', installMode: 'download-page' })
        const view = mountPanel()
        const hint = r2(view).find('.sd-row__hint')
        expect(hint.exists()).toBe(true)
        expect(hint.text()).toBe('这种安装方式的新版本要从下载页安装')
        // 不硬套具体形态的措辞
        expect(text(view)).not.toContain('macOS 版')
        expect(text(view)).not.toContain('deb 版由系统包管理')
        expect(text(view)).not.toContain('开发版')
    })

    it('AC4b：unsupported 态点 R1「检查更新」⇒ 仍可点、态与文案不变、⛔ 不绕道下载/重启/下载页', async () => {
        await setUpdate({
            state: 'unsupported',
            installMode: 'download-page',
            degradedReason: 'mac'
        })
        const view = mountPanel()
        const checkBtn = view.find('[data-setting-action="check-update"]')
        expect(checkBtn.attributes('disabled')).toBeUndefined()
        await checkBtn.trigger('click')
        // 面板层可观测面：只走「检查」这一条通道，不出现任何其他动作；
        // 「不发更新器请求」由内核用例（`checker.check` 调用数 = 0）负责
        expect(mocks.check).toHaveBeenCalledTimes(1)
        expect(mocks.download).not.toHaveBeenCalled()
        expect(mocks.restart).not.toHaveBeenCalled()
        expect(mocks.openDownloadPage).not.toHaveBeenCalled()
        expect(r2(view).attributes('data-update-state')).toBe('unsupported')
        expect(text(view)).toContain('当前安装方式不支持应用内更新')
    })

    it('原地可更新 ⇒ data-update-platform-degraded="false"', async () => {
        await setUpdate({ state: 'available', latestVersion: '1.21.0', updateAvailable: true })
        const view = mountPanel()
        expect(r2(view).attributes('data-update-platform-degraded')).toBe('false')
    })
})

describe('T737 · AC9 卡 A 数据护栏（判据 = 同步队列非空）', () => {
    const ready = (): Partial<DesktopUpdateStatus> => ({
        state: 'ready',
        latestVersion: '1.21.0',
        updateAvailable: true
    })

    it('队列非空 ⇒ 点「立即重启更新」先出护栏，且不立即安装', async () => {
        await setUpdate(ready())
        await setPendingCount(3)
        const view = mountPanel()
        await action(view, 'restart').trigger('click')
        await nextTick()

        const guard = view.find('.sd-update-guard')
        expect(guard.exists()).toBe(true)
        expect(guard.attributes('aria-label')).toBe('有改动还没同步')
        expect(guard.text()).toContain('还有 3 项改动等待同步')
        // 文案 A（软提示）：⛔ 不出现「失败」
        expect(guard.text()).not.toContain('失败')
        expect(mocks.restart).not.toHaveBeenCalled()
    })

    it('护栏「仍要更新」⇒ 二次确认后才安装重启', async () => {
        await setUpdate(ready())
        await setPendingCount(1)
        const view = mountPanel()
        await action(view, 'restart').trigger('click')
        await nextTick()

        await action(view, 'guard-anyway').trigger('click')
        // 二次确认 ⇒ 安装载荷带 force（主进程据此放行）
        expect(mocks.restart).toHaveBeenCalledTimes(1)
        expect(mocks.restart).toHaveBeenCalledWith(true)
        expect(view.find('.sd-update-guard').exists()).toBe(false)
    })

    it('护栏「取消」⇒ 不重启、已下载状态保留（仍为 ready）', async () => {
        await setUpdate(ready())
        await setPendingCount(2)
        const view = mountPanel()
        await action(view, 'restart').trigger('click')
        await nextTick()

        await action(view, 'guard-cancel').trigger('click')
        expect(mocks.restart).not.toHaveBeenCalled()
        expect(r2(view).attributes('data-update-state')).toBe('ready')
        expect(action(view, 'restart').exists()).toBe(true)
    })

    it('护栏「先同步再更新」⇒ 触发手动同步、不重启', async () => {
        await setUpdate(ready())
        await setPendingCount(4)
        const view = mountPanel()
        await action(view, 'restart').trigger('click')
        await nextTick()

        await action(view, 'guard-sync').trigger('click')
        expect(mocks.manualRun).toHaveBeenCalledTimes(1)
        expect(mocks.restart).not.toHaveBeenCalled()
    })

    it('⛔ 判据不是 failedCount：队列空 + failedCount>0 ⇒ 不弹护栏，直接重启安装', async () => {
        await setUpdate(ready())
        await setPendingCount(0, 5)
        const view = mountPanel()
        await action(view, 'restart').trigger('click')
        await nextTick()

        expect(view.find('.sd-update-guard').exists()).toBe(false)
        // 普通路径不带 force（主进程按自己的就绪判据执行）
        expect(mocks.restart).toHaveBeenCalledWith()
    })
})

describe('T737 · 无障碍与弱提示联动（AC12 / 设计稿 §8）', () => {
    it('状态行 live 区只挂阶段文案；progressbar 单独承载进度', async () => {
        await setUpdate({
            state: 'downloading',
            latestVersion: '1.21.0',
            updateAvailable: true,
            percent: 10
        })
        const view = mountPanel()
        const live = view.findAll('[aria-live]')
        expect(live).toHaveLength(1)
        expect(live[0]?.attributes('aria-live')).toBe('polite')
        expect(live[0]?.text()).not.toContain('%')
        expect(live[0]?.attributes('role')).toBe('status')
        // 状态文字节点 = 阶段文案（不含进度百分比）
        expect(stateNode(view).text()).toBe('正在下载更新…')
        expect(view.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('10')
    })

    it('符号 aria-hidden：语义全由文字 + 角色承担（去色后仍可辨）', async () => {
        await setUpdate({ state: 'up-to-date' })
        const view = mountPanel()
        const symbol = view.find('.sd-desktop-status__symbol')
        expect(symbol.attributes('aria-hidden')).toBe('true')
        // 符号不参与读屏，也不进 live 区文本
        expect(stateNode(view).text()).not.toContain('✓')
    })

    it('首帧未 loaded ⇒ 不挂 role="status"/aria-live（读屏不得提前播报）', async () => {
        mocks.updateLoaded.value = false
        await setUpdate({ state: 'up-to-date' })
        const view = mountPanel()
        expect(stateNode(view).exists()).toBe(false)
        expect(view.find('.sd-desktop-status .sd-row__label').attributes('role')).toBeUndefined()
        expect(view.find('.sd-desktop-status .sd-row__label').attributes('aria-live')).toBe('off')
    })

    it('看到可用更新 ⇒ 通知 hook 记「已看过」（清侧栏弱提示）', async () => {
        await setUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        mountPanel()
        await nextTick()
        expect(mocks.markSeen).toHaveBeenCalled()
    })
})

describe('T747 · 版式契约（v4 行语言 / 不可点 / token）', () => {
    it('行样式逐条取自任务列表 `--small` 变体（底 -100 / 圆角 6 / 行高 ≥40 / 8-12 内边距）', () => {
        const body = ruleBody('.sd-update__row')
        expect(body).toContain('background-color: var(--nue-primary-color-100)')
        expect(body).toContain('border-radius: var(--nue-primary-radius)')
        expect(body).toContain('min-height: var(--nue-box-size-md)')
        expect(body).toContain('border: 1px solid transparent')
        // `-1px` 抵消边框 ⇒ 行内文字与组头/既有行左缘同线（≤0.5px，真机实测见回执）
        expect(body).toContain('padding: var(--nue-padding-xs) calc(var(--nue-padding-sm) - 1px)')
        // 行距 = 任务列表行距 0.5rem
        expect(ruleBody('.sd-update__list')).toContain('gap: var(--nue-gap-xs)')
    })

    it('⛔ 整行不可点：行规则无 cursor，行标签无 click 绑定', async () => {
        const base = ruleBody('.sd-update__row')
        const hover = ruleBody('.sd-update__row:hover')
        const narrow = ruleBody('.sd-body.is-narrow .sd-update__row')
        // 手型光标 = 承诺可点（设计稿 §3 / §7）⇒ 三条行规则里都不许出现 cursor
        for (const [name, body] of [
            ['.sd-update__row', base],
            ['.sd-update__row:hover', hover],
            ['.sd-body.is-narrow .sd-update__row', narrow]
        ] as const) {
            expect(body, `${name} 不应声明 cursor（手型 = 假 affordance）`).not.toContain('cursor')
        }
        // hover 只表达「可操作的块」（描边），不接管点击
        expect(hover).toContain('border-color: var(--nue-primary-color-500)')
        // 模板：两条行标签上都没有 click 绑定
        for (const needle of [
            "'sd-update__row': isDesktopUpdater",
            'sd-row sd-row--stack sd-update__row'
        ]) {
            const tag = tagAround(needle)
            expect(tag, `行标签不应绑定点击：${tag}`).not.toContain('@click')
            expect(tag).not.toContain('tabindex')
            expect(tag).not.toContain('role="button"')
        }

        // 运行时：点行本身不触发任何通道（行不是按钮）
        await setUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        await r2(view).trigger('click')
        await nextTick()
        expect(mocks.download).not.toHaveBeenCalled()
        expect(mocks.restart).not.toHaveBeenCalled()
        expect(mocks.check).not.toHaveBeenCalled()
        expect(mocks.openDownloadPage).not.toHaveBeenCalled()
    })

    it('行底上的 hint 取 -700（6.77 ✓），⛔ 不用 -600（压 -100 只有 4.60）', () => {
        const body = ruleBody('.sd-update__row .sd-row__hint')
        expect(body).toContain('color: var(--nue-primary-color-700)')
        expect(body).not.toContain('--nue-secondary-text-color')
        // 全块（含组头 / 状态色）不留 -600 的 hint 覆写
        expect(panelNoComments).not.toMatch(
            /\.sd-update__row[^{]*\{[^}]*--nue-secondary-text-color/
        )
    })

    it('控件回归组件原生档：⛔ 30px 覆写、⛔ 动作区 min-width、⛔ ghost / `.sd-row__action` 上桌面行', () => {
        const style = panelNoComments.slice(panelNoComments.indexOf('<style'))
        expect(style).not.toContain('height: 30px')
        expect(style).not.toContain('container-type')
        // v3 的动作区占位宽已撤回（不跳位改由「文字恒左 / 首行恒 40px」保证）
        expect(ruleBody('.sd-update__actions')).not.toContain('min-width')
        // 桌面行内按钮只走 primary / secondary（ghost 与 -100 行底同底 ⇒ 零反馈）
        const actionsTag = tagAround('class="sd-update__actions"')
        expect(actionsTag).not.toContain('ghost')
        // 状态行（R2）不出现 `.sd-row__action`（-100 底与行底同色 ⇒ 按钮看不见）；ghost 全块禁用
        const r2Template = panelTemplate.slice(
            panelTemplate.indexOf('data-setting-id="update-status"'),
            panelTemplate.indexOf('卡 A')
        )
        expect(r2Template).not.toContain('sd-row__action')
        expect(r2Template).not.toContain('ghost')
    })
})