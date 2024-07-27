<template>
    <teleport to="#TasksViewRightAside">
        <nue-div class="todo-details-wrapper" :data-empty="!todo">
            <content-todo-details-v2
                :todo="todo"
                :loading="detailsLoading"
                @close-todo-details="handleCloseTodoDetails"
                @create-todo-event="handleCreateTodoEvent"
                @update-todo-event="handleUpdateTodoEvent"
            ></content-todo-details-v2>
        </nue-div>
    </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ContentTodoDetailsV2 } from '@/layers/index'
import { useTodoStore, useUserStore } from '@/stores'
import { useRoute, useRouter } from 'vue-router'
import type { Todo, TodoEvent } from '@/stores'

defineOptions({ name: 'TasksAllTableTaskView' })
const props = defineProps<{ taskId: string; projectId?: string }>()

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const todoStore = useTodoStore()

const todo = ref<Todo | undefined>()
const detailsLoading = ref(false)

const handleGetTodo = async () => {
    const id = props.taskId
    const response = await todoStore.toFindOne(userStore.user!.id, id)
    if (response.code === '20000') {
        todo.value = response.data
    }
}

const handleCloseTodoDetails = () => {
    todo.value = void 0
    // console.log(route.matched)
    const prevRoute = route.matched[route.matched.length - 2]
    if (prevRoute) {
        setTimeout(() => router.push(prevRoute), 320)
        // router.push(prevRoute.path)
    }
}

const handleCreateTodoEvent = async (todoId: Todo['id'], newTodoEvent: Partial<TodoEvent>) => {
    const response = await todoStore.createTodoEvent(todoId, newTodoEvent)
    console.log(todo.value)
    todo.value!.events.push(response.data)
}

const handleUpdateTodoEvent = async (id: TodoEvent['id'], newTodoEvent: Partial<TodoEvent>) => {
    const response = await todoStore.updateTodoEvent(id, newTodoEvent)
    todo.value?.events.forEach((event) => {
        if (event.id === id) {
            Object.assign(event, response.data)
        }
    })
}

watch(
    () => props.taskId,
    async () => await handleGetTodo()
)

await handleGetTodo()
</script>

<style scoped>
.todo-details-wrapper {
    height: 100%;
    flex-wrap: nowrap;
    transition: all 0.32s ease-in-out;
    background-color: white;
    overflow: hidden;
    z-index: 0;
    padding: 0px;
}

@media screen and (max-width: 1200px) {
    .todo-details-wrapper {
        width: 440px;
        transform: translateX(0);
        position: absolute;
        right: 0;
        box-shadow: -2px 0px 10px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        padding: 0px;
    }

    .todo-details-wrapper[data-empty='true'] {
        transform: translateX(100%);
        overflow: hidden;
        box-shadow: none;
    }
}
</style>
