/**
 * 番茄轮次指示器视图模型（T576 · PRD `#3` · AC9–AC12）
 *
 * @description **纯计算、无副作用**：把「阶段 + 已完成轮次 + 每周期轮数」映射为
 *              圆点总数 / 实心数 / 文字标签 / 是否即将长休。
 *              **实心数恒等于已完成数**（D11，M=1 无特例；T580 起含 `idle`），三态由「实心 / 空心 / 文字」表达。
 *              `longBreak` 例外：恒 0 实心 +「长休息 · 新周期」（新周期起点）。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 轮次 · §七 AC9–AC12 · §九 D3/D11）
 * @see docs/prds/2026-10-29-pomodoro-rounds-semantics.md（T580/T581 · §五 显示规则 · §七 AC1–AC4 · §九 D15）
 * @see docs/qa/2026-10-29-T575-test-contracts.md（§3 视图模型契约）
 */
import { t } from '@nao-todo/shared/locales'

/** 指示器阶段（与计时器一致；`countUp` 不参与轮次） */
export type PomodoroRoundPhase = 'idle' | 'focus' | 'break' | 'longBreak'

export type RoundIndicatorInput = {
    phase: PomodoroRoundPhase
    completedRounds: number
    sessionsUntilLongBreak: number
}

export type RoundIndicatorView = {
    /** 圆点总数 = 每周期轮数 M */
    total: number
    /** 实心圆点数 = 本周期已完成数（≤ total） */
    filled: number
    /** 文字标签（三态兜底，不依赖颜色） */
    label: string
    /** 本轮结束后即进入长休 */
    longBreakUpcoming: boolean
}

/**
 * 计算轮次指示器视图模型
 * @description 越界防守：`completedRounds` 钳制到 `[0, total]`，绝不产出「第 M+1 轮」。
 */
export const resolveRoundIndicator = (input: RoundIndicatorInput): RoundIndicatorView => {
    const rawTotal = Math.floor(input.sessionsUntilLongBreak)
    const total = Number.isFinite(rawTotal) && rawTotal >= 1 ? rawTotal : 1
    const rawCompleted = Math.floor(input.completedRounds)
    const completed = Number.isFinite(rawCompleted) ? Math.min(Math.max(rawCompleted, 0), total) : 0

    if (input.phase === 'idle') {
        // T580/T581（`DEF-112`）：idle 同样遵守「实心数 = 本周期已完成数」，且文案分档。
        // 满周期档（已完成 = M）在引擎里已被归零（长休 / 满周期开新周期）⇒ 此处兜住残留值按新周期显示。
        const filled = completed >= total ? 0 : completed
        const remaining = total - filled
        return {
            total,
            filled,
            label:
                filled === 0
                    ? t('pomodoro.rounds.idle', { count: total })
                    : t('pomodoro.rounds.idleProgress', { completed: filled, remaining }),
            longBreakUpcoming: false
        }
    }

    if (input.phase === 'longBreak') {
        return {
            total,
            filled: 0,
            label: t('pomodoro.rounds.newCycle'),
            longBreakUpcoming: false
        }
    }

    if (input.phase === 'break') {
        return {
            total,
            filled: completed,
            label: t('pomodoro.rounds.resting', { completed, total }),
            longBreakUpcoming: false
        }
    }

    const current = Math.min(completed + 1, total)
    const longBreakUpcoming = current >= total
    const label = t('pomodoro.rounds.current', { current, total })
    return {
        total,
        filled: completed,
        label: longBreakUpcoming ? `${label} · ${t('pomodoro.rounds.upcoming')}` : label,
        longBreakUpcoming
    }
}