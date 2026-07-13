<script setup lang="ts">
import { PomodoroTimerSettingDialog } from './timer-setting'
import { PomodoroCreatorDialog } from './pomodoro-creator'
import { PomodoroUpdaterDialog } from './pomodoro-updater'

defineOptions({ name: 'PomodoroDialogAdapter' })
</script>

<template>
    <pomodoro-timer-setting-dialog />
    <pomodoro-creator-dialog />
    <pomodoro-updater-dialog />
</template>

<style scoped></style>
