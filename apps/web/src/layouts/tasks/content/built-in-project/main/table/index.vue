<script setup lang="ts">
import { TaskTable } from '@/components/tasks'
import useTable from './use-table'
import { Pager } from '@nao-todo/components'

defineOptions({ name: 'TasksMainProjectViewTable' })

const { viewContext, taskLoader, initTable, handleUpdatePage, handleUpdatePerPage } = useTable()

initTable()
</script>

<template>
    <nue-container v-if="viewContext" id="TasksMainTableContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    v-if="!viewContext.preference.value"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    description="数据加载失败"
                    style="height: 100%"
                />
                <task-table
                    v-else
                    :tags="viewContext.tags.value"
                    :tasks="viewContext.tasks.value"
                    :loading="taskLoader.states.loading"
                    :columns="viewContext.preference.value.columns"
                    :get-options="viewContext.preference.value.getTasksOptions"
                    :column-label-getter="viewContext.getColumnLabel"
                    :project-name-getter="viewContext.getProjectName"
                    @show-task-details="viewContext.showTaskDetails"
                    @update-columns="viewContext.builtInProjectHandlers.updateColumns"
                    @update-sort-options="viewContext.builtInProjectHandlers.updateSortOptions"
                    @clear-sort-options="viewContext.builtInProjectHandlers.clearSortOptions"
                    @delete-task="viewContext.taskHandlers.deleteTask"
                    @restore-task="viewContext.taskHandlers.restoreTask"
                />
            </nue-content>
        </nue-main>
        <nue-footer v-if="viewContext">
            <nue-div align="center" justify="space-between" width="100%" wrap="wrap">
                <nue-text flex>
                    当前列表 {{ viewContext.tasks.value.length || 0 }} 项， 共计
                    {{ taskLoader.states.pagination.total || 0 }} 项。
                </nue-text>
                <pager
                    :disabled="taskLoader.states.disabled"
                    :limit="taskLoader.states.pagination.limit"
                    :page="taskLoader.states.pagination.page"
                    :total-pages="taskLoader.states.pagination.maxPage"
                    @per-page-change="handleUpdatePerPage"
                    @page-change="handleUpdatePage"
                />
            </nue-div>
        </nue-footer>
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

