<script setup lang="ts">
import { inject } from 'vue'
import OperationDropdown from './operation-dropdown.vue'
import FilterDropdown from './filter-dropdown.vue'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewContext } from '../types'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; taskId?: string }>()

const { isDisplayAside, switchDisplayAside } = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

const { builtInProject, showTaskCreator } = inject<BuiltInProjectViewContext>(
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

