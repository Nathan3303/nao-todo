<script setup lang="ts">
import { TaskList } from '@/components/tasks'
import { LoadingError } from '@nao-todo/components'
import useListViewAdapter from './use-list-view-adapter'
import type { ListViewAdapterProps } from './types'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'ListViewAdapter' })
const props = defineProps<ListViewAdapterProps>()

const { tasks, taskLoader, sortOptions, error, dialogManager, handleNextPage } =
    useListViewAdapter(props)
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
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

