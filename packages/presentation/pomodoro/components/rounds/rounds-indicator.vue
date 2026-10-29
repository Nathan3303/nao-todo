<script setup lang="ts">
/**
 * 番茄轮次指示器（T576 `#3` · AC9–AC12；T581「重新开始本周期」入口）
 *
 * @description **纯展示**：圆点组（实心 / 空心）+ 文字标签，两者由
 *              `resolveRoundIndicator` 的同一份视图模型驱动 ⇒ 三态可辨且不只靠颜色。
 *              **`role="img"` 只包「圆点 + 文案」**（辅助技术会把 `role="img"` 的后代当表现性元素），
 *              行尾的重置入口是其**兄弟节点**、原生 `button`（键盘可达）。
 *              入口仅在 `idle` 且本周期已完成 > 0 时渲染；确认后只调 store 的 `resetCycle()`。
 *              M 上限 10 ⇒ DOM 节点 ≤10。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 轮次 · §七 AC9–AC12 · §九 D3/D11）
 * @see docs/prds/2026-10-29-pomodoro-rounds-semantics.md（T581 · §五 入口 · §七 AC5–AC10 · §九 D12–D15）
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { NueButton, NueConfirm, NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import { usePomodoroSessionStore } from '../../stores/pomodoro-session-store'
import { usePomodoroTimerStore } from '../../stores/pomodoro-timer-store'
import { resolveRoundIndicator } from '../../utils/pomodoro-rounds'

defineOptions({ name: 'PomodoroRoundsIndicator' })

const timerStore = usePomodoroTimerStore()
const { phase, completedRounds } = storeToRefs(timerStore)
const { sessionsUntilLongBreak } = storeToRefs(usePomodoroSessionStore())

const view = computed(() =>
    resolveRoundIndicator({
        phase: phase.value,
        completedRounds: completedRounds.value,
        sessionsUntilLongBreak: sessionsUntilLongBreak.value
    })
)

/** 入口可见性（D14）：仅 idle 且本周期已完成 > 0；其余不渲染，也不做 disabled */
const canResetCycle = computed(() => phase.value === 'idle' && completedRounds.value > 0)

/** 入口文案（可见文案 / `aria-label` / `title` 同源） */
const resetEntryLabel = computed(() => t('pomodoro.rounds.resetEntry'))

const handleResetCycle = async () => {
    const [isByCancel] = await NueConfirm({
        title: t('pomodoro.rounds.resetConfirmTitle'),
        content: t('pomodoro.rounds.resetConfirmContent', { count: completedRounds.value }),
        confirmButtonText: t('pomodoro.rounds.resetConfirm'),
        cancelButtonText: t('common.cancel'),
        theme: 'destructive'
    })
    if (isByCancel) return
    timerStore.resetCycle()
    NueMessage.success(t('pomodoro.rounds.resetSuccess'))
}
</script>

<template>
    <nue-div theme="pomodoro-rounds">
        <!-- 圆点 + 文案 = 单一「图像」：装饰性圆点 + 同一份视图模型的文字标签 -->
        <nue-div theme="rounds-summary" role="img" :aria-label="view.label">
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
        <!-- 重置入口：`role="img"` 之外的原生按钮（可聚焦 / 可 Enter、Space 触发） -->
        <nue-button
            v-if="canResetCycle"
            class="nue-button--rounds-reset"
            theme="ghost"
            size="small"
            :aria-label="resetEntryLabel"
            :title="resetEntryLabel"
            @click="handleResetCycle"
        >
            {{ resetEntryLabel }}
        </nue-button>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-rounds {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--nue-gap-xs);
    /* 与 `ghost` 小号按钮同高 ⇒ 入口出现 / 消失不改变本行高度，不推动计时器（AC10） */
    min-height: var(--nue-box-size-xs);
}

.nue-div--rounds-summary {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--nue-gap-xs);
    min-width: 0;
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

.nue-button--rounds-reset {
    flex: none;
    color: var(--nue-primary-color-600);
}
</style>