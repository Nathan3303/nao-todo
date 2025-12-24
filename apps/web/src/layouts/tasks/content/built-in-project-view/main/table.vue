<script setup lang="ts">
import { TodoTable } from '@/components/tasks/table'
import { type TasksProjectViewContentContext } from './use-content'
import { inject } from 'vue'
import { TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY } from '../constants'

defineOptions({ name: 'TasksMainProjectViewTable' })

const {
    tags,
    tasks,
    columns,
    sortOptions,
    getColumnLabel,
    getProjectName,
    showTaskDetails,
    clearSortOptions,
    updateColumns,
    updateSortOptions,
    deleteTask,
    restoreTask
} = inject<TasksProjectViewContentContext>(TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    v-if="!columns || !sortOptions"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    description="数据加载失败"
                    style="height: 100%"
                />
                <todo-table
                    v-else
                    :tags="tags"
                    :tasks="tasks"
                    :columns="columns!"
                    :sort-options="sortOptions"
                    :column-label-getter="getColumnLabel"
                    :project-name-getter="getProjectName"
                    @show-task-details="showTaskDetails"
                    @clear-sort-options="clearSortOptions"
                    @update-columns="updateColumns"
                    @update-sort-options="updateSortOptions"
                    @delete-task="deleteTask"
                    @restore-task="restoreTask"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainTableContainer {
    gap: 0.5rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
}
</style>
