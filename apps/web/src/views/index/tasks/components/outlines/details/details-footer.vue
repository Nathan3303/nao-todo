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
            <nue-div gap="4px" width="fit-content" wrap="nowrap">
                <nue-button icon="chat" theme="small" @click="emit('leaveTodoComment')">
                    评论
                </nue-button>
                <nue-button icon="files" theme="small" @click="emit('duplicateTodo')">
                    复制
                </nue-button>
            </nue-div>
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
            </nue-div>
        </nue-div>
    </nue-footer>
</template>

<style scoped></style>
