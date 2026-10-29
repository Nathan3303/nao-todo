/**
 * 托盘 tooltip 同步（T576 `#2` · AC7 / AC8 · 桌面渲染层）
 *
 * @description 把番茄计时状态经**单向通道**写到主进程托盘 tooltip：
 *              - 载荷 = `formatPomodoroTitle` 的**同一字符串**（与页签标题单源，D8）；
 *              - 节流 = **按值去重**（文案含 `MM:SS` ⇒ 天然 ≤1 次/秒；不新增定时器、不看可见性）；
 *              - 复位（D9）= `NaoTodo`（非空串；`setToolTip('')` 会被 Electron 当作移除）；
 *              - 降级（AC8）：无 `desktopAPI` / 旧桥缺方法 / 发送抛错 ⇒ 静默 no-op，**不 console.error**。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 页签标题 · §七 AC7 / AC8 · §九 D8/D9/D10）
 * @see docs/reports/T574-arch-review.md（§二 通道规格 · §三 节流与背压 · §四 失败降级）
 */
import {
    formatPomodoroTitle,
    POMODORO_TITLE_RESET,
    usePomodoroTimerStore
} from '@nao-todo/presentation/pomodoro'
import { onUnmounted, watch } from 'vue'
import { getDesktopBridge } from '../desktop-bridge'

export const useTrayTooltip = (): void => {
    const timerStore = usePomodoroTimerStore()
    const bridge = getDesktopBridge()
    let lastSent: string | null = null

    const push = (text: string): void => {
        if (text === lastSent) return
        lastSent = text
        // 旧桥 / 测试桩缺方法 / 发送抛错 ⇒ 静默 no-op（AC8：不得有控制台错误）
        if (!bridge || typeof bridge.setTrayTooltip !== 'function') return
        try {
            bridge.setTrayTooltip(text)
        } catch {
            // 通道未注册 / 窗口销毁中：丢一条由下一 tick 自愈（ADR §三 背压）
        }
    }

    const sync = (): void => {
        const title = formatPomodoroTitle({
            phase: timerStore.phase,
            status: timerStore.status,
            remainingSeconds: timerStore.remainingSeconds
        })
        push(title ?? POMODORO_TITLE_RESET)
    }

    watch(
        () => [timerStore.phase, timerStore.status, timerStore.remainingSeconds],
        () => sync(),
        { immediate: true }
    )

    // 卸载（窗口销毁 / 登出）⇒ 复位，避免 tooltip 残留旧倒计时
    onUnmounted(() => {
        push(POMODORO_TITLE_RESET)
    })
}