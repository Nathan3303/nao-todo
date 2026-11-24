<script lang="ts" setup>
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import { assetUrl } from '@nao-todo/shared/utils/asset-url'
import { t } from '@nao-todo/shared/locales'
import { computed, watch } from 'vue'
import DetailsFooter from './footer/index.vue'
import DetailsHeader from './header/index.vue'
import DetailsMain from './main/index.vue'
import useTaskDetails from './task-details'
import type { TaskDetailsProps } from './types'

defineOptions({ name: 'TaskDetails' })
const props = defineProps<TaskDetailsProps>()

// 只读态（`T795` / Issue #398）：已归档 ⇒ 只能查看（判据 = `readOnly`，单一来源）
const { loading, error, task, readOnly, initialize } = useTaskDetails()

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
        <nue-container
            id="TasksTodoDetailsContainer"
            class="tasks-details-view"
            :data-archived="readOnly ? 'true' : 'false'"
        >
            <details-header @reload="initialize(taskId)" />
            <!-- 只读提示（已归档）：说人话 + 图标/文字三重冗余之一（另两重 = 灰阶 + `data-archived`） -->
            <nue-div v-if="readOnly" class="tasks-details-view__readonly-hint" data-archived-hint>
                <nue-icon name="archive" aria-hidden="true" />
                <span>{{ t('task.details.archivedReadOnly') }}</span>
            </nue-div>
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
}

/*
 * 已归档（`T795`）：整块**灰阶**（去强调色）—— 第三重冗余 = `data-archived` 钩子（前两重 = 灰阶 + 图标/文字标记）。
 * 主体文本 token（`--nue-primary-color-900` / `--nue-primary-text-color`）本身即中性灰 ⇒ 去色不改变其对比
 * （≥4.5:1 不变）；被抹掉的是优先级色 / 过期红 / 标签色等强调色。
 */
.nue-container#TasksTodoDetailsContainer[data-archived='true'] {
    filter: grayscale(1);
}

/*
 * 已归档只读提示（`T795`）：灰阶语义（⛔ 不用强调色）——图标 + 文字 + `data-archived` 三重冗余。
 * 对比：正文 `--nue-primary-text-color`（-800）压 `-100` 底实测 ≥4.5:1。
 */
.tasks-details-view__readonly-hint {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    width: 100%;
    box-sizing: border-box;
    padding: var(--nue-padding-2xs) var(--nue-padding-df);
    font-size: var(--nue-text-xs);
    line-height: 1.5;
    color: var(--nue-primary-text-color);
    background-color: var(--nue-primary-color-100);
    border-bottom: 1px solid var(--nue-border-color);
}
</style>