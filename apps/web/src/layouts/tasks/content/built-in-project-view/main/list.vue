<script setup lang="ts">
import { TaskList } from '@/components/tasks'
import { type TasksProjectViewContentContext } from './use-content'
import { inject } from 'vue'
import { TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY } from '../constants'

defineOptions({ name: 'TasksMainProjectViewList' })

const contextCtx = inject<TasksProjectViewContentContext>(TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY)
</script>

<template>
    <nue-container id="TasksMainListContainer">
        <nue-main>
            <nue-empty
                v-if="!contextCtx"
                image-size="4rem"
                image-src="/images/coffee.webp"
                description="视图属性无效"
                style="height: 100%"
            />
            <nue-content v-else fill style="overflow: hidden">
                <task-list
                    v-if="contextCtx.sortOptions.value"
                    :tags="contextCtx.tags.value"
                    :tasks="contextCtx.tasks.value"
                    :columns="contextCtx.columns.value!"
                    :sort-options="contextCtx.sortOptions.value"
                    :column-label-getter="contextCtx.getColumnLabel"
                    :project-name-getter="contextCtx.getProjectName"
                    :task-lister="contextCtx.taskLister"
                    @show-task-details="contextCtx.showTaskDetails"
                    @clear-sort-options="contextCtx.clearSortOptions"
                    @update-columns="contextCtx.updateColumns"
                    @update-sort-options="contextCtx.updateSortOptions"
                    @delete-task="contextCtx.deleteTask"
                    @restore-task="contextCtx.restoreTask"
                />
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
}
</style>
