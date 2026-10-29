/**
 * 番茄页签标题 / 托盘 tooltip 文案（T576 · PRD `#2` · AC5 / AC6）
 *
 * @description **单函数单源**（D8/C1+C2）：浏览器页签标题与桌面托盘 tooltip 共用
 *              `formatPomodoroTitle` 的同一输出，两端不得各拼一套文案。
 *              文案：`24:59 · 专注` / `04:30 · 休息` / `14:59 · 长休息` / `12:34 · 正计时`；
 *              暂停统一前缀 `⏸ `；`idle` 返回 `null`（调用方据此复位）。
 *              写入节流 = **秒数未变不写**（复用引擎既有 250ms tick，不新增定时器）。
 *              复位值恒为 `NaoTodo`（D9/C3，非空串 —— Electron `setToolTip('')` 等于移除 tooltip）。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 页签标题 · §七 AC5 / AC6 · §九 D8/D9）
 * @see docs/qa/2026-10-29-T575-test-contracts.md（§2 标题契约）
 */
import { t } from '@nao-todo/shared/locales'
import { formatClock } from './pomodoro'

/** 可展示进标题的计时阶段（`countUp` = 正计时） */
export type PomodoroTitlePhase = 'idle' | 'focus' | 'break' | 'longBreak' | 'countUp'

/** 标题快照（引擎的只读投影） */
export type PomodoroTitleSnapshot = {
    phase: PomodoroTitlePhase
    status: 'running' | 'paused'
    remainingSeconds: number
}

/** 复位标题（D9：非空串；也是应用启动基线） */
export const POMODORO_TITLE_RESET = 'NaoTodo'

/** 阶段文案（新增文案走 i18n，中英齐备） */
const PHASE_LABEL_KEYS = {
    focus: 'pomodoro.title.focus',
    break: 'pomodoro.title.break',
    longBreak: 'pomodoro.title.longBreak',
    countUp: 'pomodoro.title.countUp'
} as const

/**
 * 生成标题文案
 * @returns 非空标题串；`idle` ⇒ `null`（= 调用方复位为 `POMODORO_TITLE_RESET`）
 */
export const formatPomodoroTitle = (input: PomodoroTitleSnapshot): string | null => {
    if (input.phase === 'idle') return null
    const clock = formatClock(Math.max(0, Math.floor(input.remainingSeconds)))
    const label = t(PHASE_LABEL_KEYS[input.phase])
    const pausedPrefix = input.status === 'paused' ? '⏸ ' : ''
    return `${pausedPrefix}${clock} · ${label}`
}

/**
 * 创建标题同步器（写 DOM 的节流器）
 * @description 不接受路由 / 页面生命周期入参 ⇒ 「离开番茄页但引擎仍在跑」时继续更新
 *              （路由守卫属装配层责任）。重复写同值不落 DOM。
 * @param deps 快照读取 + 标题写入
 */
export const createPomodoroTitleSync = (deps: {
    getSnapshot(): PomodoroTitleSnapshot
    writeTitle(title: string): void
}): { sync(): void; restore(): void } => {
    let lastWritten: string | null = null

    const write = (title: string): void => {
        if (title === lastWritten) return
        lastWritten = title
        deps.writeTitle(title)
    }

    const sync = (): void => {
        let title: string | null
        try {
            title = formatPomodoroTitle(deps.getSnapshot())
        } catch {
            // 快照读取异常 ⇒ 复位，绝不把空串写进页面标题
            title = null
        }
        write(title ?? POMODORO_TITLE_RESET)
    }

    const restore = (): void => {
        write(POMODORO_TITLE_RESET)
    }

    return { sync, restore }
}