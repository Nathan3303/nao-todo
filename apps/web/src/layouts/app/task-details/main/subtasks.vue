<script lang="ts" setup>
import { InputButton, Loading } from '@nao-todo/components'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import { inject, nextTick, reactive, ref } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'
import type { TaskViewObject } from '@nao-todo/usecases/task'
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
                        align="center"
                    >
                        <nue-icon
                            :name="
                                updatingIds.has(subTask.id)
                                    ? 'loading'
                                    : subTask.state === 'done'
                                      ? 'square-check-fill'
                                      : 'square'
                            "
                            :spin="updatingIds.has(subTask.id)"
                            theme="pointer"
                            class="subtask-row__icon"
                            @click="toggleState(subTask)"
                        />
                        <nue-text
                            v-if="editingId !== subTask.id"
                            :clamped="1"
                            class="subtask-row__name"
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
                        <nue-div class="subtask-row__actions">
                            <template v-if="editingId !== subTask.id">
                                <nue-button
                                    icon="edit"
                                    theme="small,pure"
                                    :title="t('common.edit')"
                                    @click="startEditName(subTask)"
                                />
                                <nue-button
                                    icon="arrow-right"
                                    theme="small,pure"
                                    :title="t('task.details.view')"
                                    @click="switchTaskDetails(subTask.id)"
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
                        icon="plus-circle"
                        :button-text="t('task.details.subTaskCreate')"
                        :placeholder="t('task.details.subTaskNamePlaceholder')"
                        theme="pure,noshape"
                        :submit-on-blur="false"
                        :on-submit="handleCreateSubTask"
                        style="margin: var(--nue-padding-xs); width: auto; height: auto"
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
    flex: auto;

    > .nue-main {
        height: auto;
        border: none;

        > .nue-content {
            display: flex;
            flex-direction: column;
            flex-wrap: nowrap;
            gap: 0.25rem;
            overflow: hidden;
        }
    }
}

.subtask-row {
    flex-wrap: nowrap;
    gap: var(--nue-gap-xs);
    padding: var(--nue-padding-xs);
    height: var(--nue-box-size-df);
    color: var(--nue-primary-color-900);
    background-color: transparent;
    transition: background-color var(--nue-animation-duration, 0.15s) ease;
    border-radius: var(--nue-primary-radius);
    box-sizing: border-box;
    line-height: 1;

    &:hover,
    &:focus-within {
        background-color: var(--nue-primary-color-100);
    }

    .subtask-row__icon {
        font-size: var(--nue-text-md);
        flex: none;
    }

    .subtask-row__name {
        flex: 1;
        font-size: var(--nue-text-sm);
        color: inherit;
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
        transition: opacity var(--nue-animation-duration, 0.15s) ease;
        gap: var(--nue-gap-sm);
    }

    &:hover .subtask-row__actions,
    &:focus-within .subtask-row__actions,
    &[data-editing='true'] .subtask-row__actions {
        opacity: 1;
    }

    &[data-done='true'] {
        .subtask-row__icon {
            color: var(--nue-primary-color-600);
        }

        .subtask-row__name {
            text-decoration: line-through;
            color: var(--nue-primary-color-600);
        }
    }
}
</style>

