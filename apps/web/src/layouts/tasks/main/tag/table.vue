<script setup lang="ts">
import { TodoTable } from '@/components/tasks/table'
import { Loading as LoadingComp, Pager } from '@/components/ui'
import { useTasksTagViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainTagViewTable' })

const tasksTagViewStore = useTasksTagViewStore()

const { responsiveFlag, todos, pagination, tags, loading, error, viewProps } =
    storeToRefs(tasksTagViewStore)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <loading-comp v-if="loading" />
            <nue-empty
                v-else-if="error || !viewProps || todos.length === 0"
                image-size="4rem"
                image-src="/images/coffee.webp"
                :description="error"
                style="height: 100%"
            />
            <nue-content v-else fill>
                <todo-table
                    :column-options="viewProps.preference.columns"
                    :sort-options="viewProps.preference.getTodosOptions.sort!"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="tasksTagViewStore.showTodoDetails"
                    @clear-sort-options="tasksTagViewStore.handleClearSortOptions"
                    @update-sort-options="tasksTagViewStore.handleUpdateSortOptions"
                    @delete-todo="(id) => tasksTagViewStore.deleteTodo(id)"
                    @restore-todo="(id) => tasksTagViewStore.restoreTodo(id)"
                />
            </nue-content>
        </nue-main>
        <nue-footer v-if="!error && todos.length !== 0">
            <nue-div v-if="pagination" align="center" justify="space-between">
                <nue-text color="gray" flex size="12px">
                    当前列表 {{ pagination.current || 0 }} 项， 共计
                    {{ pagination.total || 0 }} 项。
                </nue-text>
                <pager
                    :limit="pagination.limit"
                    :page="pagination.page"
                    :total-pages="pagination.maxPage"
                    :simple="responsiveFlag <= 1"
                    @per-page-change="tasksTagViewStore.handleUpdatePerPage"
                    @page-change="tasksTagViewStore.handleUpdatePage"
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
