<script setup lang="ts">
import { inject } from 'vue'
import OperationDropdown from './operation-dropdown.vue'
import FilterDropdown from './filter-dropdown.vue'
import { useTasksViewStore } from '@/views/tasks'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewContext } from '../types'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; taskId?: string }>()

const tasksViewStore = useTasksViewStore()

const { isDisplayAside } = storeToRefs(tasksViewStore)
const viewContext = inject<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY)
</script>

<template>
    <nue-header v-if="viewContext">
        <nue-div theme="tasks-header">
            <nue-div align="center">
                <nue-div align="center" flex="1">
                    <nue-button
                        :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                        theme="icon,ghost"
                        @click="tasksViewStore.switchDisplayAside"
                    />
                    <nue-text theme="pointer,tasks-header__name" :clamped="1">
                        {{ viewContext.project.value!.name }}
                    </nue-text>
                </nue-div>
                <nue-div align="center">
                    <nue-tooltip
                        content="新增待办"
                        size="small"
                        @click="viewContext.showTaskCreator"
                    >
                        <nue-button icon="plus" theme="icon,ghost" />
                    </nue-tooltip>
                    <filter-dropdown />
                    <operation-dropdown />
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

