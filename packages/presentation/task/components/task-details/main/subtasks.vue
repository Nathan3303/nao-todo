<script lang="ts" setup>
import {
    InputButton,
    Loading,
    parse2RelativeDate,
    t,
    TaskCheckButton,
    TaskPriorityPresets
} from '@nao-todo/shared'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import { inject, reactive } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { NueConfirm, NueMessage } from 'nue-ui'
import { translateTaskError } from '../../../utils/error-message'

const {
    subTasks,
    subTasksLoading,
    subTasksError,
    retrySubTasks,
    switchTaskDetails,
    subTaskHandler,
    createSubTask,
    detachSubTask
} = inject(TASK_DETAILS_CONTEXT_KEY)!

// 优先级 → 颜色（与 TaskPriorityInfo 共用 TaskPriorityPresets 常量；low/inherit 视为默认色不覆盖）
const priorityColorOf = (priority: string): string | undefined => {
    const color = TaskPriorityPresets.value[priority as keyof typeof TaskPriorityPresets.value]?.[2]
    return color && color !== 'inherit' ? color : undefined
}

// 时间格式化（与记录表格页惯例一致）
const formatDateTime = (iso: string | null): string => {
    return (iso && parse2RelativeDate(iso)) || ''
}

// 子任务时间文案（开始/结束时间内联于名称末尾，格式与文案与改动前一致：
// 仅拼接非空部分，分隔符只在对应部分存在时出现，避免悬空 ~）
const timeText = (subTask: TaskViewObject): string => {
    const timeParts: string[] = []
    if (subTask.startAt)
        timeParts.push(t('task.details.startedAt', { time: formatDateTime(subTask.startAt) }))
    if (subTask.endAt)
        timeParts.push(t('task.details.dueAt', { time: formatDateTime(subTask.endAt) }))
    return timeParts.join(' ~ ')
}

// 正在更新状态的子任务 ID 集合
const updatingIds = reactive(new Set<TaskViewObject['id']>())

// 切换子任务完成状态（todo ⇄ done）
const toggleState = (subTask: TaskViewObject) => {
    if (updatingIds.has(subTask.id)) return
    updatingIds.add(subTask.id)
    subTaskHandler
        .updateTaskState(subTask.id, subTask.state === 'done' ? 'todo' : 'done')
        .finally(() => updatingIds.delete(subTask.id))
}

// 创建子任务（提交任务名称）
const handleCreateSubTask = async (payload: { value: string }) => {
    await createSubTask(payload.value)
}

// 脱离父任务（提升为顶层任务）：先确认，成功后从列表移除并刷新顶层列表
const handleDetachSubTask = async (subTask: TaskViewObject) => {
    if (updatingIds.has(subTask.id)) return
    const [isByCancel] = await NueConfirm({
        title: t('task.details.detachFromParent'),
        content: t('task.details.detachFromParentConfirm'),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel')
    })
    if (isByCancel) return
    updatingIds.add(subTask.id)
    try {
        const err = await detachSubTask(subTask.id)
        if (err !== null) NueMessage.error(translateTaskError(err))
    } finally {
        updatingIds.delete(subTask.id)
    }
}
</script>

