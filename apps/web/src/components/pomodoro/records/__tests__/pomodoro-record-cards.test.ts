// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import dayjs from 'dayjs'
import { formatDuration } from '@nao-todo/presentation/pomodoro'
import { nueUI } from '@/nue-ui-register'
import TableMain from '../table-main.vue'
import DetailPanel from '../detail-panel.vue'
import { setViewport, stubResizeObserver } from './records-responsive-harness'

/**
 * T549 · 窄屏记录卡片（AC2 卡片形态 / AC9 a11y）
 *
 * 覆盖：AC2（≤720px 每条记录以卡片呈现，含「类型（图标+文字）· 任务名 · 时长 · 开始时间」，
 *       点卡片开既有详情且**字段与桌面表格一致**）· AC9（可聚焦 / 回车打开 / 可访问名）。
 *
 * 挂载方式：**真实组件挂载**（不 stub 内部结构），只把视口设为 360px
 * （`setViewport` 同时驱动 `innerWidth` 与 `matchMedia` ⇒ CSS 媒体查询驱动与 JS 宽度驱动两种实现都能命中）。
 *
 * 实现契约（不满足即红）：
 * - 卡片根元素 `.pomodoro-record-card`；字段 `.pomodoro-record-card__type` / `__task` / `__duration` / `__time`；
 * - 卡片须可聚焦（原生 `button` 或 `tabindex="0"`），回车等同点击打开详情；
 * - 卡片的可访问名须含「类型 + 任务名 + 时间」（`aria-label` 或可见文本）。
 *
 * 说明：卡片与桌面表格同源（`records` prop），故以「卡片数 === records 数」验单一数据源（R1）。
 */

const MOBILE = 360
let restoreViewport: (() => void) | null = null

beforeAll(() => {
    stubResizeObserver()
    restoreViewport = setViewport(MOBILE)
})

afterAll(() => {
    restoreViewport?.()
})

type RecordLike = {
    id: string
    sessionId: string
    type: number
    startAt: string
    endAt: string
    duration: number
    pomodoroId: string | null
    taskId: string
    taskName: string
    description: string
    note: string
    createdAt: string
    updatedAt: string
    deletedAt: null
}

const makeRecord = (index: number, overrides: Partial<RecordLike> = {}): RecordLike => ({
    id: `r${index}`,
    sessionId: `s${index}`,
    type: index % 2 === 1 ? 1 : 2,
    startAt: `2026-10-0${(index % 9) + 1}T0${index % 10}:00:00.000Z`,
    endAt: `2026-10-0${(index % 9) + 1}T0${index % 10}:25:00.000Z`,
    duration: 1500,
    pomodoroId: 'p1',
    taskId: `t${index}`,
    taskName: `任务 ${index}`,
    description: '',
    note: '备注',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    ...overrides
})

const POMODOROS = [{ id: 'p1', name: '模板A' }]

const mountTable = (records: RecordLike[]): VueWrapper =>
    mount(TableMain, {
        props: { records: records as never, pomodoros: POMODOROS as never },
        global: { plugins: [nueUI] }
    })

const cardsOf = (wrapper: VueWrapper) => wrapper.findAll('.pomodoro-record-card')

/** 取首张卡片；缺实现时给出明确红因（而不是 `undefined.find` 之类的噪声崩溃） */
const firstCard = (wrapper: VueWrapper) => {
    const cards = cardsOf(wrapper)
    expect(cards.length, '窄屏未渲染 `.pomodoro-record-card` 卡片（实现缺失）').toBeGreaterThan(0)
    return cards[0]!
}

/** 卡片「可访问名」：`aria-label` 优先，其次可见文本（两者任一满足 AC9 判据） */
const accessibleName = (card: {
    attributes: (name: string) => string | undefined
    text: () => string
}) => (card.attributes('aria-label') ?? card.text()).replace(/\s+/g, ' ').trim()

