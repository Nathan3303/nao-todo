<script lang="ts" setup>
import { Loading as LoadingComponent } from '@/components/ui'
import { Empty, TodoStateInfo } from '@nao-todo/components'
import { NueInfiniteScroll } from 'nue-ui'
import { useColumnLoader } from './use-column-loader'
import KanbanColumnItem from './kanban-column-item.vue'
import type { KanbanColumnEmits, KanbanColumnProps } from './types'

defineOptions({ name: 'TodoKanbanColumn' })
const props = defineProps<KanbanColumnProps>()
const emit = defineEmits<KanbanColumnEmits>()

const { loading, isAllLoaded, isTheFirstLoading, todos, tags, loadMore, handleShowTodoDetails } =
    useColumnLoader(props)
</script>

<template>
    <nue-container class="kanban-column">
        <nue-header class="kanban-column__header">
            <todo-state-info :state="(category as never)" />
            <nue-text color="var(--nue-primary-color-600)" size="var(--nue-text-xs)">
                {{ todos.length }}
            </nue-text>
        </nue-header>
        <nue-infinite-scroll
            @load-more="loadMore"
            :disabled="loading || isAllLoaded || isTheFirstLoading"
            trigger-height="2px"
        >
            <nue-main class="kanban-column__main" style="border: none">
                <nue-content fill>
                    <kanban-column-item
                        v-for="todo in todos"
                        :key="todo.id"
                        :actived="todo.id === $route.params.todoId"
                        :columns="columnOptions"
                        :data-todoId="todo.id"
                        :todo="todo"
                        :tags="tags"
                        draggable="true"
                        @click="handleShowTodoDetails"
                        @delete="(todoId) => emit('delete-todo', todoId)"
                        @finish="(todoId) => emit('finish-todo', todoId)"
                        @heart="(todoId) => emit('heart-todo', todoId)"
                        @restore="(todoId) => emit('restore-todo', todoId)"
                        @unfinish="(todoId) => emit('unfinish-todo', todoId)"
                    />
                    <nue-div v-if="loading || !todos.length" vertical>
                        <loading-component v-if="loading" placeholder="正在加载任务" />
                        <empty v-else :empty="!todos.length" message="当前没有待办任务" />
                    </nue-div>
                </nue-content>
            </nue-main>
        </nue-infinite-scroll>
    </nue-container>
</template>
