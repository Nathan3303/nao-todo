// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import { TASK_PRIORITIES } from '@nao-todo/domain-task'
import {
    clickSegment,
    columnNode,
    columnNodes,
    headerText,
    makeTask,
    mountKanban,
    priorityLabel,
    stateLabel,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * T608 AC1b —— 按优先级分组后的**列头 / 列内容**（`DEF-114` 主路径）
 *
 * @description 改动前 `DEF-114` 三层 bug（本文件锁第 ①② 层）：
 *              ① 切到优先级分组 ⇒ 列过滤仍 `task.state === category` ⇒ **四列全空**；
 *              ② 列头仍 `<task-state-info :state="category" />` ⇒ 显示**状态名**（语义错）。
 *
 * 断言口径：
 *   - 列集合与顺序 = domain `TASK_PRIORITIES`（R1 单一来源，降序 紧急→低）；
 *   - 列头文本**实际渲染值**必须含该档优先级标签、且**不含任何状态标签**（抓的是渲染文本，不是 prop）；
 *   - 列内容按 `priority` 分流：同状态不同优先级的四张卡必须分落四列；
 *   - 切回状态分组 ⇒ 恢复 3 列 + 状态名（防单向接线）。
 *
 * **接缝假设**：入口在 `TaskKanban` 内部。若实现放到 `kanban-view-adapter.vue`，
 * 须先与 QA 对齐接缝（见 harness 文件头）。
 *
 * 状态：**红**（切入优先级后：列数/列头/列内容三项全红 —— 今日列过滤与列头都按 `state`）。
 *       「切回状态分组」当前**绿**（回归护栏）。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

/** 同状态、不同优先级 ⇒ 任何「按 state 过滤」的实现都过不了 */
const mountPriorityFixture = () => {
    const harness = mountKanban([
        makeTask({ id: 't-urgent', state: 'todo', priority: 'urgent' }),
        makeTask({ id: 't-high', state: 'todo', priority: 'high' }),
        makeTask({ id: 't-medium', state: 'done', priority: 'medium' }),
        makeTask({ id: 't-low', state: 'done', priority: 'low' })
    ])
    wrapper = harness.wrapper
    return harness
}

const PRIORITY_ORDER = [...TASK_PRIORITIES].reverse()
const STATE_LABELS = [stateLabel('todo'), stateLabel('in-progress'), stateLabel('done')]

describe('T608 AC1b · 优先分组：4 列 + 列头为优先级 + 内容按优先级', () => {
    it('AC1b① 切到「按优先级」⇒ 4 列，列集合与顺序 = domain 四档（紧急→低）', async () => {
        const { wrapper: w } = mountPriorityFixture()
        await clickSegment(w, 'priority')

        const categories = columnNodes(w).map((n) => n.attributes('data-category'))
        expect(categories, `实测列 = ${JSON.stringify(categories)}`).toEqual([...PRIORITY_ORDER])
    })

    it('AC1b② 列头实际渲染文本 = 优先级标签（不是状态名）', async () => {
        const { wrapper: w } = mountPriorityFixture()
        await clickSegment(w, 'priority')

        for (const priority of PRIORITY_ORDER) {
            const text = headerText(columnNode(w, priority))
            expect(
                text,
                `「${priority}」列头实测「${text}」未包含优先级标签「${priorityLabel(priority)}」`
            ).toContain(priorityLabel(priority))
            STATE_LABELS.forEach((stateText, index) => {
                expect(
                    text,
                    `「${priority}」列头实测「${text}」仍渲染状态名「${stateText}」（第 ${index + 1} 个状态标签）`
                ).not.toContain(stateText)
            })
        }
    })

    it('AC1b③ 每列只含该优先级任务（同状态不同优先级必须分落）', async () => {
        const { wrapper: w } = mountPriorityFixture()
        await clickSegment(w, 'priority')

        const actual = Object.fromEntries(
            PRIORITY_ORDER.map((priority) => [priority, taskIdsIn(columnNode(w, priority))])
        )
        expect(actual, '同状态不同优先级的四张卡必须各落其列（不是四列全空）').toEqual({
            urgent: ['t-urgent'],
            high: ['t-high'],
            medium: ['t-medium'],
            low: ['t-low']
        })
    })

    it('AC1b④ 默认按状态分组：3 列 + 列头状态名 + 同状态合列（回归护栏）', () => {
        const { wrapper: w } = mountPriorityFixture()

        expect(columnNodes(w).map((n) => n.attributes('data-category'))).toEqual([
            'todo',
            'in-progress',
            'done'
        ])
        const headers = columnNodes(w).map(headerText)
        for (const label of STATE_LABELS) {
            expect(
                headers.some((text) => text.includes(label)),
                `列头实测 ${JSON.stringify(headers)}`
            ).toBe(true)
        }
        // 同状态的两张卡回到同一列（按状态分流的对照证据）
        expect(taskIdsIn(columnNode(w, 'todo')).sort()).toEqual(['t-high', 't-urgent'])
    })
})