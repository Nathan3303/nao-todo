// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T575 ① 番茄通知接入提醒设置 —— 判定层（AC1 / AC2 / AC3 / AC4）
 *
 * @description 纯判定 + 派发层（无 store / 无定时器），把 PRD §五「通知」四条判定顺序固化为用例：
 *              ① 读设置（抛错 ⇒ fail-open：发、不静音）
 *              ② 免打扰命中 ⇒ **应用内提示，直接结束**（系统通知 0 次）
 *              ③ `notify === false` ⇒ 不发系统通知、也不弹应用内提示
 *              ④ 否则发系统通知，`silent = !sound`
 *
 * 期望实现落点：`packages/presentation/pomodoro/utils/pomodoro-notify.ts`
 * 契约（见 `docs/qa/2026-10-29-T575-test-contracts.md` §1）：
 *   - `resolvePomodoroNotifyDecision({ settings, nowMs })`
 *       → `{ channel: 'system' | 'in-app' | 'none', silent: boolean }`
 *   - `createPomodoroNotifier({ readSettings, send, notifyInApp, now? })`
 *       → `(payload: { title, body, inAppText }) => decision`（**永不抛**）
 *
 * ⚠️ 待 PM 裁定（用例 N11）：`notify === false` 与免打扰**同时成立**时按谁走 —— §五 顺序里 ② 早于 ③
 *    （⇒ 应用内提示），而 D6 的措辞（「既不发系统通知也不弹应用内提示」）指向 ③。本用例按 §五 **字面顺序**固化。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 业务规则 · §七 AC1–AC4 · §九 D1/D6）
 */

type QuietHoursRange = { start: string; end: string }

/** 提醒设置（= `@nao-todo/shared/reminder` 的 `ReminderSettings`） */
type ReminderSettingsLike = {
    notify: boolean
    sound: boolean
    quietHours: QuietHoursRange | null
}

type Decision = { channel: 'system' | 'in-app' | 'none'; silent: boolean }

interface NotifyModule {
    resolvePomodoroNotifyDecision: (input: {
        settings: ReminderSettingsLike
        nowMs: number
    }) => Decision
    createPomodoroNotifier: (deps: {
        readSettings(): ReminderSettingsLike
        now?(): number
        send(title: string, body: string, options: { silent: boolean }): unknown
        notifyInApp(text: string): void
    }) => (payload: { title: string; body: string; inAppText: string }) => Decision
}

const MODULE = 'packages/presentation/pomodoro/utils/pomodoro-notify.ts'

const load = (ac: string): Promise<NotifyModule> =>
    loadImpl<NotifyModule>(
        '../pomodoro-notify',
        MODULE,
        ['resolvePomodoroNotifyDecision', 'createPomodoroNotifier'],
        ac
    )

const SETTINGS = (patch: Partial<ReminderSettingsLike> = {}): ReminderSettingsLike => ({
    notify: true,
    sound: true,
    quietHours: null,
    ...patch
})

/** 设备本地墙钟（`isWithinQuietHours` 与判定层同源） */
const at = (hour: number, minute: number): number =>
    new Date(2026, 9, 29, hour, minute, 0, 0).getTime()

/** 免打扰区间 22:00–06:00（**跨午夜**，PRD §七 AC2 明确要求覆盖） */
const OVERNIGHT: QuietHoursRange = { start: '22:00', end: '06:00' }

describe('T575 ① AC1 主路径：默认设置 ⇒ 系统通知 + 不静音 + 无应用内提示', () => {
    it('AC1 免打扰未命中、声音开 ⇒ channel=system / silent=false', async () => {
        const { resolvePomodoroNotifyDecision } = await load('AC1')
        const decision = resolvePomodoroNotifyDecision({
            settings: SETTINGS(),
            nowMs: at(12, 0)
        })
        expect(decision.channel).toBe('system')
        expect(decision.silent).toBe(false)
    })

    it('AC1 派发：系统通知 1 次（含阶段与时长）、silent=false、应用内提示 0 次', async () => {
        const { createPomodoroNotifier } = await load('AC1')
        const send = vi.fn(() => true)
        const notifyInApp = vi.fn()
        const notify = createPomodoroNotifier({
            readSettings: () => SETTINGS(),
            now: () => at(12, 0),
            send,
            notifyInApp
        })

        const decision = notify({
            title: '专注完成',
            body: '已完成 25 分钟的专注，现在开始休息',
            inAppText: '专注完成 · 25 分钟，该休息了'
        })

        expect(decision).toEqual({ channel: 'system', silent: false })
        expect(send).toHaveBeenCalledTimes(1)
        const [title, body, options] = send.mock.calls[0] as unknown as [
            string,
            string,
            { silent: boolean }
        ]
        expect(`${title}${body}`).toContain('专注')
        expect(`${title}${body}`).toContain('25 分钟')
        expect(options.silent).toBe(false)
        expect(notifyInApp).not.toHaveBeenCalled()
    })
})

