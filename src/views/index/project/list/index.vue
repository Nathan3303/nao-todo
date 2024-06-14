<template>
    <nue-div wrap="nowrap" height="100%">
        <nue-div
            vertical
            align="stretch"
            gap="4px"
            flex
            wrap="nowrap"
            height="100%"
            style="overflow: auto"
        >
            <!-- Table header -->
            <nue-div align="center" style="padding: 4px 16px" gap="16px" :divider="{}">
                <nue-icon name="circle"></nue-icon>
                <nue-text size="12px" color="gray" flex>Name</nue-text>
                <nue-text size="12px" color="gray" style="width: 96px">Status</nue-text>
                <nue-icon name="more" style="opacity: 0"></nue-icon>
            </nue-div>

            <nue-divider></nue-divider>

            <!-- Empty text -->
            <template v-if="currentTodos.length === 0">
                <nue-div align="center" justify="center" style="padding: 16px">
                    <nue-text size="12px" color="gray">No tasks found.</nue-text>
                </nue-div>
            </template>

            <!-- Table body -->
            <template v-else>
                <nue-div
                    v-for="todo in currentTodos"
                    :key="todo.id"
                    align="center"
                    style="padding: 4px 16px"
                    gap="16px"
                    :divider="{}"
                    wrap="nowrap"
                >
                    <nue-icon name="circle"></nue-icon>
                    <nue-div flex>
                        <nue-button theme="pure" @click="selectedTodoId = todo.id">
                            {{ todo.name }}
                        </nue-button>
                    </nue-div>
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

        <nue-divider v-if="todo" direction="vertical" style="height: 100%"></nue-divider>

        <!-- Todo details -->
        <nue-div
            v-if="todo"
            vertical
            align="stretch"
            flex
            width="86%"
            gap="12px"
            height="100%"
            style="overflow: auto"
            wrap="nowrap"
        >
            <nue-div align="center" justify="space-between">
                <nue-text size="16px">Task details</nue-text>
                <nue-button
                    theme="pure"
                    @click="selectedTodoId = null"
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
                    :rows="5"
                    placeholder="Input task description here..."
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
                    <nue-select @change="handleStateChange">
                        <p data-executeid="To Do">To Do</p>
                        <p data-executeid="In progress">In progress</p>
                        <li data-executeid="Done">Done</li>
                    </nue-select>
                </nue-div>
                <nue-div vertical gap="4px" width="fit-content">
                    <nue-text size="12px" color="gray">Priority</nue-text>
                    <nue-select @change="handlePriorityChange">
                        <li data-executeid="High">High</li>
                        <li data-executeid="Medium">Medium</li>
                        <li data-executeid="Low">Low</li>
                    </nue-select>
                </nue-div>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTodoStore, type Todo, type TodoPriority, type TodoState } from '@/stores/useTodoStore'
import { NueConfirm, NueMessage } from 'nue-ui'

defineOptions({ name: 'ProjectBoardView' })
const props = defineProps<{ projectId: string }>()

const todoStore = useTodoStore()

const selectedTodoId = ref<string | null>(null)

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

const todo = computed<Todo>(() => {
    const todos = currentTodos.value.find((t) => t.id === selectedTodoId.value)
    return todos as Todo
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

function handleStateChange(value: TodoState) {
    todoStore.update(selectedTodoId.value as string, { state: value })
}

function handlePriorityChange(value: TodoPriority) {
    todoStore.update(selectedTodoId.value as string, { priority: value })
}
</script>
