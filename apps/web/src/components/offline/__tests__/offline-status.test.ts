// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { type Ref } from 'vue'
import { NueText } from 'nue-ui'
import OfflineStatus from '../offline-status.vue'

/**
 * 离线/镜像状态条断言（C-60 文案三分 / AC8 / AC9）
 * @description AC8：离线 + 有镜像 ⇒ 显示「数据截至 X」；AC9：离线 + 无镜像 ⇒ **引导联网**，
 *              **不得**呈现为「数据丢失」。负向断言：文案**不得**出现 `null` / `Invalid Date` / `1970`。
 */

const mocks = vi.hoisted(() => ({
    isOffline: undefined as unknown,
    mirrorPulledAt: undefined as unknown,
    mirrorTruncated: undefined as unknown,
    syncing: undefined as unknown
}))

vi.mock('../use-mirror-status', async () => {
    const { computed, ref } = await import('vue')
    const isOffline = ref(false)
    const mirrorPulledAt = ref<string | null>(null)
    const mirrorTruncated = ref(false)
    const syncing = ref(false)
    mocks.isOffline = isOffline
    mocks.mirrorPulledAt = mirrorPulledAt
    mocks.mirrorTruncated = mirrorTruncated
    mocks.syncing = syncing
    return {
        useMirrorStatus: () => ({
            isOffline,
            mirrorPulledAt: computed(() => mirrorPulledAt.value),
            mirrorTruncated: computed(() => mirrorTruncated.value),
            syncing
        })
    }
})

const offline = (): Ref<boolean> => mocks.isOffline as Ref<boolean>
const pulledAt = (): Ref<string | null> => mocks.mirrorPulledAt as Ref<string | null>
const truncated = (): Ref<boolean> => mocks.mirrorTruncated as Ref<boolean>
const syncing = (): Ref<boolean> => mocks.syncing as Ref<boolean>

let wrapper: VueWrapper | null = null

const mountStatus = (): VueWrapper => {
    wrapper = mount(OfflineStatus, {
        global: { components: { 'nue-text': NueText } }
    })
    return wrapper
}

const text = (): string => wrapper?.text() ?? ''

beforeEach(() => {
    offline().value = false
    pulledAt().value = null
    truncated().value = false
    syncing().value = false
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('OfflineStatus - C-60 文案三分', () => {
    it('AC8：离线 + 有镜像 ⇒「离线模式 · 数据截至 X」+「可能不是最新」；负向无 null/1970', async () => {
        offline().value = true
        pulledAt().value = '2026-09-23T07:30:00.000Z'
        mountStatus()
        await wrapper!.vm.$nextTick()

        const t = text()
        expect(t).toContain('离线模式 · 数据截至')
        expect(t).toContain('可能不是最新')
        expect(t).not.toContain('null')
        expect(t).not.toContain('Invalid Date')
        expect(t).not.toContain('1970')
    })

    it('AC9：离线 + 无镜像 ⇒ 引导联网；不得显示「截至」或「数据丢失」', async () => {
        offline().value = true
        pulledAt().value = null
        mountStatus()
        await wrapper!.vm.$nextTick()

        const t = text()
        expect(t).toContain('尚未同步完成，数据可能不完整')
        expect(t).toContain('请连接网络后重试')
        expect(t).not.toContain('数据截至')
        expect(t).not.toContain('数据丢失')
        expect(t).not.toContain('null')
        expect(t).not.toContain('1970')
    })

    it('在线 ⇒「已更新」且不显示时间', async () => {
        offline().value = false
        pulledAt().value = '2026-09-23T07:30:00.000Z'
        mountStatus()
        await wrapper!.vm.$nextTick()

        const t = text()
        expect(t).toContain('已更新')
        expect(t).not.toContain('数据截至')
    })

    it('覆盖度：未扫完（瞬态）与触顶（常驻）为两条独立提示，不合并', async () => {
        offline().value = true
        pulledAt().value = '2026-09-23T07:30:00.000Z'
        syncing().value = true
        truncated().value = true
        mountStatus()
        await wrapper!.vm.$nextTick()

        const t = text()
        expect(t).toContain('正在加载更多…')
        expect(t).toContain('同步上限')
        // 两条独立文本节点（不合并成一条）
        expect(t.indexOf('正在加载更多…')).not.toBe(t.indexOf('同步上限'))
    })

    it('触顶且提供上限 N ⇒ 参数化文案「任务超过 N 条，仅显示前 N 条」', async () => {
        offline().value = true
        truncated().value = true
        wrapper = mount(OfflineStatus, {
            props: { truncatedLimit: 200 },
            global: { components: { 'nue-text': NueText } }
        })
        await wrapper.vm.$nextTick()

        expect(text()).toContain('任务超过 200 条，仅显示前 200 条')
    })
})