describe('T575 ① AC1 声音开关 ⇒ silent 映射', () => {
    it('AC1 sound=false ⇒ 系统通知 silent=true（声音开关逐项一致）', async () => {
        const { createPomodoroNotifier } = await load('AC1')
        const send = vi.fn(() => true)
        const notifyInApp = vi.fn()
        const notify = createPomodoroNotifier({
            readSettings: () => SETTINGS({ sound: false }),
            now: () => at(12, 0),
            send,
            notifyInApp
        })

        const decision = notify({ title: '专注完成', body: '已完成 25 分钟', inAppText: '' })

        expect(decision).toEqual({ channel: 'system', silent: true })
        expect(send).toHaveBeenCalledTimes(1)
        const options = (send.mock.calls[0] as unknown as [string, string, { silent: boolean }])[2]
        expect(options.silent).toBe(true)
    })
})

describe('T575 ① AC2 免打扰命中 ⇒ 应用内提示，系统通知 0 次', () => {
    it('AC2 跨午夜区间 22:00–06:00 · 23:30 命中 ⇒ channel=in-app', async () => {
        const { resolvePomodoroNotifyDecision } = await load('AC2')
        const decision = resolvePomodoroNotifyDecision({
            settings: SETTINGS({ quietHours: OVERNIGHT }),
            nowMs: at(23, 30)
        })
        expect(decision.channel).toBe('in-app')
    })

    it('AC2 跨午夜区间后半段 05:30 仍命中 ⇒ channel=in-app', async () => {
        const { resolvePomodoroNotifyDecision } = await load('AC2')
        const decision = resolvePomodoroNotifyDecision({
            settings: SETTINGS({ quietHours: OVERNIGHT }),
            nowMs: at(5, 30)
        })
        expect(decision.channel).toBe('in-app')
    })

    it('AC2 同一区间但 12:00 未命中 ⇒ channel=system（区间本身不误伤白天）', async () => {
        const { resolvePomodoroNotifyDecision } = await load('AC2')
        const decision = resolvePomodoroNotifyDecision({
            settings: SETTINGS({ quietHours: OVERNIGHT }),
            nowMs: at(12, 0)
        })
        expect(decision.channel).toBe('system')
    })

    it('AC2 派发：系统通知 0 次 + 应用内提示 1 条（原样传 inAppText，含阶段与时长）', async () => {
        const { createPomodoroNotifier } = await load('AC2')
        const send = vi.fn(() => true)
        const notifyInApp = vi.fn()
        const notify = createPomodoroNotifier({
            readSettings: () => SETTINGS({ quietHours: OVERNIGHT }),
            now: () => at(23, 30),
            send,
            notifyInApp
        })

        const inAppText = '专注完成 · 25 分钟，该休息了'
        const decision = notify({
            title: '专注完成',
            body: '已完成 25 分钟的专注',
            inAppText
        })

        expect(decision.channel).toBe('in-app')
        expect(send).not.toHaveBeenCalled()
        expect(notifyInApp).toHaveBeenCalledTimes(1)
        expect(notifyInApp).toHaveBeenCalledWith(inAppText)
        expect(inAppText).toContain('专注完成')
        expect(inAppText).toContain('25 分钟')
    })
})