describe('T549 AC2 卡片形态（≤720px，真实挂载 @360px）', () => {
    it('AC2 ① 每条记录渲染一张卡片（单一数据源：卡片数 === records 数）', () => {
        const records = Array.from({ length: 10 }, (_, index) => makeRecord(index + 1))
        const wrapper = mountTable(records)
        const cards = cardsOf(wrapper)
        console.log('[AC2-①] 360px 记录数 / 卡片数：', records.length, '/', cards.length)

        expect(cards.length, '窄屏未按记录渲染卡片（记录仍只有桌面表格行）').toBe(records.length)
        wrapper.unmount()
    })

    it('AC2 ② 卡片含「类型（图标 + 文字）· 任务名 · 时长 · 开始时间」四项', () => {
        const record = makeRecord(1, { type: 1, taskName: '写周报', duration: 1500 })
        const wrapper = mountTable([record, makeRecord(2, { type: 2 })])
        const card = firstCard(wrapper)
        const typeArea = card.find('.pomodoro-record-card__type')
        const measured = {
            hasIcon: typeArea.findAll('.nue-icon').length > 0,
            typeText: typeArea.text(),
            task: card.find('.pomodoro-record-card__task').text(),
            duration: card.find('.pomodoro-record-card__duration').text(),
            time: card.find('.pomodoro-record-card__time').text()
        }
        console.log('[AC2-②] 首张卡片实测：', measured)

        expect(measured.hasIcon, '类型缺图标（R3 = 图标 + 文字）').toBe(true)
        expect(measured.typeText).toContain('番茄钟')
        expect(measured.task).toContain('写周报')
        expect(measured.duration).toContain(formatDuration(record.duration))
        expect(measured.time).toContain(dayjs(record.startAt).format('HH:mm'))
        wrapper.unmount()
    })

    it('AC2 ③ 正计时记录的类型标签为「正计时」（类型口径与表格一致）', () => {
        const wrapper = mountTable([makeRecord(2, { type: 2 })])
        const typeText = firstCard(wrapper).find('.pomodoro-record-card__type').text()
        console.log('[AC2-③] 正计时卡片类型文本：', typeText)

        expect(typeText).toContain('正计时')
        wrapper.unmount()
    })

    it('AC2 ④ 点卡片打开既有详情（emit showDetail + record.id）', async () => {
        const wrapper = mountTable([makeRecord(3), makeRecord(4)])
        const card = firstCard(wrapper)
        await card.trigger('click')

        const emitted = wrapper.emitted('showDetail')
        console.log('[AC2-④] showDetail 载荷：', emitted)

        expect(emitted, '点卡片未打开详情').toBeTruthy()
        expect(emitted![0]).toEqual(['r3'])
        wrapper.unmount()
    })

    it('AC2 ⑤ 详情字段与桌面表格列一致，无丢失（字段集合断言，不靠视觉）', () => {
        const record = makeRecord(5)
        const table = mountTable([record])
        const detail = mount(DetailPanel, {
            props: {
                visible: true,
                record: record as never,
                pomodoros: POMODOROS as never
            },
            global: { plugins: [nueUI] }
        })

        const tableColumns = table
            .findAll('.pomodoro-records-table__header .pomodoro-records-table__cell')
            .map((cell) => cell.text())
            .filter((text) => text !== '操作')
        const detailLabels = detail
            .findAll('.pomodoro-records-detail__field .nue-text--field-label')
            .map((label) => label.text())

        console.log('[AC2-⑤] 表格列 / 详情标签实测：', { tableColumns, detailLabels })

        // 表格列 → 详情标签的语义映射（R3：卡片只展示 4 项，模板/结束时间进详情 = 只迁移、不丢失）
        const mapping: Record<string, string> = {
            类型: '专注类型',
            任务名称: '任务名称',
            专注模板: '专注模板',
            时长: '专注时长',
            开始时间: '开始时间',
            结束时间: '结束时间'
        }
        const missing = tableColumns
            .map((column) => mapping[column])
            .filter((label) => label === undefined || !detailLabels.includes(label))
        console.log('[AC2-⑤] 详情缺失字段：', missing)

        expect(tableColumns).toEqual(Object.keys(mapping))
        expect(missing, '卡片化后详情缺字段 ⇒ 信息丢失（硬约束：只迁移不丢失）').toEqual([])
        table.unmount()
        detail.unmount()
    })
})

describe('T549 AC9 a11y：卡片可键盘操作', () => {
    it('AC9 ① 卡片可聚焦（原生 button 或 tabindex="0"）', () => {
        const wrapper = mountTable([makeRecord(1)])
        const card = firstCard(wrapper)
        const focusable =
            card.element.tagName === 'BUTTON' ||
            card.element.tagName === 'A' ||
            card.attributes('tabindex') === '0'
        console.log('[AC9-①] 卡片标签 / tabindex：', {
            tag: card.element.tagName,
            tabindex: card.attributes('tabindex')
        })

        expect(focusable, '卡片不可聚焦 ⇒ 键盘用户无法进入列表').toBe(true)
        wrapper.unmount()
    })

    it('AC9 ② 回车打开详情（keydown.enter 等同点击）', async () => {
        const wrapper = mountTable([makeRecord(6)])
        const card = firstCard(wrapper)
        await card.trigger('keydown', { key: 'Enter' })

        console.log('[AC9-②] Enter 后 showDetail：', wrapper.emitted('showDetail'))
        expect(wrapper.emitted('showDetail')?.[0]).toEqual(['r6'])
        wrapper.unmount()
    })

    it('AC9 ③ 可访问名含「类型 + 任务名 + 时间」', () => {
        const record = makeRecord(7, { type: 1, taskName: '整理会议纪要' })
        const wrapper = mountTable([record])
        const name = accessibleName(firstCard(wrapper))
        console.log('[AC9-③] 可访问名实测：', name)

        expect(name).toContain('番茄钟')
        expect(name).toContain('整理会议纪要')
        expect(name).toContain(dayjs(record.startAt).format('HH:mm'))
        wrapper.unmount()
    })
})