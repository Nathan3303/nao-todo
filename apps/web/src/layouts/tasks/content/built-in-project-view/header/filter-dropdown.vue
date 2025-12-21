<script setup lang="ts">
import { useRoute } from 'vue-router'
import TextFilter from '@/components/tasks/dropdowns/input-filter.vue'
import { type TasksProjectViewContext, TASKS_PROJECT_VIEW_CONTEXT_KEY } from '../use-project-view'
import { inject } from 'vue'

defineOptions({ name: 'TasksTodoFilterDropdown' })
defineEmits<{ (e: 'getTodos'): void }>()

const route = useRoute()
const viewContext = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)
</script>

<template>
    <nue-dropdown
        v-if="viewContext"
        placement="bottom-end"
        size="small"
        theme="menu"
        group="tasks-todo-filter"
    >
        <template #trigger="{ trigger }">
            <nue-badge theme="for-ico-btn" dot>
                <nue-button icon="filter" theme="icon,ghost" @click.stop="trigger" />
            </nue-badge>
        </template>
        <nue-div vertical gap=".25rem" width="100%">
            <nue-div theme="block">
                <nue-text theme="title">筛选</nue-text>
                <text-filter
                    placeholder="筛选任务"
                    v-model="viewContext.preference.value?.getTasksOptions.name"
                />
            </nue-div>
            <nue-divider />
            <nue-div theme="block">
                <nue-text theme="title">排序</nue-text>
            </nue-div>
        </nue-div>
    </nue-dropdown>
</template>

<style scoped></style>
