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
import type { CreateTask, Task } from '@nao-todo/types'
import useTaskCreator from './use-task-creator'
import type { TaskCreatorProps, TaskCreatorEmits, TaskCreatorVO } from './types'
import dayjs from 'dayjs'

defineOptions({ name: 'TaskCreator' })
const props = defineProps<TaskCreatorProps>()
const emit = defineEmits<TaskCreatorEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, handleCreateTask, clearInputsValue } = useTaskCreator(props)
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

const open = (createTaskOptions: CreateTask) => {
    clearInputsValue()
    Object.keys(createTaskOptions).forEach((key) => {
        const presetVal = createTaskOptions[key as keyof CreateTask]
        if (!presetVal) return
        const targetKey = key as keyof TaskCreatorVO
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

onMounted(() => emit('register', open, close))
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>创建待办事项</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
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
                <nue-div align="center">
                    <task-date-selector v-model="states.endAt" />
                    <nue-text v-if="states.endAt" color="gray" size="var(--nue-text-xs)">
                        任务截止于：{{ dayjs(states.endAt).format('YYYY-MM-DD HH:mm') }}
                    </nue-text>
                </nue-div>
                <nue-div wrap="nowrap">
                    <task-selector
                        :options="TaskStateSelectOptions"
                        :value="states.state"
                        @change="(s) => (states.state = s as Task['state'])"
                    />
                    <task-selector
                        :options="TaskPrioritySelectOptions"
                        :value="states.priority"
                        @change="(p) => (states.priority = p as Task['priority'])"
                    />
                    <nue-div flex="1" />
                    <task-project-selector
                        :project-id="states.projectId"
                        :projects="props.avaliableProjects || []"
                        @select="(pid: string) => (states.projectId = pid)"
                    />
                </nue-div>
                <task-tag-bar
                    :clamped="5"
                    :tags="props.avaliableTags || []"
                    :task-tags="states.tags || []"
                    @update-tags="(_tags) => (states.tags = _tags)"
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

