// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import RecordList from '../record-list.vue'

/**
 * T451 PomodoroRecordList 侧栏化改造
 * @description ① `hideHeader`（默认 false）⇒ 侧栏用 true 避免与 NueCollapse 标题重复，默认路径不变；
 *              ② 加载/空态改用 `LoadingError`（本仓硬约束：不自绘）。
 */

const mountList = (props: {
    records?: unknown[]
    loading?: boolean
    disabledNextPage?: boolean
    hideHeader?: boolean
}): VueWrapper =>
    mount(RecordList, {
        props: {
            records: (props.records ?? []) as never,
            loading: props.loading ?? false,
            disabledNextPage: props.disabledNextPage ?? false,
            ...(props.hideHeader === undefined ? {} : { hideHeader: props.hideHeader })
        },
        global: { stubs: { RecordListItem: true } }
    })

const loadingError = (w: VueWrapper) => w.findComponent({ name: 'LoadingError' })

describe('T451 PomodoroRecordList', () => {
    it('默认（hideHeader 未传）⇒ 渲染内置「今日专注」标题（默认路径观感不变）', () => {
        const w = mountList({})
        const header = w.find('[theme="header"]')
        expect(header.exists()).toBe(true)
        expect(header.text()).toContain('今日专注')
        w.unmount()
    })

    it('hideHeader=true ⇒ 不渲染内置标题（避免与 collapse 标题重复）', () => {
        const w = mountList({ hideHeader: true })
        expect(w.find('[theme="header"]').exists()).toBe(false)
        w.unmount()
    })

    it('空态走 LoadingError（empty=true + 文案），不自绘', () => {
        const w = mountList({ records: [], loading: false })
        const le = loadingError(w)
        expect(le.exists()).toBe(true)
        expect(le.props('empty')).toBe(true)
        expect(le.props('loading')).toBe(false)
        expect(le.props('emptyMessage')).toBe('暂无专注记录')
        expect(w.find('.nue-div--empty').exists()).toBe(false)
        w.unmount()
    })

    it('首屏加载走 LoadingError（loading=true）；已有数据时不再显示 loading 态', () => {
        const empty = mountList({ records: [], loading: true })
        expect(loadingError(empty).props('loading')).toBe(true)
        expect(loadingError(empty).props('empty')).toBe(false)
        empty.unmount()

        const withData = mountList({ records: [{ id: 'r1' }], loading: true })
        expect(loadingError(withData).props('loading')).toBe(false)
        expect(loadingError(withData).props('empty')).toBe(false)
        withData.unmount()
    })
})