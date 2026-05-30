<script setup lang="ts">
import { TaskTable } from '@/components/tasks'
import { LoadingError, Pager } from '@nao-todo/components'
import useTableViewAdapter from './use-table-view-adapter'
import type { TableViewAdapterProps } from './types'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'TableViewAdapter' })
const props = defineProps<TableViewAdapterProps>()

const {
    tasks,
    taskLoader,
    loading,
    error,
    noTaskError,
    handleUpdatePage,
    handleUpdatePerPage,
    handleRetry,
    dialogManager
} = useTableViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
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
                    <nue-text size="var(--nue-text-sm)">{{ t('task.error.loadFailed') }}</nue-text>
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
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <task-table
                        :tags="tags"
                        :tasks="tasks"
                        :loading="taskLoader.states.loading"
                        :columns="columns"
                        :get-options="getTasksOptions"
                        :column-label-getter="getColumnLabel"
                        :project-name-getter="getProjectName"
                        @show-task-details="showTaskDetails"
                        @update-columns="updateColumns"
                        @update-sort-options="updateSortOptions"
                        @clear-sort-options="clearSortOptions"
                        @delete-task="(taskId) => taskUseCase.removeTask(taskId)"
                        @restore-task="(taskId) => taskUseCase.restoreTask(taskId)"
                    />
                </nue-content>
            </nue-main>
            <nue-footer>
                <nue-div align="center" justify="space-between" width="100%" wrap="wrap">
                    <nue-text flex size="var(--nue-text-sm)">
                        当前列表 {{ tasks.length || 0 }} 项， 共计
                        {{ taskLoader.states.pagination.total || 0 }} 项。
                    </nue-text>
                    <pager
                        :disabled="taskLoader.states.disabled"
                        :limit="taskLoader.states.pagination.limit"
                        :page="taskLoader.states.pagination.page"
                        :total-pages="taskLoader.states.pagination.maxPage"
                        @per-page-change="handleUpdatePerPage"
                        @page-change="handleUpdatePage"
                    />
                </nue-div>
            </nue-footer>
        </loading-error>
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

