// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { NueButton, NueDialog, NueDiv, NueDropdown, NueText } from 'nue-ui'
import SyncStatusBar from '../sync-status-bar.vue'
import { bindRailBottomHost, unbindRailBottomHost } from '@/components/app/aside-v2/rail-host'
import { resetReadOnlyForTest } from '@nao-todo/presentation/offline'

/**
 * `T663` / `DEF-144` **触发源归因探针**（QA 自写）
 *
 * @description PM 要求分辨抖动源：「自动刷新后视图重载」还是「同步面板 `beginRun`」。
 *              本文件只测**面板一侧**：一轮同步运行（`beginRun` 清错误 + `syncing=true`
 *              → 阶段推进 → `endRun` 落定）期间，面板的**结构签名**（分区 tag+class 序列、
 *              分区标题、常显提示句）是否保持不变。视图一侧的抖动由
 *              `packages/presentation/task/components/view-adapters/__tests__/t663-def144-flicker-probe.test.ts`
 *              用真实渲染采样证明（修前 `refreshHandler` 非 silent ⇒ loading 分支出现）。
 *
 * 结论口径：若面板结构在整轮运行中不变 ⇒ 面板**不是**抖动源；抖动只来自「刷新把列表拖回加载态」。
 */

type MockSyncStatus = {
    syncing: boolean
    lastSyncAt: string | null
    mirrorPulledAt: string | null
    mirrorTruncated: boolean
    pendingCount: number
    failedCount: number
    preferenceFailedCount: number
    conflictCount: number
    droppedFieldCount: number
    paused: boolean
    lastError: string | null
}

const hooksMock = vi.hoisted(() => ({
    status: undefined as unknown,
    manualSyncing: undefined as unknown,
    loadedCount: undefined as unknown
}))

vi.mock('@/hooks', async () => {
    const { ref } = await import('vue')
    const empty = (): MockSyncStatus => ({
        syncing: false,
        lastSyncAt: null,
        mirrorPulledAt: null,
        mirrorTruncated: false,
        pendingCount: 0,
        failedCount: 0,
        preferenceFailedCount: 0,
        conflictCount: 0,
        droppedFieldCount: 0,
        paused: false,
        lastError: null
    })
    const status = ref<MockSyncStatus>(empty())
    const manualSyncing = ref(false)
    const loadedCount = ref(0)
    const conflict = {
        items: ref([]),
        folded: ref(false),
        foldedReason: ref(null),
        loading: ref(false),
        error: ref(null),
        comparison: ref(null),
        titles: ref({}),
        retryFailed: false,
        refresh: vi.fn(async () => {}),
        compare: vi.fn(async () => {}),
        keepServer: vi.fn(async () => {}),
        retryLocal: vi.fn(async () => {})
    }
    hooksMock.status = status
    hooksMock.manualSyncing = manualSyncing
    hooksMock.loadedCount = loadedCount
    return {
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: manualSyncing, run: vi.fn() }),
        useMirrorLoadedCount: () => loadedCount,
        useConflictUx: () => conflict
    }
})

/** jsdom 无 ResizeObserver（nue-dropdown 透明模式在 mounted 内 new） */
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
)

const status = (): Ref<MockSyncStatus> => hooksMock.status as Ref<MockSyncStatus>

let wrapper: VueWrapper | null = null

const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
}

const panel = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('.nue-dropdown--sync-panel')

/** 面板结构签名：分区 tag+class 全序列（高度/分区增删都会改这个序列） */
const structureSignature = (): string[] =>
    Array.from(panel()?.querySelectorAll<HTMLElement>(':scope > li') ?? []).map(
        (el) => `${el.tagName.toLowerCase()}.${el.className}`
    )

const sectionTitles = (): string[] =>
    Array.from(panel()?.querySelectorAll<HTMLElement>('.sync-panel__section-title') ?? []).map(
        (el) => (el.firstChild?.textContent ?? '').trim()
    )

const openPanel = async (): Promise<void> => {
    const host = document.createElement('div')
    host.id = 'AppAsideRailBottomSlot'
    document.body.appendChild(host)
    bindRailBottomHost(host)
    wrapper = mount(SyncStatusBar, {
        attachTo: document.body,
        global: {
            components: {
                'nue-button': NueButton,
                'nue-dialog': NueDialog,
                'nue-div': NueDiv,
                'nue-dropdown': NueDropdown,
                'nue-text': NueText
            }
        }
    })
    await settle()
    document
        .querySelector<HTMLButtonElement>('.sync-rail-btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
    expect(panel(), '前置：面板应已展开').toBeTruthy()
}

beforeEach(() => {
    status().value = {
        syncing: false,
        lastSyncAt: null,
        mirrorPulledAt: null,
        mirrorTruncated: false,
        pendingCount: 0,
        failedCount: 0,
        preferenceFailedCount: 0,
        conflictCount: 0,
        droppedFieldCount: 0,
        paused: false,
        lastError: null
    }
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

describe('T663 / DEF-144 触发源归因 · 同步面板在一轮运行中结构不变', () => {
    it('健康常态下一轮运行（beginRun→endRun）：分区签名 / 标题 / 常显句全不变', async () => {
        await openPanel()
        status().value = {
            ...status().value,
            lastSyncAt: '2026-11-06T10:00:00.000Z',
            mirrorPulledAt: '2026-11-06T09:59:30.000Z'
        }
        await nextTick()
        const before = {
            signature: structureSignature(),
            titles: sectionTitles(),
            text: panel()?.textContent ?? ''
        }
        console.log(
            '[T663/probeD] 运行前 =',
            JSON.stringify({ signature: before.signature, titles: before.titles })
        )

        // 一轮自动刷新（数据层：beginRun 清错误 + syncing=true）
        status().value = { ...status().value, syncing: true, lastError: null }
        await nextTick()
        const during = { signature: structureSignature(), titles: sectionTitles() }
        console.log('[T663/probeD] 运行中 =', JSON.stringify(during))

        // endRun 落定
        status().value = {
            ...status().value,
            syncing: false,
            lastSyncAt: '2026-11-06T10:00:30.000Z',
            mirrorPulledAt: '2026-11-06T10:00:30.000Z'
        }
        await nextTick()
        const after = { signature: structureSignature(), titles: sectionTitles() }
        console.log('[T663/probeD] 运行后 =', JSON.stringify(after))

        expect(during.signature, '运行开始不得增删分区').toEqual(before.signature)
        expect(after.signature, '运行结束不得增删分区').toEqual(before.signature)
        expect(during.titles).toEqual(before.titles)
        expect(after.titles).toEqual(before.titles)
        expect(panel()?.textContent, '常态提示句应常显（DEF-138 不回归）').toContain('数据已是最新')
    })

    it('失败态一轮运行：错误分区在运行开始/结束都不消失（不得忽隐忽现）', async () => {
        await openPanel()
        status().value = {
            ...status().value,
            mirrorPulledAt: '2026-11-06T09:59:30.000Z',
            lastError: '拉取失败：网络错误'
        }
        await nextTick()
        const before = structureSignature()
        expect(before.some((el) => el.includes('sync-panel__section'))).toBe(true)

        status().value = { ...status().value, syncing: true, lastError: null }
        await nextTick()
        expect(structureSignature(), 'beginRun 清错误后分区不得消失').toEqual(before)

        status().value = { ...status().value, syncing: false, lastError: '拉取失败：网络错误' }
        await nextTick()
        expect(structureSignature(), 'endRun 报错后分区数量不增不减').toEqual(before)
    })
})