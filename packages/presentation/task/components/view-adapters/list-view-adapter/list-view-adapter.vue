<script setup lang="ts">
import { TaskList } from '../../list'
import { LoadingError, TASK_CREATOR_DIALOG_KEY, t } from '@nao-todo/shared'
import useListViewAdapter from './use-list-view-adapter'
import type { ListViewAdapterProps } from './types'

defineOptions({ name: 'ListViewAdapter' })
const props = defineProps<ListViewAdapterProps>()

const {
    tasks,
    taskLoader,
    viewLoading,
    sortOptions,
    error,
    noTaskError,
    handleNextPage,
    handleRetry
} = useListViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainListContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <loading-error
                    :loading="viewLoading"
                    :error="!!error"
                    error-image-size="6rem"
                    error-image-src="/images/error.webp"
                    :empty="!error && !tasks.length && !!noTaskError"
                    :empty-image-src="noTaskError?.image || '/images/notaskhere.webp'"
                    :empty-image-size="noTaskError?.imageSize || '6rem'"
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
                                {{ noTaskError?.message ? t(noTaskError?.message as never) : '' }}
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
                    <task-list
                        :tags="tags"
                        :tasks="tasks"
                        :loading="taskLoader.states.loading"
                        :error="taskLoader.states.error"
                        :disabled-next-page="taskLoader.states.isDone"
                        :columns="columns"
                        :sort-options="sortOptions"
                        :project-name-getter="getProjectName"
                        :small="small"
                        @show-task-details="showTaskDetails"
                        @task-clicked="taskClicked"
                        @delete-task="(taskId) => taskUseCase.delete(taskId)"
                        @restore-task="(taskId) => taskUseCase.restore(taskId)"
                        @next-page="handleNextPage"
                    >
                        <template #actions="{ task }">
                            <slot name="actions" :task="task" />
                        </template>
                    </task-list>
                </loading-error>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainListContainer {
    gap: 0.5rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }

    > .nue-main {
        overflow: auto;
    }
}
</style>