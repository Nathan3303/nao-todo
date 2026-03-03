<script setup lang="ts">
import { inject } from 'vue'
import { TaskCheckButton, TaskDateSelector } from '@nao-todo/components'
import { TASK_DETAILS_CONTEXT_KEY } from '../constants'
import type { TaskDetailsContext } from '../types'
import type { Task } from '@nao-todo/types'

const { vo, closeDetails, taskHandler } = inject<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY)!

const switchState = () => {
    if (vo.value === null) return
    taskHandler.updateTaskState(vo.value.id, vo.value.isDone ? 'todo' : 'done')
}

const updateEndAt = () => {
    if (vo.value === null) return
    taskHandler.updateTaskEndAt(vo.value.id, vo.value.endAt as Task['endAt'])
}
</script>

<template>
    <nue-header v-if="vo">
        <nue-div style="padding: 1rem" width="100%" auto-fit>
            <nue-div align="center" flex="1">
                <task-check-button :is-done="vo.isDone" @change="switchState" />
                <nue-divider vertical />
                <task-date-selector
                    :colored="!vo.isDone"
                    v-model="vo.endAt"
                    @change="updateEndAt"
                />
            </nue-div>
            <nue-div align="center">
                <nue-button icon="clear" theme="small" @click="closeDetails">关闭</nue-button>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<style scoped>
.nue-button--update {
    --nue-button-color: orange;
}
</style>

