<template>
    <nue-div wrap="nowrap" flex style="overflow: hidden">
        <nue-container style="height: 100%">
            <project-table-header
                @add-todo="handleAddTodo"
                @filter-todos="handleFilterTodos"
            ></project-table-header>
            <nue-main style="margin: 16px 0 0">
                <nue-div wrap="nowrap" flex style="overflow-y: auto">
                    <project-table-main
                        :todos="todos"
                        @show-todo-details="handleShowTodoDetails"
                        @delete-todo="handleDeleteTodo"
                    ></project-table-main>
                </nue-div>
            </nue-main>
            <project-table-footer
                :total="todos.length"
                :page-info="pageInfo"
                :count-info="countInfo"
                @perpage-change="handlePerPageChange"
                @page-change="handlePageChange"
            ></project-table-footer>
        </nue-container>
        <nue-divider v-if="todo" direction="vertical" style="height: 100%"></nue-divider>
        <project-table-details
            v-if="todo"
            :todo="todo"
            @close-todo-details="todo = undefined"
        ></project-table-details>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useTodoStore, type Todo, type TodoFilter } from '@/stores/use-todo-store'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import {
    ProjectTableHeader,
    ProjectTableMain,
    ProjectTableDetails,
    ProjectTableFooter
} from '@/layers/index'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'ProjectTableView' })
const props = defineProps<{ projectId: string }>()

const route = useRoute()
const router = useRouter()
const todoStore = useTodoStore()

todoStore.getTodosByProjectId(props.projectId)

const { todo, todos, pageInfo, countInfo, filterInfo } = storeToRefs(todoStore)

async function handleAddTodo(name: Todo['name']) {
    const { projectId } = props
    const res = await todoStore.createTodo(projectId, name)
    if (res.code === '20000') {
        todoStore.getTodosByProjectId(projectId)
    }
}

function handleFilterTodos(payload: TodoFilter) {
    const { projectId } = props
    const newFilterInfo = { ...filterInfo.value, ...payload }
    filterInfo.value = newFilterInfo
    todoStore.getTodosByProjectId(projectId)
}

async function handleShowTodoDetails(id: Todo['id']) {
    await todoStore.getTodoById(id)
}

async function handleDeleteTodo(id: Todo['id']) {
    await todoStore.remove(id)
}

async function handlePerPageChange(perPage: number) {
    pageInfo.value.page = 1
    pageInfo.value.limit = perPage
    todoStore.getTodosByProjectId(props.projectId)
}

async function handlePageChange(page: number) {
    pageInfo.value.page = page
    todoStore.getTodosByProjectId(props.projectId)
}
</script>
