<script setup lang="ts">
/**
 * 番茄轮次指示器（T576 `#3` · AC9–AC12）
 *
 * @description **纯展示**：圆点组（实心 / 空心）+ 文字标签，两者由
 *              `resolveRoundIndicator` 的同一份视图模型驱动 ⇒ 三态可辨且不只靠颜色。
 *              容器 `role="img"` + `aria-label`（含文字标签），圆点 `aria-hidden`。
 *              M 上限 10 ⇒ DOM 节点 ≤10；不提供点击（纯展示）。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 轮次 · §七 AC9–AC12 · §九 D3/D11）
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePomodoroSessionStore } from '../../stores/pomodoro-session-store'
import { usePomodoroTimerStore } from '../../stores/pomodoro-timer-store'
import { resolveRoundIndicator } from '../../utils/pomodoro-rounds'

defineOptions({ name: 'PomodoroRoundsIndicator' })

const { phase, completedRounds } = storeToRefs(usePomodoroTimerStore())
const { sessionsUntilLongBreak } = storeToRefs(usePomodoroSessionStore())

const view = computed(() =>
    resolveRoundIndicator({
        phase: phase.value,
        completedRounds: completedRounds.value,
        sessionsUntilLongBreak: sessionsUntilLongBreak.value
    })
)
</script>

<template>
    <nue-div theme="pomodoro-rounds" role="img" :aria-label="view.label">
        <!-- 装饰性圆点：实心 / 空心即状态；文字标签是同一状态的冗余表达 -->
        <nue-div theme="rounds-dots" aria-hidden="true">
            <span
                v-for="index in view.total"
                :key="index"
                class="nue-div--rounds-dot"
                :class="{ 'nue-div--rounds-dot-filled': index <= view.filled }"
            />
        </nue-div>
        <nue-text size="sm" theme="rounds-label">{{ view.label }}</nue-text>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-rounds {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    min-height: 20px;
}

.nue-div--rounds-dots {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    flex: none;
}

.nue-div--rounds-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-sizing: border-box;
    border: 2px solid var(--nue-primary-color-400);
    background: transparent;
}

.nue-div--rounds-dot-filled {
    border-color: var(--nue-primary-color-900);
    background: var(--nue-primary-color-900);
}

.nue-text--rounds-label {
    color: var(--nue-primary-color-900);
    white-space: nowrap;
}
</style>