<script setup lang="ts">
import { TodoTable } from '@/components/tasks/table'
import { useTasksTagViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainTagViewTable' })

const tasksTagViewStore = useTasksTagViewStore()

const { todos, tags, viewProps } = storeToRefs(tasksTagViewStore)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <nue-empty
                v-if="!viewProps"
                image-size="4rem"
                image-src="/images/coffee.webp"
                description="视图属性无效"
                style="height: 100%"
            />
            <nue-content v-if="viewProps" fill style="overflow: hidden">
                <todo-table
                    :extra-get-options="{ tagId: viewProps.id }"
                    :column-options="viewProps.preference.columns"
                    :sort-options="viewProps.preference.getTodosOptions.sort!"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="tasksTagViewStore.showTodoDetails"
                    @clear-sort-options="tasksTagViewStore.handleClearSortOptions"
                    @update-sort-options="tasksTagViewStore.handleUpdateSortOptions"
                    @delete-todo="tasksTagViewStore.deleteTodo"
                    @restore-todo="tasksTagViewStore.restoreTodo"
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
