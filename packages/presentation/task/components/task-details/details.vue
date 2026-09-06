<script lang="ts" setup>
import { LoadingError, assetUrl } from '@nao-todo/shared'
import { computed, watch } from 'vue'
import DetailsFooter from './footer/index.vue'
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
import useTaskDetails from './task-details'
import type { TaskDetailsProps } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()

const { loading, error, task, initialize } = useTaskDetails()

// 详情加载错误分级（FE-DEF1-2）：后端限流（10051/429 家族）给出专属文案 + 重试按钮；
// 其余错误维持原展示（文案与 loading-error 默认一致，保证视觉零变化）。
// 注：与搜索纯层同规则的最小副本 —— 本包无法反向依赖 apps/web 组件层。
const RATE_MARKERS = ['10051', '42900', '请求过于频繁', '请求太频繁', '限流']
const isRateLimitedMessage = (message: string): boolean =>
    RATE_MARKERS.some((marker) => message.includes(marker))
const isRateLimited = computed(() => isRateLimitedMessage(error.value || ''))

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
        <template #error>
            <nue-div v-if="isRateLimited" vertical align="center" gap="10px">
                <nue-text size="var(--nue-text-sm)">请求过于频繁，请稍后重试</nue-text>
                <nue-button theme="primary,small" @click="initialize(taskId)">重试</nue-button>
            </nue-div>
            <nue-text v-else size="var(--nue-text-sm)">加载失败, 请刷新页面重试</nue-text>
        </template>
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