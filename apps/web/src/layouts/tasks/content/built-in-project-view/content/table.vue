<script setup lang="ts">
import { TodoTable } from '@/components/tasks/table'
import {
    type TasksProjectViewContentContext,
    TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY
} from './use-content'
import { inject } from 'vue'

defineOptions({ name: 'TasksMainProjectViewTable' })

const viewContext = inject<TasksProjectViewContentContext>(TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    v-if="
                        !viewContext || !viewContext.columns.value || !viewContext.sortOptions.value
                    "
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    description="数据加载失败"
                    style="height: 100%"
                />
                <todo-table
                    v-else
                    :tags="viewContext.tags.value"
                    :tasks="viewContext.tasks.value"
                    :columns="viewContext.columns.value"
                    :sort-options="viewContext.sortOptions.value"
                    :column-label-getter="viewContext.getColumnLabel"
                    :project-name-getter="viewContext.getProjectName"
                    @show-task-details="viewContext.showTaskDetails"
                    @clear-sort-options="viewContext.clearSortOptions"
                    @update-columns="viewContext.updateColumns"
                    @update-sort-options="viewContext.updateSortOptions"
                    @delete-task="viewContext.deleteTask"
                    @restore-task="viewContext.restoreTask"
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
