// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { NueButton, NueDiv, NueText } from 'nue-ui'
import { UnableToImplementError } from '../../../utils/__tests__/impl-seam'
import {
    usePomodoroRecordsStore,
    usePomodoroSessionStore,
    usePomodoroTimerStore
} from '../../../stores'
import RoundsIndicator from '../rounds-indicator.vue'

/**
 * T580 ② 「重新开始本周期」入口（AC5–AC9）
 *
 * @description **接缝假设**（PRD §五「位置：轮次指示器同一行的行尾」）⇒ 挂载**真实**轮次指示器组件，
 *              入口是它的一部分。⚠️ 若实现把入口放到页面层（`apps/web`），须先与 QA 对齐接缝后改用例
 *              （改代码不改用例 = 红基线失真）。
 *
 * 断言口径：
 *   - **真实组件挂载**（`nue-div` / `nue-text` / `nue-button` 用真身）；只有 `NueConfirm` / `NueMessage`
 *     用桩 —— 且断言**真实调用次数与入参文案**，而不是自写 stub 模板。
 *   - **状态断言走真实 store**（`completedRounds` / `phase` / 记录列表 / 会话选择 / 笔记），
 *     记录「不变」用**条数 + 序列化内容**双口径。
 *   - 键盘：jsdom **不实现**原生 button 的 Enter 隐式激活 ⇒ AC9 断言「原生 button + 可聚焦 + 未被
 *     disabled/tabindex 剥夺 + 不在 `role="img"` 内（否则辅助技术视为表现性）」，行为侧用 click 等价验证。
 *
 * 红基线读法（不要误判「用例写错」）：
 *   - `entryButtons(...)` 为空而期望 1 ⇒ **缺能力**（入口未实现，AC5/AC7/AC9）。
 *   - `UnableToImplementError: [缺实现] … resetCycle()` ⇒ **缺能力**（store 未提供显式重置方法，AC8）。
 *   - 计数/文案不符 ⇒ `DEF-112` 的 `idle` 口径未修（见 `t575-rounds-view.test.ts`），非本文件断言问题。
 *
 * @see docs/prds/2026-10-29-pomodoro-rounds-semantics.md（§五 业务规则 · §七 AC5–AC9 · §九 D12/D14）
 */

