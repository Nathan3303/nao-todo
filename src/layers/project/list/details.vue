<template>
    <nue-div
        vertical
        align="stretch"
        flex
        width="64%"
        gap="12px"
        height="100%"
        style="overflow: auto;min-width: 256px"
        wrap="nowrap"
    >
        <nue-div align="center" justify="space-between">
            <nue-text size="16px">Task details</nue-text>
            <nue-button
                theme="pure"
                @click="handleCloseTodoDetails"
                icon="arrow-right"
            ></nue-button>
        </nue-div>
        <nue-divider></nue-divider>
        <nue-div vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray">Id</nue-text>
            <nue-text size="12px">{{ todo.id }}</nue-text>
        </nue-div>
        <nue-div vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray">Name</nue-text>
            <nue-input v-model="todo.name" placeholder="Input task name here..."></nue-input>
        </nue-div>
        <nue-div vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray"> Description </nue-text>
            <nue-textarea
                v-model="todo.description"
                placeholder="Input task description here..."
                rows="3"
            ></nue-textarea>
        </nue-div>
        <nue-div>
            <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">Start at</nue-text>
                <nue-input type="date" disabled></nue-input>
            </nue-div>
            <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">End at</nue-text>
                <nue-input type="date" disabled></nue-input>
            </nue-div>
            <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">State</nue-text>
                <nue-select v-model="todo.state">
                    <p data-executeid="To Do">To Do</p>
                    <p data-executeid="In progress">In progress</p>
                    <li data-executeid="Done">Done</li>
                </nue-select>
            </nue-div>
            <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">Priority</nue-text>
                <nue-select v-model="todo.priority">
                    <li data-executeid="High">High</li>
                    <li data-executeid="Medium">Medium</li>
                    <li data-executeid="Low">Low</li>
                </nue-select>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import type { Todo } from '@/stores/useTodoStore'

defineProps<{ todo: Todo }>()
const emit = defineEmits<{
    (event: 'closeTodoDetails'): void
}>()

function handleCloseTodoDetails() {
    emit('closeTodoDetails')
}
</script>
