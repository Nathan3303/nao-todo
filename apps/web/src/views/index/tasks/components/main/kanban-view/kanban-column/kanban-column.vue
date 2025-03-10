<template>
    <nue-container class="kanban-column" theme="vertical,inner">
        <nue-header class="kanban-column__header" height="32px" style="box-sizing: border-box">
            <todo-state-info :state="category" />
            <nue-text color="gray" size="var(--text-xs)">
                {{ todos.length }}
            </nue-text>
        </nue-header>
        <nue-infinite-scroll
            @load-more="loadMore"
            :disabled="isLoading || isAllLoaded || isTheFirstLoading"
            trigger-height="2px"
        >
            <nue-main class="kanban-column__main" style="border: none">
                <todo-card
                    v-for="todo in todos"
                    :key="todo.id"
                    :actived="todo.id === $route.params.taskId"
                    :columns="columnOptions"
                    :data-todoId="todo.id"
                    :todo="todo"
                    draggable="true"
                    @click="handleShowTodoDetails"
                    @delete="(todoId) => emit('delete-todo', todoId)"
                    @finish="(todoId) => emit('finish-todo', todoId)"
                    @heart="(todoId) => emit('heart-todo', todoId)"
                    @restore="(todoId) => emit('restore-todo', todoId)"
                    @unfinish="(todoId) => emit('unfinish-todo', todoId)"
                />
                <nue-div
                    v-if="isLoading || !todos.length"
                    vertical
                    gap="0"
                    style="min-height: 34px"
                >
                    <Loading v-if="isLoading" placeholder="正在加载任务" />
                    <template v-else>
                        <empty :empty="!todos.length" message="当前没有待办任务" />
                    </template>
                </nue-div>
            </nue-main>
        </nue-infinite-scroll>
    </nue-container>
    <!-- <empty :empty="!!todos.length && isAllLoaded" message="待办任务加载完毕" /> -->
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { TodoCard } from '@/layers'
import { Empty, Loading, TodoStateInfo } from '@nao-todo/components'
import { NueInfiniteScroll } from 'nue-ui'
import { useColumnLoader } from './use-column-loader'
import type { KanbanColumnEmits, KanbanColumnProps } from './types'
import type { Todo } from '@nao-todo/types'
import './kanban-column.css'

const props = defineProps<KanbanColumnProps>()
const emit = defineEmits<KanbanColumnEmits>()

const { isLoading, isAllLoaded, isTheFirstLoading, loadMore } = useColumnLoader(props.category)

const handleShowTodoDetails = (todoId: Todo['id']) => {
    emit('show-todo-details', todoId)
}

onMounted(() => loadMore())
</script>
