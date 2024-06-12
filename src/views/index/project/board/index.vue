<template>
    <nue-div vertical align="stretch" gap="4px">
        <nue-div align="center" style="padding: 4px 16px" gap="16px" :divider="{}">
            <nue-icon name="circle"></nue-icon>
            <nue-text size="12px" color="gray" flex>Name</nue-text>
            <nue-text size="12px" color="gray" style="width: 96px">Status</nue-text>
            <nue-icon name="more" style="opacity: 0"></nue-icon>
        </nue-div>
        <nue-divider></nue-divider>
        <template v-if="currentTodos.length === 0">
            <nue-div align="center" justify="center" style="padding: 16px">
                <nue-text size="12px" color="gray">No tasks found.</nue-text>
            </nue-div>
        </template>
        <template v-else>
            <nue-div
                v-for="todo in currentTodos"
                :key="todo.id"
                align="center"
                style="padding: 4px 16px"
                gap="16px"
                :divider="{}"
            >
                <nue-icon name="circle"></nue-icon>
                <nue-text size="12px" flex>{{ todo.name }}</nue-text>
                <nue-div align="center" style="width: 96px" gap="4px">
                    <nue-icon name="timer"></nue-icon>
                    <nue-text size="12px">In progress</nue-text>
                </nue-div>
                <nue-icon
                    name="delete"
                    color="#FF5722"
                    @click.stop="handleDelete(todo.id)"
                ></nue-icon>
            </nue-div>
        </template>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTodoStore, type Todo } from '@/stores/useTodoStore'
import { NueConfirm, NueMessage } from 'nue-ui'

defineOptions({ name: 'ProjectBoardView' })
const props = defineProps<{ projectId: string }>()

const todoStore = useTodoStore()

const currentTodos = computed(() => {
    const result: Todo[] = []
    if (props.projectId) {
        todoStore.read().filter((todo) => {
            if (todo.projectId === props.projectId) {
                result.push(todo)
            }
            return false
        })
    }
    return result
})

function handleDelete(id: string) {
    NueConfirm({
        title: 'Delete confirmation',
        content: 'Are you sure to delete this task?',
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
    }).then(
        () =>
            todoStore.remove(id).then(
                () => NueMessage.success('Task deleted successfully'),
                (err) => NueMessage.error(err)
            ),
        () => NueMessage.info('Operation canceled')
    )
}
</script>