<template>
    <nue-container id="TodoDetailsSubTasksContainer">
        <nue-main>
            <nue-content>
                <loading v-if="subTasksLoading" :placeholder="t('task.details.subTasksLoading')" />
                <nue-empty v-else-if="subTasksError" :description="subTasksError" image-size="64px">
                    <nue-button theme="primary,small" @click="retrySubTasks">
                        {{ t('common.retry') }}
                    </nue-button>
                </nue-empty>
                <template v-else>
                    <nue-div
                        v-for="subTask in subTasks"
                        :key="subTask.id"
                        class="subtask-row"
                        :data-done="subTask.state === 'done'"
                    >
                        <task-check-button
                            class="subtask-row__check"
                            size="small"
                            :is-done="subTask.state === 'done'"
                            :is-updating="updatingIds.has(subTask.id)"
                            :priority-color="
                                subTask.state === 'done'
                                    ? undefined
                                    : priorityColorOf(subTask.priority)
                            "
                            @change="toggleState(subTask)"
                        />
                        <nue-div class="subtask-row__body">
                            <nue-div class="subtask-row__title-line">
                                <nue-text
                                    class="subtask-row__name"
                                    @click="switchTaskDetails(subTask.id)"
                                >
                                    {{ subTask.name }}
                                </nue-text>
                                <nue-text
                                    v-if="timeText(subTask)"
                                    class="subtask-row__time"
                                    :title="timeText(subTask)"
                                >
                                    {{ timeText(subTask) }}
                                </nue-text>
                                <nue-button
                                    class="subtask-row__detach"
                                    icon="arrow-up"
                                    theme="small,pure"
                                    :disabled="updatingIds.has(subTask.id)"
                                    :title="t('task.details.detachFromParent')"
                                    @click="handleDetachSubTask(subTask)"
                                />
                            </nue-div>
                            <nue-text
                                v-if="subTask.description"
                                :clamped="2"
                                class="subtask-row__meta"
                            >
                                {{ subTask.description }}
                            </nue-text>
                        </nue-div>
                    </nue-div>
                    <input-button
                        class="subtask-row__create-bar"
                        icon="plus-circle"
                        :button-text="t('task.details.subTaskCreate')"
                        :placeholder="t('task.details.subTaskNamePlaceholder')"
                        theme="pure,noshape"
                        :submit-on-blur="false"
                        :on-submit="handleCreateSubTask"
                    />
                </template>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#TodoDetailsSubTasksContainer {
    border-top: 1px solid var(--nue-divider-color);
    padding: 0.5rem;
    gap: 0.5rem;
    height: auto;
    overflow: unset;

    > .nue-main {
        height: auto;
        border: none;

        > .nue-content {
            display: flex;
            flex-direction: column;
            flex-wrap: nowrap;
            overflow: hidden;

            .subtask-row__create-bar {
                margin: 0 var(--nue-padding-xs);
                width: auto;
                height: 2rem;
            }
        }
    }
}

.subtask-row {
    flex-wrap: nowrap;
    gap: var(--nue-gap-xs);
    padding: var(--nue-padding-2xs) var(--nue-padding-xs);
    align-items: flex-start; /* 顶部对齐：左 CheckBtn / 标题行 / 描述行 */
    color: var(--nue-primary-color-900);
    background-color: transparent;
    border-radius: var(--nue-primary-radius);
    cursor: default;
    line-height: 1;

    &:hover,
    &:focus-within {
        background-color: var(--nue-primary-color-100);
    }

    .subtask-row__check {
        flex: none;
        padding: 0;
        margin: 0;
        height: 1.5rem;
        width: 1.125rem;
    }

    .subtask-row__body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .subtask-row__title-line {
        display: flex;
        align-items: center;
        gap: var(--nue-gap-xs);
        min-width: 0;
        height: 1.5rem; /* 与左右组件等高 */
    }

    /* 行内唯一可收缩项 ⇒ 空间不足时先被截断（省略号，全文见详情页标题） */
    .subtask-row__name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: var(--nue-text-sm);
        color: inherit;

        &:hover {
            text-decoration: underline;
            cursor: pointer;
        }
    }

    /* 时间内联于名称末尾：宽度随内容、不收缩；超上限时省略号截断（不硬裁切）
       全文由 title 提供；点击不触发详情导航（无独立交互） */
    .subtask-row__time {
        flex: 0 0 auto;
        max-width: var(--subtask-row-time-max-width, 60%);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: var(--nue-text-xs);
        font-weight: 500;
        color: var(--nue-primary-color-600);
    }

    .subtask-row__detach {
        flex: none;
        opacity: 0; /* 预留位：hover / focus-within 才可见，避免行内跳动 */
    }

    &:hover .subtask-row__detach,
    &:focus-within .subtask-row__detach {
        opacity: 1;
    }

    .subtask-row__meta {
        font-size: var(--nue-text-xs);
        font-weight: 500;
        color: var(--nue-primary-color-600);
        line-height: 1.4;
    }

    &[data-done='true'] {
        .subtask-row__name {
            text-decoration: line-through;
            color: var(--nue-primary-color-600);
        }
    }
}
</style>