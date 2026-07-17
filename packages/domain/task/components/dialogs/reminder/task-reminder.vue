<script lang="ts" setup>
import {
    TASK_REMINDER_DIALOG_KEY,
    t,
    useDialogWrapper,
    type DialogInstanceType
} from '@nao-todo/shared'
import { onMounted, ref } from 'vue'
import type { SSEReminderEvent } from '../../../types'
import useTaskReminder, { SNOOZE_OPTIONS } from './use-task-reminder'
import { TaskReminderDialogProps } from './type'

defineOptions({ name: 'TaskReminderDialog' })
const props = defineProps<TaskReminderDialogProps>()

const dialogRef = ref<DialogInstanceType>()
const { visible, close } = useDialogWrapper(dialogRef)
const {
    currentEvent,
    totalCount,
    progressPercent,
    progressText,
    snoozing,
    dialogManager,
    enqueue,
    resetQueue,
    snooze,
    confirm,
    viewDetail
} = useTaskReminder(props)

const handleClose = () => {
    close()
    resetQueue()
}

const handleSnooze = async (minutes: number) => {
    await snooze(minutes)
    if (!currentEvent.value) handleClose()
}

const handleConfirm = () => {
    confirm()
    if (!currentEvent.value) handleClose()
}

const handleSnoozeExecute = (executeId: string) => {
    handleSnooze(Number(executeId))
}

onMounted(() => {
    dialogManager.register(TASK_REMINDER_DIALOG_KEY, {
        open: (payload?: SSEReminderEvent) => {
            if (!payload) return
            const wasEmpty = totalCount.value === 0
            enqueue(payload)
            if (wasEmpty) visible.value = true
        },
        close: handleClose
    })
})
</script>

<template>
    <nue-dialog theme="task-reminder" v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text theme="reminder__title">{{ t('common.reminder') }}</nue-text>
            <nue-div v-if="totalCount" theme="reminder__progress">
                <nue-text>{{ progressText }}</nue-text>
                <nue-progress :percentage="progressPercent" />
            </nue-div>
        </template>
        <template #content>
            <nue-div v-if="currentEvent" theme="reminder__name-desc">
                <nue-text theme="reminder__task-name" @click="viewDetail">
                    {{ currentEvent.taskName }}
                </nue-text>
                <nue-text v-if="currentEvent.description" theme="reminder__task-desc">
                    {{ currentEvent.description }}
                </nue-text>
            </nue-div>
            <nue-div theme="reminder__actions">
                <nue-button size="small" theme="primary" @click="handleConfirm">
                    {{ t('dialog.taskReminder.confirm') }}
                </nue-button>
                <nue-dropdown size="small" @execute="handleSnoozeExecute" close-when-executed>
                    <template #trigger="{ trigger }">
                        <nue-button
                            theme="text"
                            size="small"
                            :disabled="snoozing"
                            @click="trigger"
                            icon="time"
                        >
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
