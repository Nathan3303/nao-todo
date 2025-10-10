<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { TodoTable } from '@/components/tasks/table'
import { Loading as LoadingComp, Pager } from '@nao-todo/components'
import useTasksMainProjectStore from './use-tasks-main-project-store'

defineOptions({ name: 'TasksMainProjectViewTable' })

const tasksMainProjectStore = useTasksMainProjectStore()

const { responsiveFlag, todos, pagination, tags, loading, error, page, viewProps } =
    storeToRefs(tasksMainProjectStore)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <loading-comp v-if="loading" />
            <nue-empty
                v-else-if="error || !viewProps"
                image-size="4rem"
                image-src="/images/coffee.webp"
                :description="error"
                style="height: 100%"
            />
            <nue-content v-else fill>
                <todo-table
                    :column-options="viewProps.preference.columns"
                    :sort-options="viewProps.preference.getTodosOptions.sort"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="tasksMainProjectStore.showTodoDetails"
                    @clear-sort-options="tasksMainProjectStore.handleClearSortOptions"
                    @update-sort-options="tasksMainProjectStore.handleUpdateSortOptions"
                    @delete-todo="(id) => tasksMainProjectStore.deleteTodo(id)"
                    @restore-todo="(id) => tasksMainProjectStore.restoreTodo(id)"
                />
            </nue-content>
        </nue-main>
        <nue-footer v-if="!error">
            <nue-div v-if="pagination" align="center" justify="space-between">
                <nue-text color="gray" flex size="12px">
                    当前列表 {{ pagination.limit || 0 }} 项， 共计 {{ pagination.total || 0 }} 项。
                </nue-text>
                <pager
                    :limit="pagination.limit"
                    :page="page"
                    :total-pages="pagination.maxPage"
                    :simple="responsiveFlag <= 1"
                    @per-page-change="tasksMainProjectStore.handleUpdatePerPage"
                    @page-change="(p) => (page = p)"
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
