<script setup lang="ts">
import { TaskList } from '@/components/tasks'
import { LoadingError } from '@nao-todo/components'
import useListViewAdapter from './use-list-view-adapter'
import type { ListViewAdapterProps } from './types'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'ListViewAdapter' })
const props = defineProps<ListViewAdapterProps>()

const {
    tasks,
    taskLoader,
    loading,
    sortOptions,
    error,
    noTaskError,
    dialogManager,
    handleNextPage,
    handleRetry
} = useListViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <loading-error
                    :loading="loading"
                    :error="!!error"
                    error-image-size="8rem"
                    error-image-src="/images/error.png"
                    :empty="!error && !tasks.length && !!noTaskError"
                    :empty-image-src="noTaskError?.image"
                    :empty-image-size="noTaskError?.imageSize"
                >
                    <template #error>
                        <nue-div vertical align="center">
                            <nue-text size="var(--nue-text-sm)">
                                {{ t('task.error.loadFailed') }}
                            </nue-text>
                            <nue-button theme="primary,small" @click="handleRetry">
                                {{ t('common.retry') }}
                            </nue-button>
                        </nue-div>
                    </template>
                    <template #empty>
                        <nue-div vertical align="center">
                            <nue-text size="var(--nue-text-sm)">
                                {{ noTaskError?.message ? t(noTaskError.message as any) : '' }}
                            </nue-text>
                            <nue-button
                                v-if="noTaskError?.isShowTaskCreateButton"
                                theme="primary,small"
                                @click="dialogManager.open(TASK_CREATOR_DIALOG_KEY)"
                            >
                                {{ t('task.createTask') }}
                            </nue-button>
                        </nue-div>
                    </template>
                    <task-list
                        :tags="tags"
                        :tasks="tasks"
                        :loading="taskLoader.states.loading"
                        :error="taskLoader.states.error"
                        :disabled-next-page="taskLoader.states.isDone"
                        :columns="columns"
                        :sort-options="sortOptions"
                        :column-label-getter="getColumnLabel"
                        :project-name-getter="getProjectName"
                        @show-task-details="showTaskDetails"
                        @update-columns="updateColumns"
                        @update-sort-options="updateSortOptions"
                        @clear-sort-options="clearSortOptions"
                        @delete-task="(taskId) => taskUseCase.removeTask(taskId)"
                        @restore-task="(taskId) => taskUseCase.restoreTask(taskId)"
                        @next-page="handleNextPage"
                    />
                </loading-error>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainTableContainer {
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

