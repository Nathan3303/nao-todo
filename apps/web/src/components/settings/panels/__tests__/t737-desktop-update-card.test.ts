// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import { nueUI } from '@/nue-ui-register'
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import DataPanel from '../data-panel.vue'

/**
 * T737 · 桌面端「关于与更新」卡 + 卡 A 数据护栏（PRD `docs/prds/2026-11-20-desktop-self-update.md`）
 *
 * 钩子契约（唯一事实来源 = 设计稿 §9；RD 必须按名实现）：
 * - R2 根：`data-setting-id="update-status"` + `data-update-state="<八态字面量>"`
 *   + `data-update-platform-degraded="true|false"`
 * - R1：保留 `data-setting-id="version"` + `data-setting-action="check-update"`
 * - 动作：`data-update-action="download|restart|later|retry|open-download-page"`
 *   + 卡 A `data-update-action="guard-sync|guard-anyway|guard-cancel"`
 *
 * 覆盖 AC：AC1（版本 + 有新版本）· AC4/AC5（失败三阶段 + 重试）· AC6（已是最新无主按钮）·
 * AC7（平台降级 = 动作替换）· AC9（卡 A 判据 = 队列非空）· AC10（Web 零外溢）·
 * AC11（失败后按钮可再点）· AC12（符号 + 文字 + 色三冗余 / 进度 aria）· AC13（i18n 双键在 locale 用例）
 *
 * 说明：本文件用 **hook 假状态注入**（`@/hooks/use-desktop-updater` mock）驱动八态；
 *       真 bridge 接线由 `apps/desktop/.../__tests__/t737-use-desktop-updater.test.ts` 承担。
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

const r2 = (view: VueWrapper) => view.find('[data-setting-id="update-status"]')

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

describe('T737 · AC10 Web 端零外溢（整块不渲染，版本行逐字不变）', () => {
    beforeEach(() => {
        mocks.isDesktop.value = false
    })

    it('Web：无更新卡、无状态行、无卡 A（节点数 0）', () => {
        const view = mountPanel()
        expect(view.find('.sd-update').exists()).toBe(false)
        expect(r2(view).exists()).toBe(false)
        expect(view.find('[data-update-action]').exists()).toBe(false)
        expect(view.findAll('[data-setting-id="update-status"]')).toHaveLength(0)
    })

    it('Web：版本行仍是「版本号 + 查看更新」外链（锚点与动作名不变）', () => {
        const view = mountPanel()
        const row = view.find('[data-setting-id="version"]')
        expect(row.exists()).toBe(true)
        expect(row.classes()).toContain('sd-row')
        // 测试环境无构建注入版本 ⇒ 文案为「版本号 」空串（与既有行为一致）
        expect(row.text()).toContain('版本号')
        expect(row.find('[data-setting-action="check-update"]').exists()).toBe(true)
        // 行内按钮仍是旧的原生 button + 外链文案（不是桌面卡的 nue-button）
        expect(row.html()).toContain('查看更新')
        expect(row.find('button.sd-row__action').exists()).toBe(true)
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

describe('T737 · AC1 桌面端 R1 版本行（永不被状态替换）', () => {
    it('R1 保留 data-setting-id="version" + data-setting-action="check-update"，显示当前版本', () => {
        const view = mountPanel()
        const r1 = view.find('[data-setting-id="version"]')
        expect(r1.exists()).toBe(true)
        expect(r1.text()).toContain('当前版本 1.20.3')
        expect(r1.find('[data-setting-action="check-update"]').exists()).toBe(true)
    })

    it('never-checked：无「上次检查」行，idle 文案给引导语', () => {
        const view = mountPanel()
        expect(text(view)).not.toContain('上次检查')
        expect(r2(view).attributes('data-update-state')).toBe('idle')
        expect(text(view)).toContain('还没检查过更新')
    })

    it('有 lastCheckedAt ⇒ R1 显示上次检查时间', async () => {
        await setUpdate({ lastCheckedAt: '2026-11-20T07:30:00.000Z' })
        const view = mountPanel()
        expect(text(view)).toContain('上次检查')
    })

    it('检查按钮点击 ⇒ 调 check()（手动检查忽略缓存）', async () => {
        const view = mountPanel()
        await view.find('[data-setting-action="check-update"]').trigger('click')
        expect(mocks.check).toHaveBeenCalledTimes(1)
    })
})

describe('T737 · 八态渲染（data-update-state 字面量 + 三冗余）', () => {
    const cases: Array<{
        state: DesktopUpdateStatus['state']
        symbol: string
        tone: string
        copy: string
        patch?: Partial<DesktopUpdateStatus>
    }> = [
        { state: 'idle', symbol: '–', tone: 'muted', copy: '还没检查过更新' },
        { state: 'checking', symbol: '', tone: '', copy: '正在检查更新' },
        {
            state: 'available',
            symbol: '↑',
            tone: 'warning',
            copy: '有新版本 1.21.0',
            patch: { latestVersion: '1.21.0', updateAvailable: true }
        },
        {
            state: 'downloading',
            symbol: '…',
            tone: 'muted',
            copy: '正在下载更新',
            patch: { latestVersion: '1.21.0', updateAvailable: true, percent: 42 }
        },
        {
            state: 'ready',
            symbol: '↓',
            tone: 'success',
            copy: '更新已就绪',
            patch: { latestVersion: '1.21.0', updateAvailable: true }
        },
        { state: 'up-to-date', symbol: '✓', tone: 'success', copy: '已是最新 1.20.3' },
        {
            state: 'just-updated',
            symbol: '✓',
            tone: 'success',
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
                // checking：动作级加载态走 LoadingError（DESIGN §4.1 已登记口径）
                expect(view.findComponent(LoadingError).exists()).toBe(true)
                expect(text(view)).not.toContain('还没检查过更新')
                return
            }
            const symbol = view.find('.sd-update__symbol')
            expect(symbol.text()).toBe(item.symbol)
            expect(symbol.classes()).toContain(`is-${item.tone}`)
            expect(view.find('.sd-update__state').classes()).toContain(`is-${item.tone}`)
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

    it('ready：主「立即重启更新」+ 次「稍后」；点「稍后」只去掉稍后、文案不变', async () => {
        await setUpdate({
            state: 'ready',
            latestVersion: '1.21.0',
            updateAvailable: true
        })
        const view = mountPanel()
        expect(text(view)).toContain('更新已就绪')
        expect(action(view, 'restart').exists()).toBe(true)
        expect(action(view, 'later').exists()).toBe(true)

        await action(view, 'later').trigger('click')
        expect(action(view, 'later').exists()).toBe(false)
        expect(text(view)).toContain('更新已就绪')
        expect(action(view, 'restart').exists()).toBe(true)
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

    it('failed（检查）⇒ 可读原因 + 重试 + 打开下载页，且不得出现「已是最新」', async () => {
        await setUpdate({
            state: 'failed',
            failure: { stage: 'check', reason: 'offline' }
        })
        const view = mountPanel()
        expect(text(view)).toContain('没能检查更新')
        expect(text(view)).toContain('当前没有网络连接')
        expect(text(view)).not.toContain('已是最新')
        expect(action(view, 'retry').exists()).toBe(true)
        expect(action(view, 'open-download-page').exists()).toBe(true)

        await action(view, 'retry').trigger('click')
        expect(mocks.check).toHaveBeenCalledTimes(1)
        expect(mocks.download).not.toHaveBeenCalled()
    })

    it('failed（下载 / 校验）⇒ 重试走重新下载（AC5）', async () => {
        await setUpdate({
            state: 'failed',
            failure: { stage: 'download', reason: 'timeout' }
        })
        const view = mountPanel()
        expect(text(view)).toContain('下载没完成')
        await action(view, 'retry').trigger('click')
        expect(mocks.download).toHaveBeenCalledTimes(1)
        expect(mocks.check).not.toHaveBeenCalled()
    })

    it('failed（校验未过）⇒ 单列文案，不写内部术语', async () => {
        await setUpdate({
            state: 'failed',
            failure: { stage: 'verify', reason: 'unknown' }
        })
        const view = mountPanel()
        expect(text(view)).toContain('更新包校验没通过')
        expect(text(view)).not.toContain('sha512')
    })

    it('AC11：失败态关闭提示后仍可再检查（按钮不永久禁用）', async () => {
        await setUpdate({ state: 'failed', failure: { stage: 'check', reason: 'server' } })
        const view = mountPanel()
        await action(view, 'retry').trigger('click')

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

describe('T737 · AC6 / AC7 边界', () => {
    it('AC6：已是最新 ⇒ 无任何主按钮（不出现「立即更新」）', async () => {
        await setUpdate({ state: 'up-to-date' })
        const view = mountPanel()
        expect(text(view)).toContain('已是最新 1.20.3')
        expect(action(view, 'download').exists()).toBe(false)
        expect(action(view, 'restart').exists()).toBe(false)
        expect(action(view, 'retry').exists()).toBe(false)
    })

    it('AC7：macOS 降级 ⇒ 动作替换为「打开下载页」+ 一行原因，无「立即更新」', async () => {
        await setUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            updateAvailable: true,
            installMode: 'download-page',
            degradedReason: 'mac'
        })
        const view = mountPanel()
        expect(r2(view).attributes('data-update-platform-degraded')).toBe('true')
        expect(action(view, 'download').exists()).toBe(false)
        expect(text(view)).toContain('macOS 版需要从下载页安装新版本')
        const open = action(view, 'open-download-page')
        expect(open.exists()).toBe(true)
        await open.trigger('click')
        expect(mocks.openDownloadPage).toHaveBeenCalledTimes(1)
    })

    it('AC7：deb 降级 ⇒ 专属原因文案', async () => {
        await setUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            updateAvailable: true,
            installMode: 'download-page',
            degradedReason: 'deb'
        })
        const view = mountPanel()
        expect(text(view)).toContain('deb 版由系统包管理')
    })

    it('降级但无法判定具体系统（如开发态 win32）⇒ 不硬套 mac/deb 原因文案', async () => {
        await setUpdate({
            state: 'available',
            latestVersion: '1.21.0',
            updateAvailable: true,
            installMode: 'download-page'
        })
        const view = mountPanel()
        expect(r2(view).attributes('data-update-platform-degraded')).toBe('true')
        expect(action(view, 'download').exists()).toBe(false)
        expect(action(view, 'open-download-page').exists()).toBe(true)
        expect(text(view)).not.toContain('macOS 版需要从下载页安装新版本')
        expect(text(view)).not.toContain('deb 版由系统包管理')
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
        expect(guard.text()).toContain('3')
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
        // 普通路径不带 force（主进程按自己的就绪判定执行）
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
        expect(view.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('10')
    })

    it('首帧未 loaded ⇒ 不挂 role="status"/aria-live（读屏不得提前播报）', async () => {
        mocks.updateLoaded.value = false
        await setUpdate({ state: 'up-to-date' })
        const view = mountPanel()
        const state = view.find('.sd-update__state')
        expect(state.attributes('role')).toBeUndefined()
        expect(state.attributes('aria-live')).toBe('off')
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