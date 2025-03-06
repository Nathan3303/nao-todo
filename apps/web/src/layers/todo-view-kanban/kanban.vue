<template>
    <nue-container id="tasks/basic/kanban" class="content-kanban" theme="vertical,inner">
        <nue-main style="border: none">
            <Loading v-if="loading" placeholder="正在加载任务看板..." />
            <template v-else>
                <content-kanban-column
                    v-for="(value, key) in kanbanTodos"
                    :key="key"
                    :category="key"
                    :todos="value"
                    :columnOptions="todoStore.columnOptions"
                    :data-category="key"
                    data-droppable="true"
                    @show-todo-details="showTodoDetails"
                    @delete-todo="todoStore.deleteTodoWithConfirmation"
                    @restore-todo="todoStore.restoreTodoWithConfirmation"
                    @finish-todo="handleFinishTodo"
                    @unfinish-todo="handleUnfinishTodo"
                    @dragend="handleDragEnd"
                    @dragenter="handleDragEnter"
                    @dragover="handleDragOver"
                    @dragstart="handleDragStart"
                    @drop="handleDrop"
                />
            </template>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { Loading } from '@nao-todo/components'
import { ContentKanbanColumn } from './kanban-column'
import { useTodoStore } from '@/stores'
import { useKanban } from './use-kanban'
import { useKanbanDragger } from './use-kanban-dragger'
import type { KanbanProps } from './types'

const props = defineProps<KanbanProps>()

const todoStore = useTodoStore()
const { kanbanTodos, loading, showTodoDetails, handleFinishTodo, handleUnfinishTodo } =
    useKanban(props)
const { handleDragStart, handleDragOver, handleDragEnter, handleDragEnd, handleDrop } =
    useKanbanDragger()
</script>

<style scoped>
.content-kanban {
    width: 100%;

    & > .nue-header {
        border-bottom: none;
        padding-top: 0;
    }

    & > .nue-main {
        overflow: hidden;
        gap: 16px;

        &:deep(> .nue-main__content) {
            flex-direction: row;
            padding: 0 16px;
            gap: 16px;
            overflow: hidden;
            overflow-x: auto;
        }
    }
}
</style>
