<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { TodoProjectSelector } from '@nao-todo/components'
import { InnerDropdownOption } from '@/components/ui'
import type { DetailsFooterEmits, DetailsFooterProps } from './types'

const props = defineProps<DetailsFooterProps>()
const emit = defineEmits<DetailsFooterEmits>()

const tasksDataStore = useTasksDataStore()

const { projects, user } = storeToRefs(tasksDataStore)

const handleDropdownExecute = (executeId: string) => {
    if (!props.shadowTodo) {
        return
    }
    switch (executeId) {
        case 'comment-todo':
            emit('leaveTodoComment')
            break
        case 'duplicate-todo':
            emit('duplicateTodo', props.shadowTodo.id)
            break
        case 'give-up-todo':
            emit('giveUpTodo')
            break
        case 'cancel-give-up-todo':
            emit('cancelGiveUpTodo')
            break
        case 'delete-todo':
            emit('deleteTodo', props.shadowTodo.id)
            break
        case 'restore-todo':
            emit('restoreTodo', props.shadowTodo.id)
            break
        case 'delete-todo-permanently':
            emit('deleteTodoPermanently', props.shadowTodo.id)
            break
    }
}
</script>

<template>
    <nue-div v-if="shadowTodo" align="center" justify="space-between">
        <todo-project-selector
            :project-id="shadowTodo.projectId"
            :projects="projects"
            :user-id="user?.id || ''"
            placement="top-start"
            @select="(npId) => emit('updateTodoProject', npId)"
        />
        <nue-dropdown
            close-when-executed
            placement="top-end"
            @execute="handleDropdownExecute"
            theme="menu,small"
        >
            <template #trigger="{ trigger }">
                <nue-button icon="more" theme="small" @click="trigger">更多</nue-button>
            </template>
            <nue-div theme="block" style="min-width: 8rem">
                <nue-text theme="title">更多操作</nue-text>
                <inner-dropdown-option title="添加评论" icon="chat" execute-id="comment-todo" />
                <inner-dropdown-option
                    title="复制待办任务"
                    icon="files"
                    execute-id="duplicate-todo"
                />
                <!-- <inner-dropdown-option
                    :disabled="shadowTodo.isDeleted"
                    :title="shadowTodo.isGivenUp ? '取消放弃任务' : '放弃任务'"
                    :icon="shadowTodo.isGivenUp ? 'plus-circle' : 'clear'"
                    :execute-id="shadowTodo.isGivenUp ? 'cancel-give-up-todo' : 'give-up-todo'"
                /> -->
            </nue-div>
            <nue-div theme="block" style="min-width: 8rem">
                <nue-text theme="title">删除待办任务</nue-text>
                <inner-dropdown-option
                    :title="shadowTodo.isDeleted ? '恢复待办任务' : '删除待办任务'"
                    :icon="shadowTodo.isDeleted ? 'restore' : 'delete'"
                    :execute-id="shadowTodo.isDeleted ? 'restore-todo' : 'delete-todo'"
                />
                <inner-dropdown-option
                    v-if="shadowTodo.isDeleted"
                    title="永久删除待办任务"
                    icon="delete"
                    execute-id="delete-todo-permanently"
                    style="color: red"
                />
            </nue-div>
        </nue-dropdown>
    </nue-div>
</template>
