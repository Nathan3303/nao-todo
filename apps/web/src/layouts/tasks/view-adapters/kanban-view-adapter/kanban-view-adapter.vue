<script setup lang="ts">
import { TaskKanban } from '@/components/tasks'
import { Loading as LoadingComponent } from '@nao-todo/components'
import useKanbanViewAdapter from './use-kanban-view-adapter'
import type { KanbanViewAdapterProps } from './types'

defineOptions({ name: 'KanbanViewAdapter' })
const props = defineProps<KanbanViewAdapterProps>()

const { tasks, loading, error } = useKanbanViewAdapter(props)

const handleFinishTask = (taskId: string) => {
    props.taskUseCase.updateTask(taskId, { state: 'done' })
}

const handleUnfinishTask = (taskId: string) => {
    props.taskUseCase.updateTask(taskId, { state: 'todo' })
}
</script>

<template>
    <nue-container id="TasksMainKanbanContainer">
        <nue-main>
            <nue-content fill style="overflow: auto">
                <loading-component v-if="loading" placeholder="正在加载任务" style="height: auto" />
                <nue-empty
                    v-else-if="error"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    :description="error"
                    style="height: 100%"
                />
                <task-kanban
                    v-else
                    :column-label-getter="getColumnLabel"
                    :columns="columns"
                    :project-name-getter="getProjectName"
                    :sort-options="getTasksOptions.sort || { field: 'createdAt', order: 'desc' }"
                    :tags="tags"
                    :tasks="tasks"
                    :task-use-case="taskUseCase"
                    @clear-sort-options="clearSortOptions"
                    @delete-task="(taskId) => taskUseCase.removeTask(taskId)"
                    @finish-task="handleFinishTask"
                    @restore-task="(taskId) => taskUseCase.restoreTask(taskId)"
                    @show-task-details="showTaskDetails"
                    @unfinish-task="handleUnfinishTask"
                    @update-columns="updateColumns"
                    @update-sort-options="updateSortOptions"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainKanbanContainer {
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

