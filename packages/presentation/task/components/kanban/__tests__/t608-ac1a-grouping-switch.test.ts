// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import {
    clickSegment,
    columnNodes,
    controlOf,
    GROUP_BY_LABELS,
    headerText,
    makeTask,
    mountKanban,
    segmentNode,
    selectedState,
    stateLabel
} from './t608-kanban-harness'

/**
 * T608 AC1a —— 看板「分组切换」入口（`DEF-114` · PRD `2026-10-31-kanban-priority-grouping.md`）
 *
 * @description 背景：PRD §一.1 原写「看板有『按优先级分组』选项」，实测**用户侧零入口**
 *              （`getKanbanColumns` 唯一调用点 = `kanban.vue` 的 `onMounted(() => getKanbanColumns())`
 *              恒落默认 `state`）⇒ PM `T608` 裁定 **A 方案：本批补入口**。本文件锁入口与默认值。
 *
 * 断言口径（PM A 规格）：
 *   - 两段文案「按状态」/「按优先级」，各自落在**可点击控件**（`button` / `role=tab` / `aria-pressed`）；
 *   - **选中态可辨识**：`aria-pressed` 或 `aria-selected`，且恰好一个为 true（不能只靠背景色）；
 *   - **默认 = 按状态**（与改动前一致）；
 *   - 切换后选中态跟随，且可切回（防单向接线）。
 *
 * **接缝假设**：入口在 `TaskKanban` 内部（看板容器顶部一行）。若实现放到
 * `kanban-view-adapter.vue`，须先与 QA 对齐接缝后再改用例（见 harness 文件头）。
 *
 * 状态：**红**（AC1a ①②③ 全红 —— 控件不存在 ⇒ `MissingImplementationError`）；
 *       AC1a ④ 的前半（默认三列）当前**绿**（回归护栏），切换部分随入口一起红。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountWith = () => {
    const harness = mountKanban([
        makeTask({ id: 't-todo', state: 'todo', priority: 'medium' }),
        makeTask({ id: 't-doing', state: 'in-progress', priority: 'high' }),
        makeTask({ id: 't-done', state: 'done', priority: 'low' })
    ])
    wrapper = harness.wrapper
    return harness
}

describe('T608 AC1a · 分组切换入口存在且语义可辨识', () => {
    it('AC1a① 两段文案「按状态」/「按优先级」均渲染，且都在可点击控件内并带选中态语义', () => {
        const { wrapper: w } = mountWith()

        for (const label of Object.values(GROUP_BY_LABELS)) {
            const node = segmentNode(w, label)
            const control = controlOf(node)
            expect(
                control,
                `「${label}」不在可点击控件（button / role=tab / aria-pressed）内：` +
                    `实际 ${node.element.outerHTML}`
            ).not.toBeNull()
            // 选中态必须能被辅助技术读出（不能只靠背景色）
            expect(
                selectedState(node),
                `「${label}」缺 aria-pressed / aria-selected ⇒ 选中态不可辨识：${control?.outerHTML}`
            ).not.toBeNull()
        }
    })

    it('AC1a② 恰好一个分段处于选中态（互斥）', () => {
        const { wrapper: w } = mountWith()
        const values = Object.values(GROUP_BY_LABELS).map((label) =>
            selectedState(segmentNode(w, label))
        )
        expect(values, `实测选中态 = ${JSON.stringify(values)}`).toContain('true')
        expect(values.filter((v) => v === 'true').length, `实测 = ${JSON.stringify(values)}`).toBe(
            1
        )
        expect(values.every((v) => v === 'true' || v === 'false')).toBe(true)
    })

    it('AC1a③ 默认选中「按状态」（刷新回默认，PRD §三 非范围：不持久化）', () => {
        const { wrapper: w } = mountWith()
        expect(selectedState(segmentNode(w, GROUP_BY_LABELS.state)), '默认应为「按状态」选中').toBe(
            'true'
        )
        expect(selectedState(segmentNode(w, GROUP_BY_LABELS.priority))).toBe('false')
    })

    it('AC1a④ 默认仍按状态分组（回归护栏）：3 列 + 列头为状态名', () => {
        const { wrapper: w } = mountWith()
        expect(columnNodes(w).map((n) => n.attributes('data-category'))).toEqual([
            'todo',
            'in-progress',
            'done'
        ])
        const headers = columnNodes(w).map(headerText)
        expect(
            headers.some((text) => text.includes(stateLabel('todo'))),
            `列头 ${JSON.stringify(headers)}`
        ).toBe(true)
    })

    it('AC1a⑤ 切换后选中态跟随，且可切回（防单向接线）', async () => {
        const { wrapper: w } = mountWith()

        await clickSegment(w, 'priority')
        expect(
            selectedState(segmentNode(w, GROUP_BY_LABELS.priority)),
            '切到优先级后「按优先级」应选中'
        ).toBe('true')
        expect(selectedState(segmentNode(w, GROUP_BY_LABELS.state))).toBe('false')

        await clickSegment(w, 'state')
        expect(selectedState(segmentNode(w, GROUP_BY_LABELS.state))).toBe('true')
        // 切回后列头恢复状态名（不是优先级标签）
        const headers = columnNodes(w).map(headerText)
        expect(
            headers.some((text) => text.includes(stateLabel('todo'))),
            `切回后列头实测 = ${JSON.stringify(headers)}`
        ).toBe(true)
    })

    it('AC1a⑥ 切分组不写任何偏好存储（PRD R7：刷新回默认）', async () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
        const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
        const clear = vi.spyOn(Storage.prototype, 'clear')
        // 键值快照：直写属性（`localStorage.foo = x`）不一定经过 `setItem`，故以内容对账兜底
        const dump = (storage: Storage): string =>
            JSON.stringify(
                Array.from({ length: storage.length }, (_, index) => storage.key(index))
                    .map((key) => [key, storage.getItem(key as string)] as const)
                    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            )
        const before = `${dump(localStorage)}|${dump(sessionStorage)}`

        const { wrapper: w } = mountWith()
        await clickSegment(w, 'priority')
        await clickSegment(w, 'state')

        const writes = {
            setItem: setItem.mock.calls,
            removeItem: removeItem.mock.calls,
            clear: clear.mock.calls
        }
        expect(writes, `分组切换不得写偏好存储（R7）：实测 ${JSON.stringify(writes)}`).toEqual({
            setItem: [],
            removeItem: [],
            clear: []
        })
        expect(
            `${dump(localStorage)}|${dump(sessionStorage)}`,
            '分组切换前后 local/sessionStorage 内容须逐字不变（R7）'
        ).toBe(before)
        vi.restoreAllMocks()
    })
})