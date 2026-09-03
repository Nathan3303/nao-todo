<script lang="ts" setup>
import { LoadingError, assetUrl } from '@nao-todo/shared'
import { watch } from 'vue'
import DetailsFooter from './footer/index.vue'
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
import useTaskDetails from './task-details'
import type { TaskDetailsProps } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()

const { loading, error, task, initialize } = useTaskDetails()

// @watch 监听任务 ID
watch(
    () => props.taskId,
    (newId) => initialize(newId),
    { immediate: true }
)
</script>

<template>
    <loading-error
        :loading="loading"
        :empty="!task"
        empty-message="选择待办任务以查看任务详情"
        :empty-image-src="assetUrl('/images/todo.webp')"
        :error="!!error"
        error-message="加载失败, 请刷新页面重试"
        :error-image-src="assetUrl('/images/error.webp')"
    >
        <nue-container id="TasksTodoDetailsContainer" class="tasks-details-view">
            <details-header @reload="initialize(taskId)" />
            <nue-main>
                <nue-content fill>
                    <details-main />
                </nue-content>
            </nue-main>
            <details-footer />
        </nue-container>
    </loading-error>
</template>

<style scoped>
.nue-container#TasksTodoDetailsContainer {
    gap: 0;

    > .nue-main {
        padding: 0;
        border: none;
        height: auto;
    }

    > .nue-footer {
        padding: 1rem;
        height: auto;
        border-top: 1px solid var(--nue-border-color);
    }
}
</style>