<script setup lang="ts">
// import { storeToRefs } from 'pinia'
// import { useTasksViewStore, useTasksProjectViewStore } from '@/stores/tasks'
// import { TodoKanban } from '@/components/tasks'
// import { Loading as LoadingComponent } from '@nao-todo/components'

// defineOptions({ name: 'TasksMainProjectViewKanban' })

// const tasksViewStore = useTasksViewStore()
// const tasksProjectViewStore = useTasksProjectViewStore()

// const { viewProps } = storeToRefs(tasksViewStore)
// const { todos, tags, loading, error } = storeToRefs(tasksProjectViewStore)
</script>

<template>
    <!-- <nue-container id="TasksMainKanbanContainer">
        <nue-main>
            <loading-component v-if="loading" />
            <nue-empty
                v-else-if="error || !viewProps"
                image-size="4rem"
                image-src="/images/coffee.webp"
                :description="error || '当前暂无待办，放松一下吧!'"
                style="height: 100%"
            />
            <nue-content v-else fill style="overflow: auto">
                <todo-kanban
                    :column-options="viewProps.preference.columns"
                    :sort-options="viewProps.preference.getTodosOptions.sort"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="tasksProjectViewStore.showTodoDetails"
                    @delete-todo="tasksProjectViewStore.deleteTodo"
                    @restore-todo="tasksProjectViewStore.restoreTodo"
                    @finish-todo="tasksProjectViewStore.finishTodo"
                    @unfinish-todo="tasksProjectViewStore.unfinishTodo"
                />
            </nue-content>
        </nue-main>
    </nue-container> -->
    KanbanView
</template>

<style scoped>
/* .nue-container#TasksMainKanbanContainer {
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
