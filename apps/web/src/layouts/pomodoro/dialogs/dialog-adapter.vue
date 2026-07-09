<script setup lang="ts">
import { PomodoroTimerSettingDialog } from './timer-setting'
import { PomodoroCreatorDialog } from './pomodoro-creator'

defineOptions({ name: 'PomodoroDialogAdapter' })
</script>

<template>
    <pomodoro-timer-setting-dialog />
    <pomodoro-creator-dialog />
</template>

<style scoped></style>
