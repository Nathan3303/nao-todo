<script setup lang="ts">
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import { TASK_CREATOR_DIALOG_KEY } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import { assetUrl } from '@nao-todo/shared/utils/asset-url'
import { TaskKanban } from '../../kanban'
import type { KanbanViewAdapterProps } from './types'
import useKanbanViewAdapter from './use-kanban-view-adapter'
import { notifyTaskError } from '../../../utils/error-message'

defineOptions({ name: 'KanbanViewAdapter' })
const props = defineProps<KanbanViewAdapterProps>()

const { tasks, loading, sortOptions, error, noTaskError, handleRetry } = useKanbanViewAdapter(props)

// 看板内联写操作：断网时仓储返回错误码（不 reject）⇒ 必须显式提示，避免静默丢失
const handleDeleteTask = async (taskId: string) => {
    const err = await props.taskUseCase.delete(taskId)
    if (err !== null) notifyTaskError('task.deleteFailed', err)
}

const handleRestoreTask = async (taskId: string) => {
    const err = await props.taskUseCase.restore(taskId)
    if (err !== null) notifyTaskError('task.restoreFailed', err)
}

const handleFinishTask = async (taskId: string) => {
    const err = await props.taskUseCase.update(taskId, { state: 'done' })
    if (err !== null) notifyTaskError('task.updateFailed', err)
}

const handleUnfinishTask = async (taskId: string) => {
    const err = await props.taskUseCase.update(taskId, { state: 'todo' })
    if (err !== null) notifyTaskError('task.updateFailed', err)
}
</script>

<template>
    <nue-container id="TasksMainKanbanContainer">
        <nue-main>
            <nue-content fill style="overflow: auto">
                <loading-error
                    :loading="loading"
                    :error="!!error"
                    error-image-size="6rem"
                    :error-image-src="assetUrl('/images/error.webp')"
                    :empty="!error && !tasks.length && !!noTaskError"
                    :empty-image-src="noTaskError?.image || assetUrl('/images/notaskhere.webp')"
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
                        @delete-task="handleDeleteTask"
                        @restore-task="handleRestoreTask"
                        @finish-task="handleFinishTask"
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