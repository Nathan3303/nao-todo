<script lang="ts" setup>
import { inject, onMounted } from 'vue'
import { Loading as LoadingComponent } from '@nao-todo/components'
import { TaskStateInfo } from '@nao-todo/components'
import { NueInfiniteScroll } from 'nue-ui'
import TaskKanbanColumnItem from './kanban-column-item.vue'
import useKanbanColumn from './use-kanban-column'
import { TASK_KANBAN_CONTEXT_KEY } from './use-kanban'
import type { TaskKanbanColumnProps, TaskKanbanContext } from './types'

defineOptions({ name: 'TodoKanbanColumn' })
const props = defineProps<TaskKanbanColumnProps>()

const { states, fetchTasks, loadMore } = useKanbanColumn(props)
const kanbanCtx = inject<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY)

onMounted(() => fetchTasks())
</script>

<template>
    <nue-container
        v-if="kanbanCtx"
        class="kanban-column"
        :class="{ 'kanban-column--disabled': disabled }"
    >
        <nue-header class="kanban-column__header">
            <task-state-info :state="category" />
            <nue-text color="var(--nue-primary-color-600)" size="var(--nue-text-xs)">
                {{ states.tasks.length }}
            </nue-text>
        </nue-header>
        <nue-infinite-scroll @load-more="loadMore" :disabled="states.isDone" trigger-height="2px">
            <nue-main class="kanban-column__main">
                <nue-content fill style="overflow: hidden">
                    <loading-component v-if="states.loading" placeholder="正在加载任务" />
                    <nue-empty
                        v-else-if="states.error"
                        theme="no-image"
                        :description="states.error"
                    />
                    <task-kanban-column-item
                        v-else
                        v-for="task in states.tasks"
                        :key="task.id"
                        :actived="task.id === $route.params.taskId"
                        :columns="columns"
                        :data-taskId="task.id"
                        :task="task"
                        :tags="kanbanCtx.tags.value"
                        draggable="true"
                    />
                    <!--
                        @click="(todoId) => emit('show-todo-details', todoId)"
                        @delete="(todoId) => emit('delete-todo', todoId)"
                        @finish="(todoId) => emit('finish-todo', todoId)"
                        @heart="(todoId) => emit('heart-todo', todoId)"
                        @restore="(todoId) => emit('restore-todo', todoId)"
                        @unfinish="(todoId) => emit('unfinish-todo', todoId)"
                    -->
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
