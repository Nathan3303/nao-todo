/**
 * 番茄通知判定 / 派发层（T576 · PRD `#1` · AC1–AC4）
 *
 * @description 把「提醒设置」接入番茄 4 类通知（专注完成 / 休息即将结束 / 休息结束 / 结束专注）。
 *              判定顺序（PRD §五，**② 早于 ③**）：
 *              ① 读设置失败 ⇒ fail-open（发系统通知、不静音）
 *              ② 免打扰命中 ⇒ 应用内提示，**直接结束**（不发系统通知；即使 `notify === false` 也弹，
 *                 该开关只管辖系统通知）
 *              ③ `notify === false` ⇒ 系统通知 0、应用内提示 0
 *              ④ 其余 ⇒ 发系统通知，`silent = !sound`
 *              **通知层永不抛**（`send` / `notifyInApp` 抛错一律吞掉，不影响引擎阶段流转）。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 通知 · §七 AC1–AC4 · §九 D1/D6）
 * @see docs/qa/2026-10-29-T575-test-contracts.md（§1 判定层契约）
 */
import { isWithinQuietHours, type ReminderSettings } from '@nao-todo/shared/reminder'

/** 通知通道：系统通知 / 应用内提示 / 都不发 */
export type PomodoroNotifyChannel = 'system' | 'in-app' | 'none'

/** 判定结果 */
export type PomodoroNotifyDecision = {
    channel: PomodoroNotifyChannel
    silent: boolean
}

/** 一条番茄通知的三种文案（系统通知标题/正文 + 应用内提示文本） */
export type PomodoroNotifyPayload = {
    title: string
    body: string
    inAppText: string
}

/** fail-open 判定：读不到设置时照发、不静音 */
const FAIL_OPEN_DECISION: PomodoroNotifyDecision = { channel: 'system', silent: false }

/**
 * 计算一次番茄通知的通道与静音策略（纯函数）
 * @param input 提醒设置 + 当前时刻（设备本地墙钟）
 */
export const resolvePomodoroNotifyDecision = (input: {
    settings: ReminderSettings
    nowMs: number
}): PomodoroNotifyDecision => {
    // ② 免打扰命中优先于 ③：应用内提示是免打扰的降级通道，不受「通知开关」管辖
    if (isWithinQuietHours(input.nowMs, input.settings.quietHours)) {
        return { channel: 'in-app', silent: true }
    }
    // ③ 用户明确关闭了系统通知
    if (input.settings.notify === false) return { channel: 'none', silent: true }
    // ④ 正常发送；声音开关映射 silent
    return { channel: 'system', silent: !input.settings.sound }
}

/**
 * 创建番茄通知派发函数
 * @param deps 设置读取（允许抛 ⇒ 内部 fail-open）、可选时钟、系统通知、应用内提示
 * @returns 派发函数：返回本次判定结果，**永不抛**
 */
export const createPomodoroNotifier = (deps: {
    readSettings(): ReminderSettings
    now?(): number
    send(title: string, body: string, options: { silent: boolean }): unknown
    notifyInApp(text: string): void
}): ((payload: PomodoroNotifyPayload) => PomodoroNotifyDecision) => {
    return (payload) => {
        let decision: PomodoroNotifyDecision
        try {
            const settings = deps.readSettings()
            const nowMs = deps.now ? deps.now() : Date.now()
            decision = resolvePomodoroNotifyDecision({ settings, nowMs })
        } catch {
            // ① 读设置抛错 ⇒ fail-open
            decision = FAIL_OPEN_DECISION
        }

        try {
            if (decision.channel === 'system') {
                deps.send(payload.title, payload.body, { silent: decision.silent })
            } else if (decision.channel === 'in-app') {
                deps.notifyInApp(payload.inAppText)
            }
        } catch {
            // NFR：通知层永不抛（引擎阶段流转与记录落库不得被通知失败牵连）
        }

        return decision
    }
}