<script setup lang="ts">
import { useTasksBasicViewStore } from '@/stores/tasks'
import { TodoTable } from '@/components/tasks/table'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'

defineOptions({ name: 'TasksMainBasicViewTable' })

const tasksBasicViewStore = useTasksBasicViewStore()

const { todos, tags, viewProps } = storeToRefs(tasksBasicViewStore)

const todoTableRef = ref<InstanceType<typeof TodoTable>>()
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
                    ref="todoTableRef"
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

