<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import {
    TodoDateSelector,
    TodoPrioritySelectOptions,
    TodoProjectSelector,
    TodoSelector,
    TodoStateSelectOptions,
    TodoTagBar
} from '@nao-todo/components'
import type { CreateTaskVO, Todo } from '@nao-todo/types'
import useTaskCreator from './use-task-creator'
import type { TaskCreatorProps, TaskCreatorEmits, TaskCreatorVO } from './types'
import dayjs from 'dayjs'

defineOptions({ name: 'TaskCreator' })
const props = defineProps<TaskCreatorProps>()
const emit = defineEmits<TaskCreatorEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, handleCreateTask, clearInputsValue } = useTaskCreator(props)
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

const open = (createTaskOptions: CreateTaskVO) => {
    clearInputsValue()
    Object.keys(createTaskOptions).forEach((key) => {
        const presetVal = createTaskOptions[key as keyof CreateTaskVO]
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
                    <todo-date-selector v-model="states.endAt" />
                    <nue-text v-if="states.endAt" color="gray" size="var(--nue-text-xs)">
                        任务截止于：{{ dayjs(states.endAt).format('YYYY-MM-DD HH:mm') }}
                    </nue-text>
                </nue-div>
                <nue-div wrap="nowrap">
                    <todo-selector
                        :options="TodoStateSelectOptions"
                        :value="states.state"
                        @change="(s) => (states.state = s as Todo['state'])"
                    />
                    <todo-selector
                        :options="TodoPrioritySelectOptions"
                        :value="states.priority"
                        @change="(p) => (states.priority = p as Todo['priority'])"
                    />
                    <nue-div flex="1" />
                    <todo-project-selector
                        :project-id="states.projectId"
                        :projects="props.avaliableProjects || []"
                        @select="(pid) => (states.projectId = pid)"
                    />
                </nue-div>
                <todo-tag-bar
                    :clamped="5"
                    :tags="props.avaliableTags || []"
                    :todo-tags="states.tags || []"
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
