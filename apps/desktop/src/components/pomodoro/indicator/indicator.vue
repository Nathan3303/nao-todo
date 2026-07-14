<script setup lang="ts">
import { PomodoroIndicator } from '@nao-todo/components'
import { useIndicator } from './use-indicator'

defineOptions({ name: 'PomodoroIndicator' })
defineProps<{ route?: string }>()

const {
    progress,
    indicatorColor,
    phaseLabel,
    timeDisplay,
    taskName,
    isTimerRunning,
    isFocusRunning,
    goToTimer
} = useIndicator()
</script>

<template>
    <pomodoro-indicator
        :route="route"
        :progress="progress"
        :indicator-color="indicatorColor"
        :phase-label="phaseLabel"
        :time-display="timeDisplay"
        :task-name="taskName"
        :is-timer-running="isTimerRunning"
        :is-focus-running="isFocusRunning"
        @go="goToTimer"
    />
</template>
