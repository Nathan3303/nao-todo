<template>
    <nue-container style="height: 100%">
        <project-table-header
            @add-todo="handleAddTodo"
            @filter-todos="handleFilterTodos"
        ></project-table-header>
        <nue-main style="margin: 16px 0 0">
            <nue-div wrap="nowrap" height="100%" style="overflow-x: auto">
                <project-table-main
                    :todos="currentTodos"
                    @show-todo-details="handleShowTodoDetails"
                    @delete-todo="handleDeleteTodo"
                ></project-table-main>
                <nue-divider v-if="todo" direction="vertical" style="height: 100%"></nue-divider>
                <project-table-details
                    v-if="todo"
                    :todo="todo"
                    @close-todo-details="selectedTodoId = null"
                ></project-table-details>
            </nue-div>
        </nue-main>
        <project-table-footer :total="currentTodos.length"></project-table-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { computed, ref, reactive, inject, toRaw } from 'vue'
import { useTodoStore, type Todo } from '@/stores/useTodoStore'
import { NueMessage } from 'nue-ui'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import type { ProjectViewContext } from '../types'
import {
    ProjectTableHeader,
    ProjectTableMain,
    ProjectTableDetails,
    ProjectTableFooter
} from '@/layers/index'

defineOptions({ name: 'ProjectTableView' })
const props = defineProps<{ projectId: string }>()

const { currentProject } = inject<ProjectViewContext>('projectViewContext')!
const route = useRoute()
const router = useRouter()
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
                result.push(
                    // toRaw(todo)
                    todo
                )
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

function handleAddTodo(todoName: Todo['name']) {
    todoStore.create(currentProject.id, todoName).then(
        () => NueMessage.success('Create todo successfully'),
        (err) => NueMessage.error(err)
    )
}

function handleFilterTodos(todoName: string) {
    let newQuery = { ...route.query }
    if (todoName === '') {
        delete newQuery.name
    } else {
        newQuery.name = todoName
    }
    router.push({ query: newQuery })
}

function handleShowTodoDetails(id: string) {
    selectedTodoId.value = id
}

function handleDeleteTodo(id: string) {
    todoStore.remove(id).then(
        () => NueMessage.success('Task deleted successfully'),
        (err) => NueMessage.error(err)
    )
}

onBeforeRouteUpdate((to, _, next) => {
    filterInfo.name = to.query.name as string
    filterInfo.state = to.query.state as string
    filterInfo.priority = to.query.priority as string
    next()
})
</script>
