<script lang="ts" setup>
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
import DetailsFooter from './footer/index.vue'
import useTaskDetails from './task-details'
import { LoadingError } from '@nao-todo/components'
import type { TaskDetailsProps, TaskDetailsEmits } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()
const emit = defineEmits<TaskDetailsEmits>()

const { error, task } = useTaskDetails(props, emit)
</script>

<template>
    <loading-error
        :loading="false"
        :empty="!task"
        :error="!!error"
        empty-image-src="/images/todo.webp"
        empty-image-size="4rem"
        error-image-src="/images/error.webp"
        error-image-size="4rem"
    >
        <!-- 错误状态 -->
        <template #error>
            <nue-text>加载失败, 请刷新页面重试</nue-text>
        </template>
        <template #empty>
            <nue-text>选择任务以查看任务详细</nue-text>
        </template>
        <!-- 正常状态 -->
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

    > .nue-header,
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

