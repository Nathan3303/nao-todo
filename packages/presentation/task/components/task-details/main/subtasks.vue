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
import { inject, nextTick, reactive, ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { NueInput } from 'nue-ui'

const {
    subTasks,
    subTasksLoading,
    subTasksError,
    retrySubTasks,
    switchTaskDetails,
    subTaskHandler,
    createSubTask
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

// 子任务 meta 文案（开始/结束时间 + 描述，仅拼接非空部分；
// 分隔符只在对应部分存在时出现，避免悬空 ~ 或孤立 ·）
const metaText = (subTask: TaskViewObject): string => {
    const timeParts: string[] = []
    if (subTask.startAt)
        timeParts.push(t('task.details.startedAt', { time: formatDateTime(subTask.startAt) }))
    if (subTask.endAt)
        timeParts.push(t('task.details.dueAt', { time: formatDateTime(subTask.endAt) }))
    const timeText = timeParts.join(' ~ ')
    if (!subTask.description) return timeText
    return timeText ? `${timeText} · ${subTask.description}` : subTask.description
}

// 正在更新状态的子任务 ID 集合
const updatingIds = reactive(new Set<TaskViewObject['id']>())

// 正在编辑名称的子任务 ID 与编辑中的名称
const editingId = ref<TaskViewObject['id'] | null>(null)
const editingName = ref('')
const nameInputer = ref<InstanceType<typeof NueInput>>()

// 切换子任务完成状态（todo ⇄ done）
const toggleState = (subTask: TaskViewObject) => {
    if (updatingIds.has(subTask.id)) return
    updatingIds.add(subTask.id)
    subTaskHandler
        .updateTaskState(subTask.id, subTask.state === 'done' ? 'todo' : 'done')
        .finally(() => updatingIds.delete(subTask.id))
}

// 进入名称编辑模式
const startEditName = (subTask: TaskViewObject) => {
    if (updatingIds.has(subTask.id)) return
    editingId.value = subTask.id
    editingName.value = subTask.name
    nextTick(() => nameInputer.value?.innerInputRef?.focus())
}

// 退出名称编辑模式
const cancelEditName = () => {
    editingId.value = null
    editingName.value = ''
}

// 失焦时提交名称更新（仅当内容变化），随后退出编辑模式
const submitEditName = (subTask: TaskViewObject) => {
    if (editingId.value !== subTask.id) return
    const nextName = editingName.value.trim()
    if (!nextName || nextName === subTask.name) {
        editingId.value = null
        return
    }
    updatingIds.add(subTask.id)
    subTaskHandler.updateTaskName(subTask.id, nextName).finally(() => {
        updatingIds.delete(subTask.id)
        editingId.value = null
    })
}

// 创建子任务（提交任务名称）
const handleCreateSubTask = async (payload: { value: string }) => {
    await createSubTask(payload.value)
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
                        :data-editing="editingId === subTask.id"
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
                                    v-if="editingId !== subTask.id"
                                    :clamped="1"
                                    class="subtask-row__name"
                                    @click="switchTaskDetails(subTask.id)"
                                >
                                    {{ subTask.name }}
                                </nue-text>
                                <nue-input
                                    v-else
                                    ref="nameInputer"
                                    v-model="editingName"
                                    class="subtask-row__input"
                                    theme="pure,small"
                                    placeholder="请输入子任务名称"
                                    maxlength="64"
                                    :disabled="updatingIds.has(subTask.id)"
                                    @blur="submitEditName(subTask)"
                                    @keydown.enter="submitEditName(subTask)"
                                />
                            </nue-div>
                            <nue-text
                                v-if="editingId !== subTask.id && metaText(subTask)"
                                :clamped="2"
                                class="subtask-row__meta"
                            >
                                {{ metaText(subTask) }}
                            </nue-text>
                        </nue-div>
                        <nue-div class="subtask-row__actions">
                            <template v-if="editingId !== subTask.id">
                                <nue-button
                                    icon="edit"
                                    theme="small,pure"
                                    :title="t('common.edit')"
                                    @click="startEditName(subTask)"
                                />
                            </template>
                            <template v-else>
                                <nue-button
                                    icon="check"
                                    theme="small,pure"
                                    :disabled="updatingIds.has(subTask.id)"
                                    @click="submitEditName(subTask)"
                                />
                                <nue-button
                                    icon="clear"
                                    theme="small,pure"
                                    :disabled="updatingIds.has(subTask.id)"
                                    @click="cancelEditName"
                                />
                            </template>
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
    align-items: flex-start; /* 顶部对齐：左 CheckBtn / 标题行 / 右操作 */
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
        gap: 2px;
    }

    .subtask-row__title-line {
        display: flex;
        align-items: center;
        min-width: 0;
        height: 1.5rem; /* 与左右组件等高 */
    }

    .subtask-row__name {
        font-size: var(--nue-text-sm);
        color: inherit;

        &:hover {
            text-decoration: underline;
            cursor: pointer;
        }
    }

    .subtask-row__meta {
        font-size: var(--nue-text-xs);
        font-weight: 500;
        color: var(--nue-primary-color-600);
        line-height: 1.4;
    }

    .subtask-row__input {
        font-size: var(--nue-text-sm);
        flex: 1;

        &:deep(input) {
            margin-top: 2px;
            margin-left: -1px;
        }
    }

    .subtask-row__actions {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        opacity: 0;
        gap: var(--nue-gap-sm);
        height: 1.5rem; /* 与标题行同高基准 */
    }

    &:hover .subtask-row__actions,
    &:focus-within .subtask-row__actions,
    &[data-editing='true'] .subtask-row__actions {
        opacity: 1;
    }

    &[data-done='true'] {
        .subtask-row__name {
            text-decoration: line-through;
            color: var(--nue-primary-color-600);
        }
    }
}
</style>