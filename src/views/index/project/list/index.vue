<template>
    <nue-container>
        <nue-main>
            <nue-div wrap="nowrap" height="100%" style="overflow-x: auto">
                <project-list-main
                    :todos="currentTodos"
                    @show-todo-details="handleShowTodoDetails"
                    @delete-todo="handleDeleteTodo"
                ></project-list-main>
                <nue-divider v-if="todo" direction="vertical" style="height: 100%"></nue-divider>
                <project-list-details
                    v-if="todo"
                    :todo="todo"
                    @close-todo-details="selectedTodoId = null"
                ></project-list-details>
            </nue-div>
        </nue-main>
        <project-list-footer :total="currentTodos.length"></project-list-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useTodoStore, type Todo } from '@/stores/useTodoStore'
import { ProjectListMain, ProjectListDetails, ProjectListFooter } from '@/layers'
import { NueMessage } from 'nue-ui'
import { onBeforeRouteUpdate } from 'vue-router'

defineOptions({ name: 'ProjectBoardView' })
const props = defineProps<{ projectId: string }>()

const todoStore = useTodoStore()

const selectedTodoId = ref<string | null>(null)
const filterInfo = reactive<{ name?: string; state?: string; priority?: string }>({})

const currentTodos = computed(() => {
    const result: Todo[] = []
    if (props.projectId) {
        todoStore.read().filter((todo) => {
            if (todo.projectId === props.projectId) {
                if (filterInfo.name && !todo.name.includes(filterInfo.name)) {
                    return false
                }
                if (filterInfo.state && filterInfo.state !== todo.state) {
                    return false
                }
                if (filterInfo.priority && filterInfo.priority !== todo.priority) {
                    return false
                }
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

function handleShowTodoDetails(id: string) {
    selectedTodoId.value = id
}

function handleDeleteTodo(id: string) {
    todoStore.remove(id).then(
        () => NueMessage.success('Task deleted successfully'),
        (err) => NueMessage.error(err)
    )
}

onBeforeRouteUpdate((to, from, next) => {
    // console.log(to.query)
    filterInfo.name = to.query.name as string
    filterInfo.state = to.query.state as string
    filterInfo.priority = to.query.priority as string
    next()
})
</script>
