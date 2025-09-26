<script lang="ts" setup>
import { ref } from 'vue'
import useTodoCreator, { defaultCreateTodoOptions } from './use-todo-creator'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import { useRelativeDate } from '@nao-todo/hooks/use-relative-date'
import {
    TodoDateSelector,
    TodoPrioritySelectOptions,
    TodoProjectSelector,
    TodoSelector,
    TodoStateSelectOptions,
    TodoTagBar
} from '@nao-todo/components'
import type { CreateTodoOptions, Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoCreator' })

const dialogRef = ref<DialogInstanceType>()

const { visible, open, close } = useDialogWrapper(dialogRef)
const { user, projects, tags, newTodo, creating, disabled, handleCreateTodo } = useTodoCreator()

const iOpen = (createTodoOptions: CreateTodoOptions) => {
    newTodo.value = { ...newTodo.value, ...createTodoOptions }
    open()
}

const iClose = () => {
    close()
    newTodo.value = { ...defaultCreateTodoOptions }
    disabled.value = false
}

const handleSubmit = async () => {
    const ok = await handleCreateTodo()
    if (ok) iClose()
}

defineExpose({ open: iOpen, close: iClose })
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef">
        <template #header>
            <nue-text>创建待办事项</nue-text>
            <nue-button @click="iClose" icon="clear" theme="icon,ghost,small" />
        </template>
        <template #content>
            <nue-div vertical align="stretch">
                <nue-input
                    v-model="newTodo.name"
                    clearable
                    placeholder="待办事项名称"
                    maxlength="64"
                    counter="word-left"
                />
                <nue-textarea
                    v-model="newTodo.description"
                    maxlength="256"
                    counter="word-left"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    placeholder="添加待办事项备注（可选）"
                    theme="fix-padding"
                />
                <nue-div align="center">
                    <todo-date-selector v-model="newTodo.endAt" />
                    <nue-text v-if="newTodo.endAt" color="gray" size="var(--nue-text-xs)">
                        任务截止于：{{ useRelativeDate(newTodo.endAt) }}
                    </nue-text>
                </nue-div>
                <nue-div wrap="nowrap">
                    <todo-selector
                        :options="TodoStateSelectOptions"
                        :value="newTodo.state"
                        @change="(s) => (newTodo.state = s as Todo['state'])"
                    />
                    <todo-selector
                        :options="TodoPrioritySelectOptions"
                        :value="newTodo.priority"
                        @change="(p) => (newTodo.priority = p as Todo['priority'])"
                    />
                    <nue-div flex="1" />
                    <todo-project-selector
                        :project-id="newTodo.projectId"
                        :projects="projects"
                        :user-id="user?.id || ''"
                        @select="(pid) => (newTodo.projectId = pid)"
                    />
                </nue-div>
                <todo-tag-bar
                    :clamped="5"
                    :tags="tags"
                    :todo-tags="newTodo.tags || []"
                    @update-tags="(_tags) => (newTodo.tags = _tags)"
                />
            </nue-div>
        </template>
        <template #footer>
            <nue-button :disabled="creating" @click="iClose">取消</nue-button>
            <nue-button
                :disabled="disabled"
                :loading="creating"
                theme="primary"
                @click="handleSubmit"
            >
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>
