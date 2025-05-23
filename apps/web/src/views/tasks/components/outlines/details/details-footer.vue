<script setup lang="ts">
import { TodoDeleteButton, TodoProjectSelector } from '@nao-todo/components'
import { useProjectStore, useUserStore } from '@/stores'
import { computed } from 'vue'
import type { DetailsFooterEmits, DetailsFooterProps } from './types'

defineProps<DetailsFooterProps>()
const emit = defineEmits<DetailsFooterEmits>()

const projectStore = useProjectStore()
const userStore = useUserStore()

const projects = computed(() => {
    return projectStore.findProjectsFromLocal({
        isArchived: false,
        isDeleted: false
    })
})

const handleDropdownExecute = (executeId: string) => {
    console.log(executeId)
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
    <nue-footer v-if="shadowTodo">
        <nue-div align="center" gap="4px" justify="space-between">
            <todo-project-selector
                :project-id="shadowTodo.projectId"
                :projects="projects"
                :user-id="userStore.user?.id || ''"
                placement="top-start"
                @select="(npId, npt) => emit('updateTodoProject', npId, npt)"
            />
            <!-- <nue-div gap="4px" width="fit-content" wrap="nowrap">
                <nue-button icon="chat" theme="small" @click="emit('leaveTodoComment')">
                    评论
                </nue-button>
                <nue-button icon="files" theme="small" @click="emit('duplicateTodo')">
                    复制
                </nue-button>
            </nue-div> -->
            <nue-div gap="4px" width="fit-content" wrap="nowrap">
                <nue-button
                    v-if="shadowTodo.isDeleted"
                    icon="delete"
                    size="small"
                    theme="error"
                    @click="emit('deleteTodoPermanently')"
                >
                    永久删除
                </nue-button>
                <todo-delete-button
                    :is-deleted="shadowTodo.isDeleted"
                    @delete="emit('deleteTodo')"
                    @restore="emit('restoreTodo')"
                />
                <nue-dropdown
                    hide-on-click
                    placement="top-end"
                    size="small"
                    @execute="handleDropdownExecute"
                    theme="menu"
                >
                    <template #default="{ clickTrigger }">
                        <nue-button icon="more" theme="small" @click="clickTrigger">
                            更多
                        </nue-button>
                    </template>
                    <template #dropdown>
                        <nue-div theme="block" style="min-width: 10rem">
                            <nue-text theme="title">更多操作</nue-text>
                            <li class="nue-dropdown-item" data-executeid="comment-todo">
                                <nue-icon name="chat" /> 评论
                            </li>
                            <li class="nue-dropdown-item" data-executeid="duplicate-todo">
                                <nue-icon name="files" /> 复制
                            </li>
                            <li
                                class="nue-dropdown-item"
                                v-if="shadowTodo.isGivenUp"
                                data-executeid="cancel-give-up-todo"
                            >
                                <nue-icon name="plus-circle" /> 取消放弃任务
                            </li>
                            <li class="nue-dropdown-item" v-else data-executeid="give-up-todo">
                                <nue-icon name="clear" /> 放弃任务
                            </li>
                        </nue-div>
                    </template>
                </nue-dropdown>
            </nue-div>
        </nue-div>
    </nue-footer>
</template>

<style scoped></style>
