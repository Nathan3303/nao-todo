<script lang="ts" setup>
import { Loading as LoadingComponent, TaskStateInfo } from '@nao-todo/shared'
import { NueInfiniteScroll } from 'nue-ui'
import { inject, onMounted } from 'vue'
import TaskKanbanColumnItem from './kanban-column-item.vue'
import type { TaskKanbanColumnProps, TaskKanbanContext } from './types'
import { TASK_KANBAN_CONTEXT_KEY } from './use-kanban'
import useKanbanColumn from './use-kanban-column'

defineOptions({ name: 'TodoKanbanColumn' })
const props = defineProps<TaskKanbanColumnProps>()

const { states, columnTasks, fetchTasks, loadMore } = useKanbanColumn(props)
const { refreshKey, tags, updatingTaskIds } = inject<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY)!

onMounted(() => fetchTasks())
</script>

<template>
    <nue-container class="kanban-column" :class="{ 'kanban-column--disabled': disabled }">
        <nue-header class="kanban-column__header">
            <task-state-info :state="category" />
            <nue-text color="var(--nue-primary-color-600)" size="var(--nue-text-xs)">
                {{ columnTasks.length }}
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
                    <nue-empty
                        v-else-if="columnTasks.length === 0"
                        theme="no-image"
                        description="无待办任务"
                    />
                    <task-kanban-column-item
                        v-else
                        v-for="task in columnTasks"
                        :key="`${task.id}.${refreshKey}`"
                        :actived="task.id === $route.params.taskId"
                        :columns="columns"
                        :data-taskId="task.id"
                        :data-todoId="task.id"
                        :task="task"
                        :tags="tags"
                        :is-updating="updatingTaskIds.has(task.id)"
                        :draggable="!updatingTaskIds.has(task.id)"
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