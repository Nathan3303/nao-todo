<script setup lang="ts">
import { useTasksBasicViewStore } from '@/stores/tasks'
import { TodoTable } from '@/components/tasks/table'
import { Loading as LoadingComp, Pager } from '@nao-todo/components'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainBasicViewTable' })

const tasksBasicViewStore = useTasksBasicViewStore()

const { responsiveFlag, todos, pagination, tags, loading, error, page, viewProps } =
    storeToRefs(tasksBasicViewStore)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <loading-comp v-if="loading" />
            <nue-empty
                v-else-if="error || !viewProps || todos.length === 0"
                image-size="4rem"
                image-src="/images/coffee.webp"
                :description="error || '当前暂无待办，放松一下吧!'"
                style="height: 100%"
            />
            <nue-content v-else fill>
                <todo-table
                    :column-options="viewProps.preference.columns"
                    :sort-options="viewProps.preference.getTodosOptions.sort"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="tasksBasicViewStore.showTodoDetails"
                    @clear-sort-options="tasksBasicViewStore.handleClearSortOptions"
                    @update-sort-options="tasksBasicViewStore.handleUpdateSortOptions"
                    @delete-todo="tasksBasicViewStore.deleteTodo"
                    @restore-todo="tasksBasicViewStore.restoreTodo"
                />
            </nue-content>
        </nue-main>
        <nue-footer v-if="!error && todos.length !== 0">
            <nue-div v-if="pagination" align="center" justify="space-between">
                <nue-text color="gray" flex size="12px">
                    当前列表 {{ pagination.limit || 0 }} 项， 共计 {{ pagination.total || 0 }} 项。
                </nue-text>
                <pager
                    :limit="pagination.limit"
                    :page="page"
                    :total-pages="pagination.maxPage"
                    :simple="responsiveFlag <= 1"
                    @per-page-change="tasksBasicViewStore.handleUpdatePerPage"
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