const hoisted = vi.hoisted(() => ({
    confirm: vi.fn(),
    message: vi.fn()
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>()
    return {
        ...actual,
        NueConfirm: hoisted.confirm,
        // 方法名不作假设：4 档提示全部指向同一 spy ⇒ 计数与文案断言稳定
        NueMessage: {
            info: hoisted.message,
            success: hoisted.message,
            warn: hoisted.message,
            error: hoisted.message
        }
    }
})

const FOCUS_S = 25 * 60
const BREAK_S = 5 * 60
const ENTRY_TEXT = '重新开始本周期'
const NEUTRAL_LABEL = '共 4 轮一轮长休'

/** 种子记录（重置**不得**触碰任何已保存的专注记录） */
const SEED_RECORDS = [
    { id: 'rec-t580-a', duration: 1500 },
    { id: 'rec-t580-b', duration: 900 }
]

type ConfirmOptions = {
    title?: string
    content?: string
    confirmButtonText?: string
    cancelButtonText?: string
    onConfirm?: () => unknown
}

let timer: ReturnType<typeof usePomodoroTimerStore>
let session: ReturnType<typeof usePomodoroSessionStore>
let records: ReturnType<typeof usePomodoroRecordsStore>
let createRecord: ReturnType<typeof vi.fn>
let wrappers: VueWrapper[]

/** 确认框桩：返回 `[isByCancel]`（awaited 式）；若实现用 `onConfirm` 回调式，也一并触发 */
const stubConfirm = (cancel: boolean) => {
    hoisted.confirm.mockImplementation(async (options?: ConfirmOptions) => {
        if (!cancel && typeof options?.onConfirm === 'function') options.onConfirm()
        return [cancel]
    })
}

const confirmOptions = (): ConfirmOptions[] =>
    hoisted.confirm.mock.calls.map(([options]) => (options ?? {}) as ConfirmOptions)

const mountIndicator = () => {
    const wrapper = mount(RoundsIndicator, {
        attachTo: document.body,
        global: {
            components: { 'nue-div': NueDiv, 'nue-text': NueText, 'nue-button': NueButton }
        }
    })
    wrappers.push(wrapper)
    return wrapper
}

const filledCount = (wrapper: VueWrapper) => wrapper.findAll('.nue-div--rounds-dot-filled').length

const dotCount = (wrapper: VueWrapper) => wrapper.findAll('.nue-div--rounds-dot').length

/** 入口候选：只认**原生 button**（PRD §五 要求 `NueButton` = 键盘可达） */
const entryButtons = (wrapper: VueWrapper) =>
    wrapper.findAll('button').filter((node) => node.text().includes(ENTRY_TEXT))

/** 任何带 `aria-label` / `title` 的节点 —— 用于证明「没有隐藏的键盘可达路径」 */
/** 入口断言用（缺失即「缺能力」，给出可读原因，不写成 `undefined` 解引用） */
const entryButton = (wrapper: VueWrapper) => {
    const [button] = entryButtons(wrapper)
    if (!button) {
        throw new UnableToImplementError(
            '[缺实现] 轮次指示器缺少「重新开始本周期」入口（PRD §五 / AC5 / AC9）'
        )
    }
    return button
}

const namedEntryNodes = (wrapper: VueWrapper) =>
    wrapper
        .findAll('[aria-label], [title]')
        .filter((node) =>
            `${node.attributes('aria-label') ?? ''}${node.attributes('title') ?? ''}`.includes(
                ENTRY_TEXT
            )
        )

const recordsSnapshot = () => JSON.stringify(records.records)

/** 显式重置动作（PRD §六：`resetCycle()` 于 store；组件不得直接改 ref） */
const resetCycleAction = (): (() => void) => {
    const fn = (timer as unknown as { resetCycle?: () => unknown }).resetCycle
    if (typeof fn !== 'function') {
        throw new UnableToImplementError(
            '[缺实现] pomodoro-timer-store 缺少 resetCycle()（PRD §六 / AC8）'
        )
    }
    return () => {
        fn.call(timer)
    }
}

/** 进入 focus（本周期已完成 3 轮，证明运行中也不得出现重置入口） */
const enterFocusWithPendingRounds = () => {
    timer.completedRounds = 3
    timer.start()
}

/** 进入短休（1 轮自然完成） */
const enterBreak = () => {
    timer.start()
    vi.advanceTimersByTime(FOCUS_S * 1000 + 500)
}

/** 进入长休（M=1 ⇒ 首次专注完成即长休，周期计数归零） */
const enterLongBreak = () => {
    session.setSessionsUntilLongBreak(1)
    timer.start()
    vi.advanceTimersByTime(FOCUS_S * 1000 + 500)
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0, 0))
    localStorage.clear()

    setActivePinia(createPinia())
    session = usePomodoroSessionStore()
    session.setFocusDuration(FOCUS_S)
    session.setBreakDuration(BREAK_S)
    session.setSessionsUntilLongBreak(4)
    session.setAutoRest(true)
    session.setAutoStartNextFocusSession(false)

    records = usePomodoroRecordsStore()
    timer = usePomodoroTimerStore()
    timer.updateConfig()
    createRecord = vi.fn(async () => [[], null] as never)
    timer.setCreateRecordFn(createRecord as never)

    wrappers = []
    hoisted.confirm.mockReset()
    hoisted.message.mockReset()
    stubConfirm(false)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
    timer.destroy()
    vi.useRealTimers()
})

