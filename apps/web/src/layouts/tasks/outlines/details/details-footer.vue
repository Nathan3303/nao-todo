<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { TodoDeleteButton, TodoProjectSelector } from '@nao-todo/components'
import type { DetailsFooterEmits, DetailsFooterProps } from './types'

defineProps<DetailsFooterProps>()
const emit = defineEmits<DetailsFooterEmits>()

const tasksDataStore = useTasksDataStore()

const { projects, user } = storeToRefs(tasksDataStore)

const handleDropdownExecute = (executeId: string) => {
    switch (executeId) {
        case 'comment-todo':
            emit('leaveTodoComment')
            break
        case 'duplicate-todo':
            emit('duplicateTodo')
            break
        case 'give-up-todo':
            emit('giveUpTodo')
            break
        case 'cancel-give-up-todo':
            emit('cancelGiveUpTodo')
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
        <nue-div wrap="nowrap" width="auto" gap="0.5rem">
            <nue-button
                v-if="shadowTodo.isDeleted"
                icon="delete"
                theme="error,small"
                @click="emit('deleteTodoPermanently', shadowTodo.id)"
            >
                永久删除
            </nue-button>
            <todo-delete-button
                :is-deleted="shadowTodo.isDeleted"
                @delete="emit('deleteTodo', shadowTodo.id)"
                @restore="emit('restoreTodo', shadowTodo.id)"
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
                    <li data-executeid="comment-todo"><nue-icon name="chat" />评论</li>
                    <li data-executeid="duplicate-todo"><nue-icon name="files" />复制</li>
                    <li v-if="shadowTodo.isGivenUp" data-executeid="cancel-give-up-todo">
                        <nue-icon name="plus-circle" />取消放弃任务
                    </li>
                    <li v-else data-executeid="give-up-todo"><nue-icon name="clear" />放弃任务</li>
                </nue-div>
            </nue-dropdown>
        </nue-div>
    </nue-div>
</template>
