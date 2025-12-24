<script setup lang="ts">
// import { useTasksProjectViewStore } from '@/stores/tasks'
// import { TodoList } from '@/components/tasks/list'
// import { storeToRefs } from 'pinia'

// defineOptions({ name: 'TasksMainProjectViewList' })

// const tasksProjectViewStore = useTasksProjectViewStore()

// const { todos, tags, viewProps } = storeToRefs(tasksProjectViewStore)
</script>

<template>
    <!-- <nue-container id="TasksMainListContainer">
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
                    :extra-get-options="{ projectId: viewProps.id }"
                    :columns="viewProps.preference.columns"
                    :sort-options="viewProps.preference.getTodosOptions.sort"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="tasksProjectViewStore.showTodoDetails"
                    @clear-sort-options="tasksProjectViewStore.handleClearSortOptions"
                    @update-sort-options="tasksProjectViewStore.handleUpdateSortOptions"
                    @delete-todo="tasksProjectViewStore.deleteTodo"
                    @restore-todo="tasksProjectViewStore.restoreTodo"
                />
            </nue-content>
        </nue-main>
    </nue-container> -->
    ListView
</template>

<style scoped>
/* .nue-container#TasksMainListContainer {
    gap: 0.5rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
} */
</style>
