// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueDatePicker } from 'nue-ui'

/**
 * T633 AC7 · `nue-date-picker` `type="datetime"` 的 emit 值快照（三组）
 *
 * 背景：`nue-ui` `1.15.2`（`5da96222`）只改 `use-calendar` 的 `parseDateTime()` **兜底分支** ——
 * 值里没有可用时刻段（date-only / 不可解析）时，面板时分由「当前时刻」改为 `00:00`；
 * `modelValue` 为空（`''` / `null`）走的是 **else 分支（时分 = 现在）**，该分支**未改**。
 *
 * 三组快照锁的就是这条边界：
 *   ① `datetime` + ISO 值 点选日期 ⇒ **时刻保持**（本仓 4 处 `datetime` 的常态路径）
 *   ② `datetime` + 空值     点选日期 ⇒ **仍为「现在时刻」**（锁住 else 分支未被一并改掉）
 *   ③ `datetime` + date-only 串 点选日期 ⇒ **`00:00`**（锁住上游新口径；本仓不产生此输入）
 *
 * 断言口径：emit 值是 ISO 串，但其**本地时刻**才承载业务语义（时区无关）⇒ 一律按
 * `new Date(iso)` 的本地 `getHours()/getMinutes()` 断言，避免测试机时区漂移导致假红。
 * 本机实测（`Asia/Shanghai`，UTC+8）的逐字值见 `docs/reports/T633-nue-ui-1153-qa-verify.md`。
 *
 * 纪律：真实挂载真实组件（禁 stub）；**不得**为了让用例变绿去改产品代码或放宽断言。
 */

let wrappers: VueWrapper[] = []

const track = (wrapper: VueWrapper): VueWrapper => {
    wrappers.push(wrapper)
    return wrapper
}

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
    document.body.innerHTML = ''
    vi.useRealTimers()
})

/** 本地时刻视图（业务语义载体；与运行机时区无关） */
const localParts = (iso: string) => {
    const date = new Date(iso)
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds(),
        millisecond: date.getMilliseconds()
    }
}

const mountPicker = (modelValue: string): VueWrapper =>
    track(
        mount(NueDatePicker, {
            props: { modelValue, type: 'datetime' },
            attachTo: document.body
        })
    )

/** 面板时分控件实测值（`['16','30']`） */
const panelTime = (wrapper: VueWrapper): string[] =>
    wrapper.findAll('.nue-calendar-time-picker__value').map((node) => node.text())

/** 点选「本月」的某一天（排除 `other-month` 的重复数字） */
const clickDay = async (wrapper: VueWrapper, day: string) => {
    const cells = wrapper
        .findAll('.date-cell')
        .filter((cell) => cell.text() === day && !cell.classes().includes('other-month'))
    expect(cells.length, `本月 ${day} 号应恰好 1 个可点单元格，实测 ${cells.length}`).toBe(1)
    await cells[0]!.trigger('click')
}

const emittedValue = (wrapper: VueWrapper): string => {
    const events = wrapper.emitted('update:modelValue')
    expect(events, '应恰好上抛一次 update:modelValue').toHaveLength(1)
    return events![0]![0] as string
}

describe('T633 AC7① · datetime + ISO 值 ⇒ 点选日期后时刻保持', () => {
    it('`2026-11-02T08:30:00.000Z` 点选 11-15 ⇒ emit 为 11-15 且本地时分仍为 08:30Z 对应的本地时刻', async () => {
        const input = '2026-11-02T08:30:00.000Z'
        const wrapper = mountPicker(input)
        const before = localParts(input)

        // 前置：面板时分 = 输入值的本地时刻（而非「现在」）
        expect(panelTime(wrapper), '面板时分应回填自输入值').toEqual([
            String(before.hour).padStart(2, '0'),
            String(before.minute).padStart(2, '0')
        ])

        await clickDay(wrapper, '15')

        const value = emittedValue(wrapper)
        const after = localParts(value)

        expect({ year: after.year, month: after.month, day: after.day }).toEqual({
            year: 2026,
            month: 11,
            day: 15
        })
        // 核心断言：时刻保持（本地时/分不变），秒与毫秒被上游归零
        expect({ hour: after.hour, minute: after.minute }).toEqual({
            hour: before.hour,
            minute: before.minute
        })
        expect({ second: after.second, millisecond: after.millisecond }).toEqual({
            second: 0,
            millisecond: 0
        })
        // 仍是完整 ISO（本仓保存链 `dayjs(v).toISOString()` 的前提）
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        // `change` 与 `update:modelValue` 同值（本仓 `@update:model-value` / v-model 都依赖它）
        expect(wrapper.emitted('change')?.[0]).toEqual([value])
    })
})

describe('T633 AC7② · datetime + 空值 ⇒ 点选日期后仍为「现在时刻」', () => {
    it('`modelValue = ""` 点选 11-15 ⇒ 面板时分 = 现在，emit 时刻 = 现在', async () => {
        // 固定系统时刻，使「现在」≠ 00:00，否则无法区分 ② 与 ③
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 10, 2, 21, 47, 0, 0))

        const wrapper = mountPicker('')

        // 前置：空值走 else 分支 ⇒ 面板时分 = 现在（21:47），不是 00:00
        expect(panelTime(wrapper), '空值应回填「现在时刻」').toEqual(['21', '47'])

        await clickDay(wrapper, '15')

        const after = localParts(emittedValue(wrapper))
        expect({ year: after.year, month: after.month, day: after.day }).toEqual({
            year: 2026,
            month: 11,
            day: 15
        })
        // 核心断言：仍为「现在时刻」⇒ 上游 `5da96222` 未把 else 分支一并改成 00:00
        expect({ hour: after.hour, minute: after.minute }).toEqual({ hour: 21, minute: 47 })
    })
})

describe('T633 AC7③ · datetime + date-only 串 ⇒ 点选日期后为 00:00（上游新口径）', () => {
    it('`modelValue = "2026-11-02"` 点选 11-15 ⇒ 面板与 emit 时刻均为 00:00', async () => {
        // 同样固定「现在」为非零时刻 ⇒ 00:00 只可能来自上游新兜底分支
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 10, 2, 21, 47, 0, 0))

        const wrapper = mountPicker('2026-11-02')

        expect(panelTime(wrapper), 'date-only 值应回填 00:00（1.15.2 起）').toEqual(['00', '00'])

        await clickDay(wrapper, '15')

        const after = localParts(emittedValue(wrapper))
        expect({ year: after.year, month: after.month, day: after.day }).toEqual({
            year: 2026,
            month: 11,
            day: 15
        })
        // 核心断言：00:00（本地零点）—— 上游新口径
        expect({ hour: after.hour, minute: after.minute }).toEqual({ hour: 0, minute: 0 })
        // 说明性断言：本仓 4 处 `datetime` 调用点的取值链恒为 ISO 或空串/null（见报告 AC7 段），
        // 因此本组口径在本仓**不可达**；本用例的作用是「上游若再改回去，这里会红」。
        expect(emittedValue(wrapper)).toBe(wrapper.emitted('change')?.[0]?.[0])
    })
})