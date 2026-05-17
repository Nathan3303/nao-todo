<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import { TASK_REMINDER_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import { t } from '@nao-todo/infrastructure/locales'
import dayjs from 'dayjs'
import useTaskReminder, { SNOOZE_OPTIONS } from './use-task-reminder'
import type { SSEReminderEvent } from '@nao-todo/types'

defineOptions({ name: 'TaskReminder' })

const dialogRef = ref<DialogInstanceType>()
const { visible, close } = useDialogWrapper(dialogRef)
const {
    currentEvent,
    currentTask,
    snoozing,
    dialogManager,
    clearTask,
    loadTask,
    snooze,
    viewDetail
} = useTaskReminder()

const handleClose = () => {
    close()
    clearTask()
}

const handleSnooze = async (minutes: number) => {
    await snooze(minutes)
    handleClose()
}

const handleViewDetail = () => {
    viewDetail()
    handleClose()
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
            <nue-text>{{ t('common.reminder') }}</nue-text>
            <nue-button @click="handleClose" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <div v-if="currentTask || currentEvent" class="reminder-content">
                <nue-text class="reminder-task-name" bold>
                    {{ currentTask?.name || currentEvent?.taskName }}
                </nue-text>
                <nue-text
                    v-if="currentTask?.description"
                    class="reminder-task-desc"
                    color="secondary"
                >
                    {{ currentTask.description }}
                </nue-text>
                <div class="reminder-meta">
                    {{ currentTask?.state }} + {{ currentTask?.priority }}
                </div>
                <div v-if="currentTask?.endAt" class="reminder-meta">
                    <nue-text size="small" color="secondary">
                        {{ t('task.column.endAt') }}：{{
                            dayjs(currentTask.endAt).format('YYYY-MM-DD HH:mm')
                        }}
                    </nue-text>
                </div>
                <div v-if="currentTask?.project?.name" class="reminder-meta">
                    <nue-text size="small" color="secondary">
                        {{ t('task.column.project') }}：{{ currentTask.project.name }}
                    </nue-text>
                </div>
            </div>
        </template>
        <template #footer>
            <div class="reminder-footer">
                <div class="snooze-buttons">
                    <nue-button
                        v-for="opt in SNOOZE_OPTIONS"
                        :key="opt.minutes"
                        :disabled="snoozing"
                        size="small"
                        @click="handleSnooze(opt.minutes)"
                    >
                        {{ opt.label }}
                    </nue-button>
                </div>
                <div class="reminder-actions">
                    <nue-button theme="text" @click="handleViewDetail">
                        {{ t('task.details.view') }}
                    </nue-button>
                    <nue-button @click="handleClose">
                        {{ t('common.close') }}
                    </nue-button>
                </div>
            </div>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--task-reminder {
    min-width: min(22rem, 100vw);
    max-width: 28rem;
}
</style>

<style scoped>
.reminder-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.reminder-task-name {
    font-size: 1.125rem;
}
.reminder-task-desc {
    white-space: pre-wrap;
}
.reminder-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
}
.reminder-footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
}
.snooze-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
}
.reminder-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}
</style>

