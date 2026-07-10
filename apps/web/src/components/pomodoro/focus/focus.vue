<script setup lang="ts">
import { computed } from 'vue'
import { PomodoroFocusRing } from '@/components/pomodoro'
import type { FocusEmits, FocusProps } from './types'

defineOptions({ name: 'PomodoroFocusComp' })
const props = defineProps<FocusProps>()
const emit = defineEmits<FocusEmits>()

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
    return `开始于 ${fmt(startTime)}`
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
                <nue-text style="width: auto" theme="time">{{ displayTime }}</nue-text>
                <nue-div theme="below-time-string">
                    <slot name="BelowTimeString"></slot>
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

<style src="@/infrastructure/themes/pomodoro-timer.css" scoped></style>