describe('T580 ② AC5 重置主路径（确认 ⇒ 归零 + 提示 + 记录不变）', () => {
    it('AC5 确认 ⇒ 计数 0 / ○○○○ / 中性文案 / 成功提示 / 记录条数与内容不变', async () => {
        timer.completedRounds = 2
        session.setNoteText('午休后的新任务')
        session.selectPomodoro('preset-t580', '常用番茄')
        records.addRecords(SEED_RECORDS.map((record) => ({ ...record })) as never)
        const before = recordsSnapshot()

        const wrapper = mountIndicator()
        await wrapper.vm.$nextTick()

        // 前置：idle 且已完成 2 轮 ⇒ 入口可见、圆点 ●●○○
        expect(entryButtons(wrapper)).toHaveLength(1)
        expect(filledCount(wrapper)).toBe(2)

        await entryButton(wrapper).trigger('click')
        await flushPromises()
        await wrapper.vm.$nextTick()

        expect(hoisted.confirm).toHaveBeenCalledTimes(1)
        expect(timer.completedRounds).toBe(0)
        expect(filledCount(wrapper)).toBe(0)
        expect(dotCount(wrapper)).toBe(4)
        expect(wrapper.text()).toContain(NEUTRAL_LABEL)
        expect(hoisted.message).toHaveBeenCalledTimes(1)
        expect(String(hoisted.message.mock.calls[0]?.[0])).toContain('本周期已重新开始')

        // 记录「条数 + 内容」双口径不变；且未触发任何记录创建
        expect(records.records).toHaveLength(SEED_RECORDS.length)
        expect(recordsSnapshot()).toBe(before)
        expect(createRecord).not.toHaveBeenCalled()

        // 不触碰引擎阶段 / 任务·模板选择 / 笔记
        expect(timer.phase).toBe('idle')
        expect(session.currentPomodoroId).toBe('preset-t580')
        expect(session.noteText).toBe('午休后的新任务')

        // 计数归零 ⇒ 入口按可见性规则消失（避免留下按不动的按钮）
        expect(entryButtons(wrapper)).toHaveLength(0)
    })

    it('AC5 确认框文案：标题 / 清空轮数 / 「专注记录不受影响」/ 按钮文案', async () => {
        timer.completedRounds = 2
        const wrapper = mountIndicator()
        await wrapper.vm.$nextTick()

        await entryButton(wrapper).trigger('click')
        await flushPromises()

        const [options] = confirmOptions()
        expect(options?.title).toBe('重新开始本周期？')
        expect(String(options?.content)).toContain('2 轮')
        expect(String(options?.content)).toContain('今天的专注记录不受影响')
        expect(options?.confirmButtonText).toBe('重新开始')
        expect(options?.cancelButtonText).toBe('取消')
    })
})

describe('T580 ② AC6 负向闭环（取消 / Esc ⇒ 零副作用）', () => {
    // 「取消按钮」与「Esc」在 NueConfirm 里都落到同一个取消结果 ⇒ 同一零副作用断言
    for (const route of ['点「取消」', '按 Esc（NueConfirm 以取消结果返回）']) {
        it(`AC6 ${route} ⇒ 计数不变 / 无提示 / 无记录变化 / 入口仍在`, async () => {
            stubConfirm(true)
            timer.completedRounds = 2
            records.addRecords(SEED_RECORDS.map((record) => ({ ...record })) as never)
            const before = recordsSnapshot()

            const wrapper = mountIndicator()
            await wrapper.vm.$nextTick()
            await entryButton(wrapper).trigger('click')
            await flushPromises()
            await wrapper.vm.$nextTick()

            expect(hoisted.confirm).toHaveBeenCalledTimes(1)
            expect(timer.completedRounds).toBe(2)
            expect(filledCount(wrapper)).toBe(2)
            expect(wrapper.text()).toContain('本周期已完成 2 轮 · 再 2 轮长休')
            expect(hoisted.message).not.toHaveBeenCalled()
            expect(recordsSnapshot()).toBe(before)
            expect(createRecord).not.toHaveBeenCalled()
            expect(entryButtons(wrapper)).toHaveLength(1)
        })
    }
})

