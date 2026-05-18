<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import { TASK_REMINDER_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import { t } from '@nao-todo/infrastructure/locales'
import useTaskReminder, { SNOOZE_OPTIONS } from './use-task-reminder'
import type { SSEReminderEvent } from '@nao-todo/types'

defineOptions({ name: 'TaskReminder' })

const dialogRef = ref<DialogInstanceType>()
const { visible, close } = useDialogWrapper(dialogRef)
const { currentEvent, dialogManager, clearTask, loadTask, snooze, viewDetail } = useTaskReminder()

const handleClose = () => {
    close()
    clearTask()
}

const handleSnooze = async (minutes: number) => {
    await snooze(minutes)
}

const handleSnoozeExecute = (executeId: string) => {
    const minutes = Number(executeId)
    handleSnooze(minutes)
}

onMounted(() => {
    dialogManager.register(TASK_REMINDER_DIALOG_KEY, {
        open: (payload?: SSEReminderEvent) => {
            loadTask(payload)
            visible.value = true
        },
        close: handleClose
    })
})
</script>

<template>
    <nue-dialog theme="task-reminder" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text theme="reminder__title">{{ t('common.reminder') }}</nue-text>
            <nue-div theme="reminder__progress">
                <nue-text>已处理 4 个提醒，剩余 1 个</nue-text>
                <nue-progress :percentage="80" />
            </nue-div>
        </template>
        <template #content>
            <nue-div v-if="currentEvent" theme="reminder__name-desc">
                <nue-text theme="reminder__task-name" @click="viewDetail">
                    {{ currentEvent?.taskName }}
                </nue-text>
                <nue-text v-if="currentEvent?.description" theme="reminder__task-desc">
                    {{ currentEvent.description }}
                </nue-text>
            </nue-div>
            <nue-div theme="reminder__actions">
                <nue-button size="small" theme="primary">
                    {{ t('dialog.taskReminder.confirm') }}
                </nue-button>
                <nue-dropdown size="small" @execute="handleSnoozeExecute">
                    <template #trigger="{ trigger }">
                        <nue-button theme="text" size="small" @click="trigger" icon="time">
                            {{ t('common.snooze') }}
                        </nue-button>
                    </template>
                    <nue-dropdown-item
                        v-for="opt in SNOOZE_OPTIONS"
                        :key="opt.minutes"
                        :execute-id="opt.minutes + ''"
                        :text="opt.label"
                    />
                </nue-dropdown>
            </nue-div>
        </template>
    </nue-dialog>
</template>

<style>
@import './task-reminder.css';
</style>

