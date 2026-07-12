<script setup lang="ts">
import { inject } from 'vue'
import { TaskCheckButton, TaskDateSelector } from '@nao-todo/components'
import type { TaskRemindSetterUpdateVO } from '@nao-todo/components'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/usecases/task'
import dayjs from 'dayjs'
import { t } from '@nao-todo/infrastructure/locales'

const { vo, closeDetails, updateTaskDetails } = inject(TASK_DETAILS_CONTEXT_KEY)!

const switchState = () => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { state: vo.value.isDone ? 'todo' : 'done' })
}

const updateEndAt = () => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { endAt: vo.value.endAt as TaskViewObject['endAt'] })
}

const updateEndAtToNow = () => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { endAt: dayjs().toISOString() })
}

const updateRemind = (updateVO: TaskRemindSetterUpdateVO) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, updateVO)
}

const updateEndAtAndRemind = (updateVO: UpdateTaskViewObject) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, updateVO)
}
</script>

<template>
    <nue-header v-if="vo">
        <nue-div align="center" flex="1">
            <task-check-button :is-done="vo.isDone" @change="switchState" />
            <nue-divider vertical />
            <task-date-selector
                v-if="vo.endAt"
                :colored="!vo.isDone"
                v-model="vo.endAt"
                :task="vo"
                @change="updateEndAt"
                @remind-change="updateRemind"
                @update-all="updateEndAtAndRemind"
            />
            <nue-button v-else icon="clock" theme="small" @click="updateEndAtToNow">
                {{ t('task.details.setEndTime') }}
            </nue-button>
        </nue-div>
        <nue-div align="center" gap="0">
            <nue-button icon="clear" theme="small" @click="closeDetails">
                {{ t('task.details.close') }}
            </nue-button>
        </nue-div>
    </nue-header>
</template>

<style scoped>
.nue-header {
    padding: 1rem;
    height: auto;
    width: 100%;
}

.nue-button--update {
    --nue-button-color: orange;
}
</style>

