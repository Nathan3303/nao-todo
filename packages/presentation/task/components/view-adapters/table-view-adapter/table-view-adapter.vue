<script setup lang="ts">
import { LoadingError, Pager, TASK_CREATOR_DIALOG_KEY, t } from '@nao-todo/shared'
import { TaskTable } from '../../table'
import type { TableViewAdapterEmits, TableViewAdapterProps } from './types'
import useTableViewAdapter from './use-table-view-adapter'

defineOptions({ name: 'TableViewAdapter' })
const props = defineProps<TableViewAdapterProps>()
const emit = defineEmits<TableViewAdapterEmits>()

const {
    tasks,
    taskLoader,
    adapterLoading,
    loading,
    error,
    noTaskError,
    handleUpdatePage,
    handleUpdatePerPage,
    handleRetry
} = useTableViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <loading-error
            :loading="adapterLoading"
            :error="!!error"
            error-image-size="6rem"
            error-image-src="/images/error.webp"
            :empty="!error && !tasks.length && !!noTaskError"
            :empty-image-src="noTaskError?.image || '/images/notaskhere.webp'"
            :empty-image-size="noTaskError?.imageSize || '6rem'"
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
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <task-table
                        :tags="tags"
                        :tasks="tasks"
                        :loading="loading"
                        :columns="columns"
                        :get-options="getTasksOptions"
                        :column-label-getter="getColumnLabel"
                        :project-name-getter="getProjectName"
                        :layout-config="layoutConfig"
                        :multi-select-clear-signal="multiSelectClearSignal"
                        @show-task-details="showTaskDetails"
                        @show-multi-select-panel="(payload) => emit('multiSelectChanged', payload)"
                        @update-columns="updateColumns"
                        @update-sort-options="updateSortOptions"
                        @clear-sort-options="clearSortOptions"
                        @delete-task="(taskId) => taskUseCase.delete(taskId)"
                        @restore-task="(taskId) => taskUseCase.restore(taskId)"
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