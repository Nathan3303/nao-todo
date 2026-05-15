<script lang="ts" setup>
import { onMounted, ref } from 'vue'
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
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'TaskCreator' })

const dialogRef = ref<DialogInstanceType>()

const { states, avaliableProjects, avaliableTags, dialogManager, handleCreateTask, clearInputsValue } =
    useTaskCreator()
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

const open = (createTaskOptions: CreateTaskViewObject) => {
    clearInputsValue()
    Object.keys(createTaskOptions).forEach((key) => {
        const presetVal = createTaskOptions[key as keyof CreateTaskViewObject]
        if (!presetVal) return
        const targetKey = key as keyof typeof states
        if (targetKey in states) {
            ;(states as any)[targetKey] = presetVal
        }
    })
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
    <nue-dialog v-model="visible" ref="dialogRef" title="创建待办事项">
        <template #content>
            <nue-div vertical align="stretch">
                <nue-input
                    v-model="states.name"
                    clearable
                    placeholder="待办事项名称"
                    maxlength="64"
                    counter="word-left"
                />
                <nue-textarea
                    v-model="states.description"
                    maxlength="256"
                    counter="word-left"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    placeholder="添加待办事项备注（可选）"
                    theme="fix-padding"
                />
                <nue-div wrap="wrap" gap=".5rem">
                    <task-date-selector v-model="states.endAt" />
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
                    <task-project-selector
                        :project-id="states.projectId"
                        :projects="avaliableProjects || []"
                        @select="(pid: string) => (states.projectId = pid)"
                    />
                </nue-div>
                <task-tag-bar
                    :clamped="5"
                    :tags="avaliableTags || []"
                    :task-tags="states.tags || []"
                    @update-tags="(_tags: any) => (states.tags = _tags)"
                />
            </nue-div>
        </template>
        <template #footer>
            <nue-button :disabled="states.disabled" @click="close">取消</nue-button>
            <nue-button
                :disabled="states.disabled"
                :loading="states.creating"
                theme="primary"
                @click="handleSubmit"
            >
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>
