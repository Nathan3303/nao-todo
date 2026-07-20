<script setup lang="ts">
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import {
    PomodoroTimerSettingDialog,
    PomodoroCreatorDialog,
    PomodoroUpdaterDialog
} from '@nao-todo/presentation/pomodoro'
import { inject } from 'vue'

defineOptions({ name: 'PomodoroDialogAdapter' })

const { dialogManager, pomodoroUseCase } = inject(POMODORO_VIEW_CONTEXT_KEY)!
</script>

<template>
    <pomodoro-timer-setting-dialog :dialog-manager="dialogManager" />
    <pomodoro-creator-dialog :pomodoro-use-case="pomodoroUseCase" :dialog-manager="dialogManager" />
    <pomodoro-updater-dialog :pomodoro-use-case="pomodoroUseCase" :dialog-manager="dialogManager" />
</template>
