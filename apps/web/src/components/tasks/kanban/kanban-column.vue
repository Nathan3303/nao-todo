<script lang="ts" setup>
import { Loading as LoadingComponent } from '@/components/ui'
import { TodoStateInfo } from '@nao-todo/components'
import { NueInfiniteScroll } from 'nue-ui'
import { useColumnLoader } from './use-column-loader'
import KanbanColumnItem from './kanban-column-item.vue'
import type { TodoKanbanColumnEmits, TodoKanbanColumnProps } from './types'
import { onMounted } from 'vue'

defineOptions({ name: 'TodoKanbanColumn' })
const props = defineProps<TodoKanbanColumnProps>()
const emit = defineEmits<TodoKanbanColumnEmits>()

// @hook useColumnLoader
const { loading, loadCompleted, disabled, todos, tags, error, errorMessage, loadMore } =
    useColumnLoader(props, emit)

// @mounted 加载第一页数据
onMounted(() => {
    // 优先使用 requestIdleCallback 加载数据，避免阻塞主线程
    if (window.requestIdleCallback) {
        window.requestIdleCallback(() => loadMore(true))
        return
    }
    // 没有 requestIdleCallback 时，直接加载第一页数据
    loadMore(true)
})
</script>

<template>
    <nue-container class="kanban-column" :class="{ 'kanban-column--disabled': disabled }">
        <nue-header class="kanban-column__header">
            <todo-state-info :state="category" />
            <nue-text color="var(--nue-primary-color-600)" size="var(--nue-text-xs)">
                {{ todos.length }}
            </nue-text>
        </nue-header>
        <nue-infinite-scroll @load-more="loadMore" :disabled="loadCompleted" trigger-height="2px">
            <nue-main class="kanban-column__main">
                <nue-content fill style="overflow: hidden">
                    <loading-component v-if="loading" placeholder="正在加载任务" />
                    <nue-empty v-else-if="error" theme="no-image" :description="errorMessage" />
                    <kanban-column-item
                        v-else
                        v-for="todo in todos"
                        :key="todo.id"
                        :actived="todo.id === $route.params.todoId"
                        :columns="columnOptions"
                        :data-todoId="todo.id"
                        :todo="todo"
                        :tags="tags"
                        draggable="true"
                        @click="(todoId) => emit('show-todo-details', todoId)"
                        @delete="(todoId) => emit('delete-todo', todoId)"
                        @finish="(todoId) => emit('finish-todo', todoId)"
                        @heart="(todoId) => emit('heart-todo', todoId)"
                        @restore="(todoId) => emit('restore-todo', todoId)"
                        @unfinish="(todoId) => emit('unfinish-todo', todoId)"
                    />
                </nue-content>
            </nue-main>
        </nue-infinite-scroll>
    </nue-container>
</template>

<style scoped>
.nue-infinite-scroll-wrapper:deep(.nue-infinite-scroll__disable-bar),
.nue-infinite-scroll-wrapper:deep(.nue-infinite-scroll__loading-bar) {
    display: none;
}
</style>