describe('T580 ② AC7 可见性（非 idle 或 0 轮 ⇒ 不渲染，且无键盘可达路径）', () => {
    const hiddenCases: Array<{ name: string; enter: () => void }> = [
        { name: 'idle 且 0 轮', enter: () => undefined },
        { name: 'focus（本周期已完成 3 轮，运行中不得清空）', enter: enterFocusWithPendingRounds },
        { name: 'break', enter: enterBreak },
        { name: 'longBreak', enter: enterLongBreak }
    ]

    for (const { name, enter } of hiddenCases) {
        it(`AC7 ${name} ⇒ queryByText 等价断言为 null`, async () => {
            enter()

            const wrapper = mountIndicator()
            await wrapper.vm.$nextTick()

            // 指示器本身仍在渲染（排除「组件没挂上」造成的假绿）
            expect(wrapper.find('[role="img"]').exists()).toBe(true)
            expect(entryButtons(wrapper)).toHaveLength(0)
            expect(namedEntryNodes(wrapper)).toHaveLength(0)
        })
    }
})

describe('T580 ② AC8 幂等（连续两次确认不产生额外副作用）', () => {
    it('AC8 首次确认归零后再次确认 ⇒ 计数仍 0 / 记录不变 / 不重复提示 / 不抛错', async () => {
        timer.completedRounds = 1
        records.addRecords(SEED_RECORDS.map((record) => ({ ...record })) as never)
        const before = recordsSnapshot()

        const wrapper = mountIndicator()
        await wrapper.vm.$nextTick()
        await entryButton(wrapper).trigger('click')
        await flushPromises()
        await wrapper.vm.$nextTick()

        expect(timer.completedRounds).toBe(0)
        expect(hoisted.message).toHaveBeenCalledTimes(1)

        // 入口已随计数归零消失 ⇒ 第二次确认只能落到 store 动作上（PRD §六 显式方法）
        const resetCycle = resetCycleAction()
        expect(() => resetCycle()).not.toThrow()

        expect(timer.completedRounds).toBe(0)
        expect(timer.phase).toBe('idle')
        expect(recordsSnapshot()).toBe(before)
        expect(hoisted.message).toHaveBeenCalledTimes(1)
        expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe(NEUTRAL_LABEL)
    })
})

describe('T580 ② AC9 无障碍（键盘可达 + 文案同源）', () => {
    it('AC9 入口是原生 button：可聚焦 / 未被 disabled 或 tabindex 剥夺 / aria-label 与可见文案同源', async () => {
        timer.completedRounds = 2
        const wrapper = mountIndicator()
        await wrapper.vm.$nextTick()

        const button = entryButton(wrapper)
        expect(button).toBeTruthy()
        expect(button.element.tagName).toBe('BUTTON')
        expect(button.attributes('disabled')).toBeUndefined()
        const tabindex = button.attributes('tabindex')
        expect(tabindex === undefined || Number(tabindex) >= 0).toBe(true)

        // Tab 可达（jsdom 支持程序化 focus；原生 button 即在 tab 序列内）
        button.element.focus()
        expect(document.activeElement).toBe(button.element)

        const visible = button.text().replace(/\s+/g, '')
        expect(visible).toBe(ENTRY_TEXT)
        expect(button.attributes('aria-label')?.replace(/\s+/g, '')).toBe(visible)
        expect(button.attributes('title')?.replace(/\s+/g, '')).toBe(visible)

        // `role="img"` 的后代在辅助技术里是表现性的 ⇒ 可交互入口必须在其之外
        expect(wrapper.find('[role="img"]').element.contains(button.element)).toBe(false)

        // 浏览器里 Enter 对原生 button 的隐式激活 = click（jsdom 不实现隐式激活）
        await button.trigger('click')
        await flushPromises()
        expect(hoisted.confirm).toHaveBeenCalledTimes(1)
    })

    it('AC9 指示器 aria-label 与可见文案同源，且含进度表述（不只念「轮次」）', async () => {
        timer.completedRounds = 2
        const wrapper = mountIndicator()
        await wrapper.vm.$nextTick()

        const indicator = wrapper.find('[role="img"]')
        expect(indicator.attributes('aria-label')).toBe('本周期已完成 2 轮 · 再 2 轮长休')
        expect(indicator.text()).toContain('本周期已完成 2 轮 · 再 2 轮长休')
        expect(entryButton(wrapper).attributes('aria-label')).toBe(ENTRY_TEXT)
    })
})