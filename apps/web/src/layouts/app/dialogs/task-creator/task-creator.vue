<script lang="ts" setup>
import { computed, onMounted, ref, nextTick } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import {
    TaskCreatorInput,
    TaskDateSelector,
    TaskProjectSelector,
    TaskSelector,
    TaskTagBar
} from '@nao-todo/components'
import {
    TaskStateSelectOptions,
    TaskPrioritySelectOptions
} from '@nao-todo/infrastructure/consts/tasks'
import type { CreateTaskViewObject, TaskViewObject } from '@nao-todo/types'
import useTaskCreator from './use-task-creator'
import {
    TAG_CREATOR_DIALOG_KEY,
    TASK_CREATOR_DIALOG_KEY
} from '@/infrastructure/constants/dialog-keys'
import { t } from '@nao-todo/infrastructure/locales'
import dayjs from 'dayjs'
// import { parse2RelativeDate } from '@nao-todo/infrastructure/utils'

defineOptions({ name: 'TaskCreator' })

const dialogRef = ref<DialogInstanceType>()
const taskCreatorInputRef = ref<InstanceType<typeof TaskCreatorInput>>()

const {
    states,
    avaliableProjects,
    avaliableTags,
    dialogManager,
    handleCreateTask,
    clearInputsValue,
    handleUpdateEndAt,
    handleUpdateRemind,
    handleUpdateEndAtAndRemind,
    useSmartCreator,
    taskInputValue
} = useTaskCreator()
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

const isExpired = computed(() => {
    return states.state !== 'done' && dayjs(states.endAt).isBefore(dayjs())
})

const open = (createTaskOptions: CreateTaskViewObject) => {
    useSmartCreator.value = localStorage.getItem('TASK_CREATOR_SMART_MODE') === 'true'
    clearInputsValue()
    if (createTaskOptions) {
        Object.keys(createTaskOptions).forEach((key) => {
            const presetVal = createTaskOptions[key as keyof CreateTaskViewObject]
            if (!presetVal) return
            const targetKey = key as keyof typeof states
            if (targetKey in states) {
                ;(states as any)[targetKey] = presetVal
            }
        })
        // 预填充智能输入中的 tags 和 projectId
        if (createTaskOptions.tags?.length) {
            taskInputValue.value = {
                ...taskInputValue.value,
                tags: [...createTaskOptions.tags]
            }
        }
        if (createTaskOptions.projectId) {
            taskInputValue.value = {
                ...taskInputValue.value,
                projectId: createTaskOptions.projectId
            }
        }
    }
    visible.value = true
    nextTick(() => taskCreatorInputRef.value?.focus())
}

const close = () => {
    closeDialog()
    states.disabled = false
}

const handleSubmit = async () => {
    const ok = await handleCreateTask()
    if (ok) close()
}

onMounted(() => {
    dialogManager.register(TASK_CREATOR_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog
        :theme="useSmartCreator ? 'task-creator-v2' : 'task-creator'"
        v-model="visible"
        ref="dialogRef"
        :title="t('dialog.taskCreator.title')"
    >
        <template #content>
            <nue-div vertical align="stretch" gap="0.75rem">
                <!-- ═══ 旧模式 ═══ -->
                <template v-if="!useSmartCreator">
                    <nue-input
                        v-model="states.name"
                        clearable
                        :placeholder="t('dialog.taskCreator.namePlaceholder')"
                        maxlength="64"
                        counter="word-left"
                    />
                    <nue-textarea
                        v-model="states.description"
                        maxlength="256"
                        counter="word-left"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        :placeholder="t('dialog.taskCreator.descPlaceholder')"
                        theme="fix-padding"
                    />
                    <nue-div align="center" gap="0.5rem">
                        <task-date-selector
                            :colored="!isExpired"
                            v-model="states.endAt!"
                            :task-remind-data="states"
                            @change="handleUpdateEndAt"
                            @remind-change="handleUpdateRemind"
                            @update-all="handleUpdateEndAtAndRemind"
                        />
                    </nue-div>
                    <nue-div wrap="wrap" gap=".5rem">
                        <task-selector
                            :options="TaskStateSelectOptions"
                            :value="states.state"
                            @change="(s: any) => (states.state = s as TaskViewObject['state'])"
                        />
                        <task-selector
                            :options="TaskPrioritySelectOptions"
                            :value="states.priority"
                            @change="
                                (p: any) => (states.priority = p as TaskViewObject['priority'])
                            "
                        />
                        <nue-div flex="1" />
                        <task-project-selector
                            :project-id="states.projectId || ''"
                            :projects="avaliableProjects || []"
                            @select="(pid: string) => (states.projectId = pid)"
                        />
                    </nue-div>
                    <task-tag-bar
                        :available-tags="avaliableTags || []"
                        :task-tag-ids="states.tags || []"
                        @update-tags="(_tags: any) => (states.tags = _tags)"
                        @create-tag="
                            (name: string) => dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })
                        "
                    />
                </template>

                <!-- ═══ 新模式 ═══ -->
                <template v-if="useSmartCreator">
                    <nue-div vertical gap="var(--nue-gap-sm)">
                        <task-creator-input
                            ref="taskCreatorInputRef"
                            v-model="taskInputValue"
                            :tags="avaliableTags || []"
                            :projects="avaliableProjects || []"
                            :priority-options="TaskPrioritySelectOptions"
                            :state-options="TaskStateSelectOptions"
                            :placeholder="t('dialog.taskCreator.smartPlaceholder')"
                            @create-tag="
                                (name: string) =>
                                    dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })
                            "
                        />
                        <nue-textarea
                            v-model="states.description"
                            maxlength="256"
                            :autosize="{ minRows: 1, maxRows: 4 }"
                            :placeholder="t('dialog.taskCreator.descPlaceholder')"
                            theme="pure"
                        />
                        <nue-div wrap="wrap" gap=".5rem">
                            <task-date-selector
                                :colored="!isExpired"
                                v-model="states.endAt!"
                                :task-remind-data="states"
                                @change="handleUpdateEndAt"
                                @remind-change="handleUpdateRemind"
                                @update-all="handleUpdateEndAtAndRemind"
                            />
                            <task-selector
                                :options="TaskStateSelectOptions"
                                :value="states.state"
                                @change="(s: any) => (states.state = s as TaskViewObject['state'])"
                            />
                            <task-selector
                                :options="TaskPrioritySelectOptions"
                                :value="states.priority"
                                @change="
                                    (p: any) => (states.priority = p as TaskViewObject['priority'])
                                "
                            />
                        </nue-div>
                    </nue-div>
                </template>
            </nue-div>
        </template>
        <template #footer>
            <task-project-selector
                v-if="useSmartCreator"
                :project-id="states.projectId || ''"
                :projects="avaliableProjects || []"
                @select="(pid: string) => (states.projectId = pid)"
            />
            <nue-div gap="var(--nue-gap-xs)" flex="1" justify="flex-end">
                <nue-button theme="small" :disabled="states.disabled" @click="close">
                    {{ t('common.cancel') }}
                </nue-button>
                <nue-button
                    :disabled="states.disabled"
                    :loading="states.creating"
                    theme="small,primary"
                    @click="handleSubmit"
                >
                    {{ t('common.create') }}
                </nue-button>
            </nue-div>
        </template>
    </nue-dialog>
</template>

<style>
.nue-dialog--task-creator {
    width: 24rem;
}

.nue-dialog--task-creator-v2 {
    width: 28rem;
}
</style>

