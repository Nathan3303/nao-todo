<script setup lang="ts">
import { TaskList } from '@/components/tasks'
import useListViewAdapter from './use-list-view-adapter'
import type { ListViewAdapterProps } from './types'

defineOptions({ name: 'ListViewAdapter' })
const props = defineProps<ListViewAdapterProps>()

const { tasks, taskLoader, handleNextPage } = useListViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainTableContainer" style="padding-top: 0.5rem">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <task-list
                    :tags="tags"
                    :tasks="tasks"
                    :loading="taskLoader.states.loading"
                    :error="taskLoader.states.error"
                    :disabled-next-page="taskLoader.states.isDone"
                    :columns="columns"
                    :sort-options="getTasksOptions.sort || { field: 'createdAt', order: 'desc' }"
                    :column-label-getter="getColumnLabel"
                    :project-name-getter="getProjectName"
                    @show-task-details="showTaskDetails"
                    @update-columns="updateColumns"
                    @update-sort-options="updateSortOptions"
                    @clear-sort-options="clearSortOptions"
                    @delete-task="(taskId) => taskUseCase.removeTask(taskId)"
                    @restore-task="(taskId) => taskUseCase.restoreTask(taskId)"
                    @next-page="handleNextPage"
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
