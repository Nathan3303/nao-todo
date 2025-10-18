<script lang="ts" setup>
import { watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import TodoKanbanColumn from './kanban-column.vue'
import useKanbanStore from './use-kanban-store'
import { useKanbanDragger } from './use-kanban-dragger'
import { Loading as LoadingComponent } from '@/components/ui'
import type { TodoKanbanProps } from './types'
import './kanban.css'

defineOptions({ name: 'TodoKanban' })
defineProps<TodoKanbanProps>()

const kanbanStore = useKanbanStore()

const { handleDragStart, handleDragOver, handleDragEnter, handleDragEnd, handleDrop } =
    useKanbanDragger()

const { loading, kanbanColumns, todos } = storeToRefs(kanbanStore)

watchEffect(() => kanbanStore.getKanbanColumns())
</script>

<template>
    <nue-container id="TodoKanbanContainer">
        <nue-main style="border: none">
            <loading-component v-if="loading" placeholder="正在加载任务看板..." />
            <nue-empty
                v-else-if="kanbanColumns.length === 0"
                image-src="/images/coffee.webp"
                image-size="4rem"
                description="目前看板无分组"
            />
            <nue-content fill v-else>
                <todo-kanban-column
                    v-for="groupName in kanbanColumns"
                    :key="groupName"
                    :todos="todos"
                    :category="groupName"
                    :column-options="columnOptions"
                    :data-category="groupName"
                    data-droppable="true"
                    @dragend="handleDragEnd"
                    @dragenter="handleDragEnter"
                    @dragover="handleDragOver"
                    @dragstart="handleDragStart"
                    @drop="handleDrop"
                />
                <!-- 
                    @show-todo-details="showTodoDetails"
                    @delete-todo="todoStore.deleteTodoWithConfirm"
                    @restore-todo="todoStore.restoreTodoWithConfirm"
                    @finish-todo="handleFinishTodo"
                    @unfinish-todo="handleUnfinishTodo"
                -->
            </nue-content>
        </nue-main>
    </nue-container>
</template>
