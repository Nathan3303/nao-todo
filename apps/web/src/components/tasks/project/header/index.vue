<script setup lang="ts">
import { inject } from 'vue'
import OperationDropdown from './operation-dropdown.vue'
import FilterDropdown from './filter-dropdown.vue'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context.js'
import { PROJECT_VIEW_CONTEXT_KEY } from '../context.js'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; taskId?: string }>()

const { isDisplayAside, switchDisplayAside } = inject(TASKS_VIEW_CONTEXT_KEY)!
const { project, showTaskCreator } = inject(PROJECT_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-header v-if="project">
        <nue-div theme="tasks-header">
            <nue-div align="center">
                <nue-div align="center" flex="1">
                    <nue-button
                        :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                        theme="icon,ghost"
                        @click="switchDisplayAside"
                    />
                    <nue-text theme="pointer,tasks-header__name" :clamped="1">
                        {{ project!.name }}
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
            <nue-div>
                <nue-text size="var(--nue-text-sm)" color="var(--nue-primary-color-700)">
                    {{ project!.description }}
                </nue-text>
            </nue-div>
        </nue-div>
    </nue-header>
</template>