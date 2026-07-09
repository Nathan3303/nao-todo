<script setup lang="ts">
import { inject } from 'vue'
import { TaskCheckButton, TaskDateSelector } from '@nao-todo/components'
import type { TaskRemindSetterUpdateVO } from '@nao-todo/components'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/usecases/task'
import dayjs from 'dayjs'
import { t } from '@nao-todo/infrastructure/locales'

const { vo, closeDetails, taskHandler } = inject(TASK_DETAILS_CONTEXT_KEY)!

const switchState = () => {
    if (vo.value === null) return
    taskHandler.updateTaskState(vo.value.id, vo.value.isDone ? 'todo' : 'done')
}

const updateEndAt = () => {
    if (vo.value === null) return
    taskHandler.updateTaskEndAt(vo.value.id, vo.value.endAt as TaskViewObject['endAt'])
}

const updateEndAtToNow = () => {
    if (vo.value === null) return
    taskHandler.updateTaskEndAt(vo.value.id, dayjs().toISOString())
}

const updateRemind = (updateVO: TaskRemindSetterUpdateVO) => {
    if (vo.value === null) return
    taskHandler.update(vo.value.id, { ...updateVO })
}

const updateEndAtAndRemind = (updateVO: UpdateTaskViewObject) => {
    if (vo.value === null) return
    taskHandler.update(vo.value.id, updateVO)
}
</script>

<template>
    <nue-header v-if="vo">
        <nue-div v-if="vo.endAt" style="padding: 1rem" width="100%" auto-fit>
            <nue-div align="center" flex="1">
                <task-check-button :is-done="vo.isDone" @change="switchState" />
                <nue-divider vertical />
                <task-date-selector
                    :colored="!vo.isDone"
                    v-model="vo.endAt"
                    :task="vo"
                    @change="updateEndAt"
                    @remind-change="updateRemind"
                    @update-all="updateEndAtAndRemind"
                />
            </nue-div>
            <nue-div align="center">
                <nue-button icon="clear" theme="small" @click="closeDetails">{{
                    t('task.details.close')
                }}</nue-button>
            </nue-div>
        </nue-div>
        <nue-button v-else icon="clock" theme="small" @click="updateEndAtToNow">
            {{ t('task.details.setEndTime') }}
        </nue-button>
    </nue-header>
</template>

<style scoped>
.nue-button--update {
    --nue-button-color: orange;
}
</style>