describe('T575 ① AC3 通知开关关闭且免打扰未命中 ⇒ 双 0', () => {
    it('AC3 notify=false ⇒ channel=none、系统通知 0、应用内提示 0', async () => {
        const { createPomodoroNotifier } = await load('AC3')
        const send = vi.fn(() => true)
        const notifyInApp = vi.fn()
        const notify = createPomodoroNotifier({
            readSettings: () => SETTINGS({ notify: false }),
            now: () => at(12, 0),
            send,
            notifyInApp
        })

        const decision = notify({
            title: '专注完成',
            body: '已完成 25 分钟',
            inAppText: '专注完成 · 25 分钟，该休息了'
        })

        expect(decision.channel).toBe('none')
        expect(send).not.toHaveBeenCalled()
        expect(notifyInApp).not.toHaveBeenCalled()
    })
})

describe('T575 ① AC4 异常：读设置抛错 ⇒ fail-open（发、不静音）', () => {
    it('AC4 readSettings 抛错 ⇒ 系统通知 1 次且 silent=false，不冒泡', async () => {
        const { createPomodoroNotifier } = await load('AC4')
        const send = vi.fn(() => true)
        const notifyInApp = vi.fn()
        const notify = createPomodoroNotifier({
            readSettings: () => {
                throw new Error('storage unavailable')
            },
            now: () => at(12, 0),
            send,
            notifyInApp
        })

        let decision: Decision | undefined
        expect(() => {
            decision = notify({ title: '专注完成', body: '已完成 25 分钟', inAppText: 'x' })
        }).not.toThrow()

        expect(decision?.channel).toBe('system')
        expect(send).toHaveBeenCalledTimes(1)
        const options = (send.mock.calls[0] as unknown as [string, string, { silent: boolean }])[2]
        expect(options.silent).toBe(false)
        expect(notifyInApp).not.toHaveBeenCalled()
    })

    it('AC4 设置拿不到免打扰配置（quietHours 缺失）⇒ 不抑制', async () => {
        const { resolvePomodoroNotifyDecision } = await load('AC4')
        const decision = resolvePomodoroNotifyDecision({
            settings: { notify: true, sound: true, quietHours: null },
            nowMs: at(23, 30)
        })
        expect(decision.channel).toBe('system')
    })

    it('NFR 通知层永不抛：send 抛错不得冒泡（引擎阶段流转不受影响）', async () => {
        const { createPomodoroNotifier } = await load('NFR-可靠性')
        const notify = createPomodoroNotifier({
            readSettings: () => SETTINGS(),
            now: () => at(12, 0),
            send: () => {
                throw new Error('Notification is not allowed')
            },
            notifyInApp: vi.fn()
        })

        expect(() =>
            notify({ title: '专注完成', body: '已完成 25 分钟', inAppText: 'x' })
        ).not.toThrow()
    })

    it('NFR 应用内提示失败不得影响判定（notifyInApp 抛错也不冒泡）', async () => {
        const { createPomodoroNotifier } = await load('NFR-可靠性')
        const send = vi.fn(() => true)
        const notify = createPomodoroNotifier({
            readSettings: () => SETTINGS({ quietHours: OVERNIGHT }),
            now: () => at(23, 30),
            send,
            notifyInApp: () => {
                throw new Error('popup container missing')
            }
        })

        expect(() =>
            notify({ title: '专注完成', body: '已完成 25 分钟', inAppText: 'x' })
        ).not.toThrow()
        expect(send).not.toHaveBeenCalled()
    })
})

describe('T575 ① 判定顺序（§五 ①②③④）', () => {
    it('N11（⚠️ 待 PM 裁定）notify=false 且免打扰命中 ⇒ 按 §五 字面顺序 ② 早于 ③ ⇒ 应用内提示', async () => {
        const { resolvePomodoroNotifyDecision } = await load('§五 判定顺序')
        const decision = resolvePomodoroNotifyDecision({
            settings: SETTINGS({ notify: false, quietHours: OVERNIGHT }),
            nowMs: at(23, 30)
        })
        expect(decision.channel).toBe('in-app')
    })

    it('N12 免打扰命中时 silent 恒为 true（应用内提示无声）', async () => {
        const { resolvePomodoroNotifyDecision } = await load('§五 判定顺序')
        const decision = resolvePomodoroNotifyDecision({
            settings: SETTINGS({ sound: true, quietHours: OVERNIGHT }),
            nowMs: at(23, 30)
        })
        expect(decision.silent).toBe(true)
    })
})