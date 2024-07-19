<template>
    <teleport to="#TasksViewRightAside">
        <nue-div class="todo-details-wrapper" :data-empty="!todo">
            <todo-details
                :todo="todo"
                :loading="detailsLoading"
                @close-todo-details="handleCloseTodoDetails"
                @create-todo-event="handleCreateTodoEvent"
                @update-todo-event="handleUpdateTodoEvent"
            ></todo-details>
        </nue-div>
    </teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TodoDetails } from '@/components'
import { useTodoStore } from '@/stores'
import type { Todo, TodoEvent } from '@/stores'

defineOptions({ name: 'TasksAllTableTaskView' })
const props = defineProps<{ taskId: string }>()

const todoStore = useTodoStore()

const todo = ref<Todo | undefined>()
const detailsLoading = ref(false)

const handleGetTodo = async () => {
    const id = props.taskId
    detailsLoading.value = true
    const response = await todoStore.getTodoById(id)
    if (response.code === '20000') {
        todo.value = response.data
    }
    detailsLoading.value = false
}

const handleCloseTodoDetails = () => {
    todo.value = void 0
    // todoTableRef.value?.reset()
}

const handleCreateTodoEvent = async (todoId: Todo['id'], newTodoEvent: Partial<TodoEvent>) => {
    const response = await todoStore.createTodoEvent(todoId, newTodoEvent)
}

const handleUpdateTodoEvent = async (id: TodoEvent['id'], newTodoEvent: Partial<TodoEvent>) => {
    const response = await todoStore.updateTodoEvent(id, newTodoEvent)
}

await handleGetTodo()
</script>

<style scoped></style>
