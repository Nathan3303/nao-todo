<script setup lang="ts">
import { LoadingError, TASK_CREATOR_DIALOG_KEY, t } from '@nao-todo/shared'
import { TaskKanban } from '../../kanban'
import type { KanbanViewAdapterProps } from './types'
import useKanbanViewAdapter from './use-kanban-view-adapter'

defineOptions({ name: 'KanbanViewAdapter' })
const props = defineProps<KanbanViewAdapterProps>()

const { tasks, loading, sortOptions, error, noTaskError, handleRetry } = useKanbanViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainKanbanContainer">
        <nue-main>
            <nue-content fill style="overflow: auto">
                <loading-error
                    :loading="loading"
                    :error="!!error"
                    error-image-size="6rem"
                    error-image-src="/images/error.webp"
                    :empty="!error && !tasks.length && !!noTaskError"
                    :empty-image-src="noTaskError?.image || '/images/notaskhere.webp'"
                    :empty-image-size="noTaskError?.imageSize || '6rem'"
                >
                    <template #error>
                        <nue-div vertical align="center">
                            <nue-text size="var(--nue-text-sm)">{{
                                t('task.error.loadFailed')
                            }}</nue-text>
                            <nue-button theme="primary,small" @click="handleRetry">
                                {{ t('common.retry') }}
                            </nue-button>
                        </nue-div>
                    </template>
                    <template #empty>
                        <nue-div vertical align="center">
                            <nue-text size="var(--nue-text-sm)">
                                {{ noTaskError?.message ? t(noTaskError.message as never) : '' }}
                            </nue-text>
                            <slot name="emptyActions">
                                <nue-button
                                    v-if="noTaskError?.isShowTaskCreateButton"
                                    theme="primary,small"
                                    @click="dialogManager.open(TASK_CREATOR_DIALOG_KEY)"
                                >
                                    {{ t('task.createTask') }}
                                </nue-button>
                            </slot>
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
                        @show-task-details="showTaskDetails"
                        @delete-task="(taskId) => taskUseCase.delete(taskId)"
                        @restore-task="(taskId) => taskUseCase.delete(taskId)"
                        @finish-task="(taskId) => taskUseCase.update(taskId, { state: 'done' })"
                        @unfinish-task="(taskId) => taskUseCase.update(taskId, { state: 'todo' })"
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