<script setup lang="ts">
import { inject } from 'vue'
import OperationDropdown from './operation-dropdown.vue'
import FilterDropdown from './filter-dropdown.vue'
import { useTasksViewStore } from '@/views/index/tasks'
import { PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { ProjectViewContext } from '../types'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; taskId?: string }>()

const tasksViewStore = useTasksViewStore()

const { isDisplayAside } = storeToRefs(tasksViewStore)
const viewContext = inject<ProjectViewContext>(PROJECT_VIEW_CONTEXT_KEY)

const updateName = () => {
    if (!viewContext || !viewContext.project.value) return
    viewContext.projectHandlers.updateProjectNameByNuePrompt(viewContext.project.value.id)
}

const updateDescription = () => {
    if (!viewContext || !viewContext.project.value) return
    viewContext.projectHandlers.updateProjectDescriptionByNuePrompt(viewContext.project.value.id)
}
</script>

<template>
    <nue-header v-if="viewContext">
        <nue-div theme="tasks-header">
            <nue-div align="center">
                <nue-div align="center" flex="1">
                    <nue-button
                        :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                        theme="icon,ghost"
                        @click="isDisplayAside = !isDisplayAside"
                    />
                    <nue-text theme="pointer,tasks-header__name" :clamped="1" @click="updateName">
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
            <nue-div>
                <nue-text
                    theme="pointer,tasks-header__description"
                    :clamped="3"
                    @click="updateDescription"
                >
                    {{
                        viewContext.project.value
                            ? viewContext.project.value.description
                            : '添加清单描述'
                    }}
                </nue-text>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

