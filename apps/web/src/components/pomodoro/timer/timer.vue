<script setup lang="ts">
import { computed } from 'vue'
import type { TimerEmits, TimerProps } from './types'

defineOptions({ name: 'PomodoroTimerComp' })
const props = defineProps<TimerProps>()
const emit = defineEmits<TimerEmits>()

// @constant 时间调整步长（秒）
const TIME_ADJUST_STEP = 300

// @computed 当前进度百分比
const progress = computed(() => {
    if (props.totalSeconds <= 0) return 0
    return ((props.totalSeconds - props.remainingSeconds) / props.totalSeconds) * 100
})

// @computed 显示时间 MM:SS
const displayTime = computed(() => {
    const mins = Math.floor(props.remainingSeconds / 60)
    const secs = props.remainingSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

// @computed 阶段标签：空闲为空，休息显示"正在休息"，专注显示时间范围
const phaseLabel = computed(() => {
    if (props.phase === 'idle') return ''
    if (props.phase === 'break') return '正在休息'
    if (props.phase === 'longBreak') return '长休息'
    const elapsed = props.totalSeconds - props.remainingSeconds
    const now = Date.now()
    const startTime = new Date(now - elapsed * 1000)
    const endTime = new Date(now + props.remainingSeconds * 1000)
    const fmt = (d: Date) =>
        String(d.getHours()).padStart(2, '0') +
        ':' +
        String(d.getMinutes()).padStart(2, '0') +
        ':' +
        String(d.getSeconds()).padStart(2, '0')
    return `${fmt(startTime)} - ${fmt(endTime)}`
})

// @computed 进度条颜色：休息阶段使用较浅色
const progressColor = computed(() =>
    props.phase === 'break' || props.phase === 'longBreak'
        ? 'var(--nue-primary-color-500)'
        : 'var(--nue-primary-color-900)'
)

// @computed 是否空闲
const isIdle = computed(() => props.phase === 'idle')

// @computed 主操作按钮文字
const actionButtonText = computed(() => {
    if (isIdle.value) return '开始专注'
    if (props.isRunning) return '暂停'
    return '继续'
})

// @computed 主操作按钮图标
const actionButtonIcon = computed(() => {
    if (isIdle.value) return 'ntd-start'
    if (props.isRunning) return 'ntd-paused'
    return 'ntd-start'
})

// @handlers
const handleMainAction = () => {
    if (isIdle.value) {
        emit('start')
    } else if (props.isRunning) {
        emit('pause')
    } else {
        emit('resume')
    }
}

// @handlers
const handleAdjustTime = (delta: number) => {
    emit('adjustTime', delta)
}
</script>

<template>
    <nue-div theme="pomodoro-timer">
        <nue-div theme="timer">
            <nue-progress
                :percentage="progress"
                type="circle"
                hide-text
                :scale="3"
                :stroke-width="1"
                :color="progressColor"
            />
            <nue-div theme="time-wrapper">
                <nue-text v-if="!isIdle" theme="time-duration">{{ phaseLabel }}</nue-text>
                <nue-button
                    icon="ntd-minus"
                    theme="icon,ghost"
                    @click="handleAdjustTime(-TIME_ADJUST_STEP)"
                />
                <nue-text theme="time">{{ displayTime }}</nue-text>
                <nue-button
                    icon="ntd-plus"
                    theme="icon,ghost"
                    @click="handleAdjustTime(TIME_ADJUST_STEP)"
                />
                <nue-div theme="below-time-string">
                    <slot name="BelowTimeString"></slot>
                </nue-div>
            </nue-div>
        </nue-div>
        <nue-div theme="actions">
            <nue-button
                v-if="!isIdle && !isRunning"
                icon="clear"
                @click="emit('reset')"
                title="结束专注"
            >
                结束专注
            </nue-button>
            <nue-button-group>
                <nue-button
                    :icon="actionButtonIcon"
                    theme="primary"
                    @click="handleMainAction"
                    title="开始专注"
                >
                    {{ actionButtonText }}
                </nue-button>
                <nue-button
                    v-if="isIdle"
                    icon="setting"
                    theme="primary,icon"
                    @click="emit('openSettings')"
                    title="番茄钟设置"
                />
            </nue-button-group>
            <nue-button
                v-if="!isIdle && !isRunning"
                icon="ntd-tiaoguo"
                theme="secondary"
                @click="emit('skip')"
                title="跳过专注"
            >
                跳过{{ phase === 'focus' ? '专注' : '休息' }}
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<style src="@/infrastructure/themes/pomodoro-timer.css" scoped></style>
<style scoped>
/* 仅 Timer 独有的 hover 显隐 ± 按钮效果 */
.nue-div--pomodoro-timer > .nue-div--timer {
    &:hover .nue-div--time-wrapper .nue-button--icon {
        opacity: 1;
    }

    .nue-div--time-wrapper .nue-button--icon {
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    }
}

.nue-button-group .nue-button--primary + .nue-button--primary {
    border-left: 1px solid var(--nue-border-color);
}
</style>

