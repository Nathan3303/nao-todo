<script setup lang="ts">
import { inject } from 'vue'
import OperationDropdown from './operation-dropdown.vue'
import FilterDropdown from './filter-dropdown.vue'
import useHeader from './use-header'
import { type TasksProjectViewContext } from '../use-project-view'
import { TASKS_PROJECT_VIEW_CONTEXT_KEY } from '../constants'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; todoId?: string }>()

const tasksProjectViewContext = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)

const { isDisplayAside, switchAsideDisplay, openTaskCreator } = useHeader()
</script>

<template>
    <nue-header>
        <nue-div v-if="tasksProjectViewContext" theme="tasks-header">
            <nue-div align="center">
                <nue-div align="center" flex="1">
                    <nue-button
                        :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                        theme="icon,ghost"
                        @click="switchAsideDisplay()"
                    />
                    <nue-text theme="pointer,tasks-header__name">
                        {{ tasksProjectViewContext.project.value!.name }}
                    </nue-text>
                </nue-div>
                <nue-div align="center">
                    <nue-tooltip content="新增待办" size="small" @click="openTaskCreator">
                        <nue-button icon="plus" theme="icon,ghost" />
                    </nue-tooltip>
                    <filter-dropdown />
                    <operation-dropdown />
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-header>
</template>
