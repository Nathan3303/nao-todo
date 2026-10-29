/**
 * 番茄页签标题同步（T576 `#2` · AC5 / AC6 · Web / 桌面共用装配层）
 *
 * @description 把计时状态写入 `document.title`，复用引擎既有 250ms tick 的**秒级变化**
 *              （`createPomodoroTitleSync` 内按值去重 ⇒ 不新增定时器）。
 *              同步器不接收路由 / 页面生命周期入参 ⇒ 离开番茄页但引擎仍在跑时**继续更新**；
 *              `idle` / 结束 / 取消 / 卸载一律复位为 `NaoTodo`。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 页签标题 · §七 AC5 / AC6 · §九 D9）
 * @see docs/qa/2026-10-29-T575-test-contracts.md（§2 标题契约）
 */
import { onUnmounted, watch } from 'vue'
import { usePomodoroTimerStore } from '../stores'
import { createPomodoroTitleSync } from '../utils'

export const usePomodoroTitle = (): void => {
    const timerStore = usePomodoroTimerStore()

    const titleSync = createPomodoroTitleSync({
        getSnapshot: () => ({
            phase: timerStore.phase,
            status: timerStore.status,
            remainingSeconds: timerStore.remainingSeconds
        }),
        writeTitle: (title) => {
            if (typeof document !== 'undefined') document.title = title
        }
    })

    watch(
        () => [timerStore.phase, timerStore.status, timerStore.remainingSeconds],
        () => titleSync.sync(),
        { immediate: true }
    )

    // 卸载（登出 / 应用容器销毁）⇒ 恢复基线标题，不残留旧倒计时
    onUnmounted(() => titleSync.restore())
}