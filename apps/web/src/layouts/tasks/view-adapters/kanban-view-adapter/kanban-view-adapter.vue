<script setup lang="ts">
import { TaskKanban } from '@/components/tasks'
import { LoadingError } from '@nao-todo/components'
import useKanbanViewAdapter from './use-kanban-view-adapter'
import type { KanbanViewAdapterProps } from './types'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'KanbanViewAdapter' })
const props = defineProps<KanbanViewAdapterProps>()

const { tasks, sortOptions, error, handleFinishTask, handleUnfinishTask, dialogManager } =
    useKanbanViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainKanbanContainer">
        <nue-main>
            <nue-content fill style="overflow: auto">
                <loading-error
                    :error="!!error || !tasks.length"
                    error-image-size="8rem"
                    error-image-src="/images/notaskhere.webp"
                >
                    <template #error>
                        <nue-div vertical align="center">
                            <nue-text size="var(--nue-text-sm)">当前视图暂无待办任务</nue-text>
                            <nue-button
                                theme="primary,small"
                                @click="dialogManager.open(TASK_CREATOR_DIALOG_KEY)"
                            >
                                添加任务
                            </nue-button>
                        </nue-div>
                    </template>
                    <task-kanban
                        :column-label-getter="getColumnLabel"
                        :columns="columns"
                        :project-name-getter="getProjectName"
                        :sort-options="sortOptions"
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
                </loading-error>
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

