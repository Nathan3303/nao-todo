<script setup lang="ts">
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { PomodoroTimerSettingDialog } from '@nao-todo/domain/pomodoro'
import { inject } from 'vue'

defineOptions({ name: 'PomodoroDialogAdapter' })

const { dialogManager } = inject(POMODORO_VIEW_CONTEXT_KEY)!
</script>

<template>
    <pomodoro-timer-setting-dialog :dialog-manager="dialogManager" />
</template>

