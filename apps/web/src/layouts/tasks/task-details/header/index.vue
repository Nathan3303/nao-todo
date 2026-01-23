<script setup lang="ts">
import { inject } from 'vue'
import { TodoCheckButton, TodoDateSelector } from '@nao-todo/components'
import { TASK_DETAILS_CONTEXT_KEY } from '../constants'
import type { TaskDetailsContext } from '../types'

const { vo, finishTask, closeDetails, updateEndAt } =
    inject<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY)!
</script>

<template>
    <nue-header v-if="vo">
        <nue-div style="padding: 1rem" width="100%" auto-fit>
            <nue-div align="center" flex="1">
                <todo-check-button :is-done="vo.isDone" @change="finishTask" />
                <nue-divider vertical />
                <todo-date-selector
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
