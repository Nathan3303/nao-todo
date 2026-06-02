<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import {
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

const {
    states,
    avaliableProjects,
    avaliableTags,
    dialogManager,
    handleCreateTask,
    clearInputsValue,
    handleUpdateEndAt,
    handleUpdateRemind,
    handleUpdateEndAtAndRemind
} = useTaskCreator()
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

const isExpired = computed(() => {
    return states.state !== 'done' && dayjs(states.endAt).isBefore(dayjs())
})

const open = (createTaskOptions: CreateTaskViewObject) => {
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
    }
    visible.value = true
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
        theme="creator"
        v-model="visible"
        ref="dialogRef"
        :title="t('dialog.taskCreator.title')"
    >
        <template #content>
            <nue-div vertical align="stretch">
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
                        @change="(p: any) => (states.priority = p as TaskViewObject['priority'])"
                    />
                    <nue-div flex="1" />
                    <task-project-selector
                        :project-id="states.projectId || ''"
                        :projects="avaliableProjects || []"
                        @select="(pid: string) => (states.projectId = pid)"
                    />
                </nue-div>
                <task-tag-bar
                    :clamped="5"
                    :available-tags="avaliableTags || []"
                    :task-tag-ids="states.tags || []"
                    @update-tags="(_tags: any) => (states.tags = _tags)"
                    @create-tag="
                        (name: string) => dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })
                    "
                />
            </nue-div>
        </template>
        <template #footer>
            <nue-button :disabled="states.disabled" @click="close">{{
                t('common.cancel')
            }}</nue-button>
            <nue-button
                :disabled="states.disabled"
                :loading="states.creating"
                theme="primary"
                @click="handleSubmit"
            >
                {{ t('common.create') }}
            </nue-button>
        </template>
    </nue-dialog>
</template>

