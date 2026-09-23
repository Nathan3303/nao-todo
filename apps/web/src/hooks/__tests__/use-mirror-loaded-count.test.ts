// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

/**
 * 触顶文案 N：镜像实际已加载行数（AC13b / PM 裁定）
 * @description N = 当前用户 `tasks` 表实际行数（**不得**取固定上限 / 服务端 Total）。
 *              未触顶 ⇒ 不查库、恒 0（组件退回通用文案）；订阅 syncStatus 后刷新。
 *              T115b：随 hook 移入 hooks；截断信号读 `syncStatus.get().mirrorTruncated`。
 */

const mocks = vi.hoisted(() => ({
    getCurrentUserId: vi.fn(),
    count: vi.fn(async () => 0),
    whereEq: vi.fn(),
    table: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    get: vi.fn(),
    mirrorTruncated: false
}))

vi.mock('@nao-todo/infrastructure', () => ({
    localSession: { getCurrentUserId: mocks.getCurrentUserId },
    localDatabase: { table: mocks.table },
    syncStatus: { get: mocks.get, subscribe: mocks.subscribe }
}))

const { countMirrorRows, useMirrorLoadedCount } = await import('../use-mirror-loaded-count')

beforeEach(() => {
    vi.clearAllMocks()
    mocks.mirrorTruncated = false
    mocks.get.mockImplementation(() => ({ mirrorTruncated: mocks.mirrorTruncated }))
    mocks.getCurrentUserId.mockReturnValue('u-1')
    mocks.count.mockResolvedValue(0)
    mocks.table.mockImplementation(() => ({
        where: (field: string) => ({
            equals: (value: string) => {
                mocks.whereEq(field, value)
                return { count: mocks.count }
            }
        })
    }))
    mocks.subscribe.mockReturnValue(mocks.unsubscribe)
})

describe('countMirrorRows - 实际加载数', () => {
    it('无会话 ⇒ 0，且不查库', async () => {
        mocks.getCurrentUserId.mockReturnValue(null)
        await expect(countMirrorRows()).resolves.toBe(0)
        expect(mocks.table).not.toHaveBeenCalled()
    })

    it('有会话 ⇒ 按 userId 过滤 tasks 表计数', async () => {
        mocks.count.mockResolvedValue(250)
        await expect(countMirrorRows()).resolves.toBe(250)
        expect(mocks.table).toHaveBeenCalledWith('tasks')
        expect(mocks.whereEq).toHaveBeenCalledWith('userId', 'u-1')
    })
})

describe('useMirrorLoadedCount - 触顶时刷新', () => {
    const TestComp = defineComponent({
        setup() {
            const count = useMirrorLoadedCount()
            return { count }
        },
        template: '<div>{{ count }}</div>'
    })

    it('未触顶 ⇒ 0 且不查库', async () => {
        mocks.mirrorTruncated = false
        const wrapper = mount(TestComp)
        await flushPromises()
        expect(wrapper.text()).toBe('0')
        expect(mocks.count).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('触顶 ⇒ 取实际行数渲染', async () => {
        mocks.mirrorTruncated = true
        mocks.count.mockResolvedValue(200)
        const wrapper = mount(TestComp)
        await flushPromises()
        expect(wrapper.text()).toBe('200')
        wrapper.unmount()
    })
})