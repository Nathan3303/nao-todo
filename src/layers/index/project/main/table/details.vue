<template>
    <nue-div
        v-if="shadowTodo"
        vertical
        align="stretch"
        flex
        width="64%"
        gap="12px"
        height="100%"
        style="overflow: auto; min-width: 256px"
        wrap="nowrap"
    >
        <nue-div align="center" justify="space-between">
            <nue-div align="center" width="fit-content" gap="8px">
                <nue-text size="16px">Task details</nue-text>
                <nue-icon name="loading" v-if="loading" :spin="loading"></nue-icon>
            </nue-div>
            <nue-button theme="pure" @click="emit('closeTodoDetails')" icon="clear"></nue-button>
        </nue-div>
        <nue-divider></nue-divider>
        <nue-div vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray">Id</nue-text>
            <nue-text size="12px">{{ shadowTodo?.id }}</nue-text>
        </nue-div>
        <nue-div vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray">Name</nue-text>
            <nue-textarea
                v-model="shadowTodo.name"
                placeholder="Input task name here..."
                autosize
            ></nue-textarea>
        </nue-div>
        <nue-div vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray"> Description </nue-text>
            <nue-textarea
                v-model="shadowTodo.description"
                placeholder="Input task description here..."
                rows="5"
            ></nue-textarea>
        </nue-div>
        <nue-div>
            <!-- <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">Start at</nue-text>
                <nue-input type="date" disabled></nue-input>
            </nue-div> -->
            <!-- <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">End at</nue-text>
                <nue-input type="date" disabled></nue-input>
            </nue-div> -->
            <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">State</nue-text>
                <nue-select v-model="shadowTodo.state">
                    <nue-select-option label="To Do" value="todo"></nue-select-option>
                    <nue-select-option label="In Progress" value="in-progress"></nue-select-option>
                    <nue-select-option label="Done" value="done"></nue-select-option>
                </nue-select>
            </nue-div>
            <nue-div vertical gap="4px" width="fit-content">
                <nue-text size="12px" color="gray">Priority</nue-text>
                <nue-select v-model="shadowTodo.priority">
                    <nue-select-option label="Low" :value="0"></nue-select-option>
                    <nue-select-option label="Medium" :value="1"></nue-select-option>
                    <nue-select-option label="High" :value="2"></nue-select-option>
                </nue-select>
            </nue-div>
        </nue-div>
        <nue-div v-if="shadowTodo?.createdAt" vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray"> Created at </nue-text>
            <nue-text size="12px">{{ parseDate(shadowTodo?.createdAt) }}</nue-text>
        </nue-div>
        <nue-div v-if="shadowTodo?.updatedAt" vertical align="stretch" gap="4px">
            <nue-text size="12px" color="gray"> Updated at </nue-text>
            <nue-text size="12px">{{ parseDate(shadowTodo?.updatedAt) }}</nue-text>
        </nue-div>
    </nue-div>

    <template v-else>
        <nue-div
            align="center"
            justify="center"
            height="100%"
            vertical
            flex
            width="64%"
            gap="12px"
            style="overflow: auto; min-width: 256px"
            wrap="nowrap"
        >
            <nue-text size="12px" color="gray"> Click on a task to see its details. </nue-text>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTodoStore, type Todo } from '@/stores/use-todo-store'
import moment from 'moment'

const props = defineProps<{ todo: Todo | undefined }>()
const emit = defineEmits<{
    (event: 'closeTodoDetails'): void
    (event: 'updateTodoName', name: Todo['name']): void
}>()

const todoStore = useTodoStore()

const shadowTodo = ref<Todo | null>(null)
const loading = ref(false)
let timer: number | null = null
let shadowTodoUnWatch: Function | null = null

function parseDate(datestring: string) {
    // return new Date(datestring).toLocaleDateString()
    return moment(datestring)
}

watch(
    () => props.todo,
    (newValue) => {
        if (newValue) {
            shadowTodo.value = { ...newValue }
        } else {
            shadowTodo.value = null
        }
    },
    { immediate: true }
)

onMounted(() => {
    shadowTodoUnWatch = watch(
        () => shadowTodo.value,
        async (newValue, oldValue) => {
            if (!oldValue) return
            if (timer) clearTimeout(timer)
            timer = setTimeout(async () => {
                const { todo } = props
                if (!newValue && !todo) return
                loading.value = true
                await todoStore.update(todo?.id!, newValue!)
                loading.value = false
                timer = null
            }, 512)
        },
        { deep: true }
    )
})

onBeforeUnmount(() => {
    if (shadowTodoUnWatch) shadowTodoUnWatch()
})
</script>
