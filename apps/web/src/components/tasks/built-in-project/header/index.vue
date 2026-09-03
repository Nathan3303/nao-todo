<script setup lang="ts">
import { inject } from 'vue'
import { TaskReschedulePanel } from '@nao-todo/presentation/task'
import OperationDropdown from './operation-dropdown.vue'
import FilterDropdown from './filter-dropdown.vue'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '../context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context.js'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; taskId?: string }>()

const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

const { builtInProject, showTaskCreator, taskUseCase, preference, subscriber } = inject(
    BUILT_IN_PROJECT_VIEW_CONTEXT_KEY
)!
</script>

<template>
    <nue-header v-if="builtInProject">
        <nue-div theme="tasks-header">
            <nue-div align="center">
                <nue-div align="center" flex="1">
                    <nue-button
                        :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                        theme="icon,ghost"
                        @click="switchDisplayAside"
                    />
                    <nue-text theme="pointer,tasks-header__name" :clamped="1">
                        {{ builtInProject!.name }}
                    </nue-text>
                </nue-div>
                <nue-div align="center">
                    <task-reschedule-panel
                        v-if="builtInProject!.id === 'overdue'"
                        :task-use-case="taskUseCase"
                        :get-tasks-options="preference!.getTasksOptions"
                        @refresh="subscriber.emit('RefreshData')"
                    />
                    <nue-tooltip content="新增待办" size="small" @click="showTaskCreator">
                        <nue-button icon="plus" theme="icon,ghost" />
                    </nue-tooltip>
                    <filter-dropdown />
                    <operation-dropdown />
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-header>
</template>