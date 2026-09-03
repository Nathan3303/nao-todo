<script setup lang="ts">
import { TaskCheckButton, t } from '@nao-todo/shared'
import { TaskDateSelector } from '../../date-selector'
import { inject } from 'vue'
import type { UpdateTaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'

const emit = defineEmits<{ (e: 'reload'): void }>()

const { vo, refreshKey, closeDetails, updateTaskDetails } = inject(TASK_DETAILS_CONTEXT_KEY)!

const switchState = () => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, { state: vo.value.isDone ? 'todo' : 'done' })
}

const updateDateAndRemind = (updateVO: UpdateTaskViewObject) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, updateVO)
}
</script>

<template>
    <nue-header v-if="vo">
        <nue-div theme="left">
            <task-check-button :is-done="vo.isDone" @change="switchState" />
            <task-date-selector
                :colored="!vo.isDone"
                :start-at="vo.startAt"
                :end-at="vo.endAt"
                :task="vo"
                :refresh-key="refreshKey"
                @update-all="updateDateAndRemind"
            />
        </nue-div>
        <nue-div align="center" gap="0">
            <!-- <nue-button-group>
                <nue-button icon="refresh" theme="icon,small" />
            </nue-button-group> -->
            <nue-button icon="clear" theme="icon,small" @click="closeDetails">
                {{ t('task.details.close') }}
            </nue-button>
        </nue-div>
    </nue-header>
</template>

<style scoped>
.nue-header {
    padding: 1rem;
    width: 100%;
    height: auto;
    align-items: center;
    gap: 0;
    justify-content: space-between;
    flex-wrap: wrap;

    > .nue-div--left {
        align-items: center;
    }
}
</style>