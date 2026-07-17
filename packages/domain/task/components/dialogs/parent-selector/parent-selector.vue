<script lang="ts" setup>
import {
    type DialogInstanceType,
    LoadingError,
    PARENT_TASK_SELECTOR_DIALOG_KEY,
    t,
    useDialogWrapper
} from '@nao-todo/shared'
import { onMounted, ref } from 'vue'
import type { ParentTaskSelectorPayload, TaskParentSelectorDialogProps } from './types'
import { useParentTaskSelector } from './use-parent-selector'

defineOptions({ name: 'ParentTaskSelector' })
const props = defineProps<TaskParentSelectorDialogProps>()

const dialogRef = ref<DialogInstanceType>()
const { states, tasks, initialize, selectTask, confirmSelect } = useParentTaskSelector(props)
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

const open = (payload: ParentTaskSelectorPayload) => {
    initialize(payload)
    visible.value = true
}

const close = () => closeDialog()

const handleConfirm = () => {
    if (confirmSelect()) close()
}

onMounted(() => props.dialogManager.register(PARENT_TASK_SELECTOR_DIALOG_KEY, { open, close }))
</script>

<template>
    <nue-dialog
        theme="parent-task-selector"
        v-model="visible"
        ref="dialogRef"
        :title="t('dialog.parentTaskSelector.title')"
    >
        <template #content>
            <nue-div vertical align="stretch" gap="0.75rem">
                <nue-input
                    v-model="states.keyword"
                    icon="search"
                    clearable
                    :placeholder="t('dialog.parentTaskSelector.searchPlaceholder')"
                />
                <nue-div class="parent-task-selector__list" vertical gap="0.25rem">
                    <loading-error
                        :loading="states.loading"
                        :empty="!tasks.length"
                        :error="!!states.error"
                        :error-message="states.error"
                    >
                        <nue-div
                            v-for="task in tasks"
                            :key="task.id"
                            class="parent-task-selector__item"
                            :data-selected="task.id === states.selectedTaskId"
                            align="center"
                            @click="selectTask(task.id)"
                        >
                            <nue-icon
                                :name="task.id === states.selectedTaskId ? 'check' : 'circle'"
                                class="parent-task-selector__item-icon"
                            />
                            <nue-text :clamped="1">{{ task.name }}</nue-text>
                        </nue-div>
                    </loading-error>
                    <!-- <nue-loading v-if="states.loading" />
                    <nue-empty
                        v-else-if="states.error"
                        :description="states.error"
                        image-size="64px"
                    />
                    <nue-empty
                        v-else-if="!tasks.length"
                        :description="t('dialog.parentTaskSelector.empty')"
                        image-size="64px"
                    /> -->
                    <!-- <template v-else> </template> -->
                </nue-div>
            </nue-div>
        </template>
        <template #footer>
            <nue-div gap="var(--nue-gap-xs)" flex="1" justify="flex-end">
                <nue-button theme="small" @click="close">
                    {{ t('common.cancel') }}
                </nue-button>
                <nue-button
                    theme="small,primary"
                    :disabled="!states.selectedTaskId"
                    @click="handleConfirm"
                >
                    {{ t('common.confirm') }}
                </nue-button>
            </nue-div>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--parent-task-selector {
    width: 24rem;
}

.parent-task-selector__list {
    max-height: 320px;
    overflow-y: auto;
}

.parent-task-selector__item {
    flex-wrap: nowrap;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: var(--nue-radius, 6px);
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.parent-task-selector__item:hover {
    background-color: var(--nue-primary-color-20);
}

.parent-task-selector__item[data-selected='true'] {
    background-color: var(--nue-primary-color-30);
}

.parent-task-selector__item-icon {
    flex: none;
    color: var(--nue-primary-color-400);
}

.parent-task-selector__item[data-selected='true'] .parent-task-selector__item-icon {
    color: var(--nue-primary-color-600);
}
</style>
