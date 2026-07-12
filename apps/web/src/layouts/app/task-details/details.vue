<script lang="ts" setup>
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
import DetailsFooter from './footer/index.vue'
import useTaskDetails from './task-details'
import { LoadingError } from '@nao-todo/components'
import type { TaskDetailsProps } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()

const { loading, error, task } = useTaskDetails(props)
</script>

<template>
    <loading-error
        :loading="loading"
        :empty="!task"
        empty-message="选择待办任务以查看任务详情"
        empty-image-src="/images/todo.webp"
        :error="!!error"
        error-message="加载失败, 请刷新页面重试"
        error-image-src="/images/error.webp"
    >
        <nue-container id="TasksTodoDetailsContainer" class="tasks-details-view">
            <details-header />
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

