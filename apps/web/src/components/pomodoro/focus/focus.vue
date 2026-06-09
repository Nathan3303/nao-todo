<script setup lang="ts">
import { computed } from 'vue'
import { PomodoroFocusRing } from '@/components/pomodoro'
import type { FocusTimerEmits, FocusTimerProps } from './types'

defineOptions({ name: 'PomodoroFocusComp' })
const props = defineProps<FocusTimerProps>()
const emit = defineEmits<FocusTimerEmits>()

// @computed 显示时间 MM:SS 或 HH:MM:SS
const displayTime = computed(() => {
    const secs = props.elapsedSeconds
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) {
        return (
            String(h).padStart(2, '0') +
            ':' +
            String(m).padStart(2, '0') +
            ':' +
            String(s).padStart(2, '0')
        )
    }
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
})

// @computed 时间范围标签
const phaseLabel = computed(() => {
    if (props.status === 'idle') return ''
    const now = Date.now()
    const startTime = new Date(now - props.elapsedSeconds * 1000)
    const fmt = (d: Date) =>
        String(d.getHours()).padStart(2, '0') +
        ':' +
        String(d.getMinutes()).padStart(2, '0') +
        ':' +
        String(d.getSeconds()).padStart(2, '0')
    return `${fmt(startTime)} → 当前`
})

// @computed 是否空闲
const isIdle = computed(() => props.status === 'idle')
const isRunning = computed(() => props.status === 'running')
const isPaused = computed(() => props.status === 'paused')

// @computed 主操作按钮文字
const actionButtonText = computed(() => {
    if (isIdle.value) return '开始专注'
    if (isRunning.value) return '暂停'
    return '继续'
})

// @handlers
const handleMainAction = () => {
    if (isIdle.value) {
        emit('start')
    } else if (isRunning.value) {
        emit('pause')
    } else {
        emit('resume')
    }
}
</script>

<template>
    <nue-div theme="pomodoro-timer">
        <nue-div theme="timer">
            <pomodoro-focus-ring :scale="3" :stroke-width="1" :is-running="isRunning" />
            <nue-div theme="time-wrapper">
                <nue-text v-if="!isIdle" theme="time-duration">{{ phaseLabel }}</nue-text>
                <nue-text theme="time">{{ displayTime }}</nue-text>
                <nue-div theme="below-time-string">
                    <slot name="BelowTimeString">
                        {{ taskName || '选择关联任务' }}
                    </slot>
                </nue-div>
            </nue-div>
        </nue-div>
        <nue-div theme="actions">
            <nue-button v-if="isPaused" icon="clear" @click="emit('cancel')">取消</nue-button>
            <nue-button
                :icon="isRunning ? 'ntd-paused' : 'ntd-start'"
                theme="primary"
                @click="handleMainAction"
            >
                {{ actionButtonText }}
            </nue-button>
            <nue-button v-if="isPaused" icon="ntd-tiaoguo" theme="secondary" @click="emit('end')">
                结束
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<style scoped>
/* 样式继承 timer.vue 的 .nue-div--pomodoro-timer 选择器模式 */
.nue-div--pomodoro-timer {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    gap: var(--nue-gap-xs);

    > .nue-div--timer {
        position: relative;

        .nue-div--time-wrapper {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            justify-content: center;
            align-items: center;
            gap: var(--nue-gap-xs);

            .nue-text--time-duration {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
                position: absolute;
                bottom: 100%;
                cursor: default;
            }

            .nue-text--time {
                width: 8rem;
                text-align: center;
                font-size: 3rem;
                line-height: 1;
                flex: auto;
                padding: var(--nue-padding-sm) 0;
                cursor: default;
            }

            .nue-div--below-time-string {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
                position: absolute;
                top: 100%;
            }
        }
    }

    > .nue-div--actions {
        gap: var(--nue-gap-sm);
        justify-content: center;
        align-items: center;
    }
}
</style>

