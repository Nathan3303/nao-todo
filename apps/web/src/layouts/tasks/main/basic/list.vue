<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksBasicViewStore } from '@/stores/tasks'
import { TodoList } from '@/components/tasks/list'

defineOptions({ name: 'TasksMainBasicViewList' })

const tasksBasicViewStore = useTasksBasicViewStore()

const { todos, tags, viewProps } = storeToRefs(tasksBasicViewStore)
</script>

<template>
    <nue-container id="TasksMainListContainer">
        <nue-main>
            <nue-empty
                v-if="!viewProps"
                image-size="4rem"
                image-src="/images/coffee.webp"
                description="视图属性无效"
                style="height: 100%"
            />
            <nue-content v-if="viewProps" fill style="overflow: hidden">
                <todo-list
                    :columns="viewProps.preference.columns"
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
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainListContainer {
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
